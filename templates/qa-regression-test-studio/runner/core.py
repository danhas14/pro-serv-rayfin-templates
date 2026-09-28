"""
Shared execution core for the Regression Test Studio runner.

Both entrypoints use this: `main.py` (the HTTP service, for "Run with
screenshots" in the app) and `scheduler.py` (the cron job, for unattended
suite runs). Keeping the run logic here means a scheduled run and a manual run
are literally the same code path — a scheduled failure can always be reproduced
by pressing the button.
"""
import json
import os
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import uuid
from datetime import datetime, timezone

import pyodbc
from azure.identity import DefaultAzureCredential

SQL_SERVER = os.environ["SQL_SERVER"]
SQL_DATABASE = os.environ["SQL_DATABASE"]
WORKSPACE_ID = os.environ["FABRIC_WORKSPACE_ID"]
# OneLake rejects friendly names when FriendlyNameSupport is disabled on the
# tenant, so the lakehouse is addressed by GUID.
SCREENSHOT_LAKEHOUSE_ID = os.environ["SCREENSHOT_LAKEHOUSE_ID"]
# Optional: only needed by tests whose target site requires a sign-in.
KEY_VAULT_URL = os.getenv("KEY_VAULT_URL", "")

_credential = DefaultAzureCredential()


class RunnerError(Exception):
    """Base for failures that should be reported to the caller verbatim."""


class TestNotFound(RunnerError):
    pass


class ScriptMissing(RunnerError):
    pass


class CapacityPaused(RunnerError):
    """
    The Fabric capacity hosting the database is paused.

    Worth its own type because the raw driver message ("This SQL database has
    been disabled") reads like a permissions or provisioning fault, and it is
    neither — nothing is broken and no test actually failed. For scheduled runs
    this is the single most likely cause of a silent outage, so it must never be
    recorded as a test failure.
    """


class SecretsUnavailable(RunnerError):
    """A test references a credential that could not be read from Key Vault."""


SECRET_TOKEN = re.compile(r"\{\{secret:([A-Za-z0-9_.-]+)\}\}")


def _vault_secret_name(key: str) -> str:
    """Key Vault names allow only alphanumerics and dashes."""
    return re.sub(r"[^A-Za-z0-9-]", "-", key)


def resolve_secrets(script: str) -> tuple[str, dict[str, str]]:
    """
    Substitute `{{secret:KEY}}` placeholders with values from Key Vault.

    Credentials are read here, with the container's managed identity, rather
    than travelling with the test: nothing is stored on the step, in the
    database, or in the browser, so a person who can author a test never has to
    hold the password for the site it signs into.

    Returns the runnable script and the resolved values, which the caller needs
    only to redact them back out of anything it persists.
    """
    keys = sorted(set(SECRET_TOKEN.findall(script)))
    if not keys:
        return script, {}

    if not KEY_VAULT_URL:
        raise SecretsUnavailable(
            "This test needs credentials ("
            + ", ".join(keys)
            + ") but no key vault is configured for the runner."
        )

    from azure.keyvault.secrets import SecretClient

    client = SecretClient(vault_url=KEY_VAULT_URL, credential=_credential)
    values: dict[str, str] = {}
    for key in keys:
        try:
            values[key] = client.get_secret(_vault_secret_name(key)).value or ""
        except Exception as exc:
            raise SecretsUnavailable(
                f"Could not read the credential '{key}' from the key vault. "
                f"Expected a secret named '{_vault_secret_name(key)}'."
            ) from exc

    resolved = SECRET_TOKEN.sub(lambda m: values[m.group(1)], script)
    return resolved, values


def redact(text: str, secrets: dict[str, str]) -> str:
    """
    Replace secret values with named placeholders.

    A generated script can echo what it typed into an observation, and that
    observation is persisted and shown in run history. Longest value first, so
    an overlapping shorter secret cannot partially mask a longer one.
    """
    if not text:
        return text
    for key, value in sorted(
        secrets.items(), key=lambda kv: len(kv[1]), reverse=True
    ):
        if value:
            text = text.replace(value, f"<secret:{key}>")
    return text


def get_connection() -> pyodbc.Connection:
    """Connect to Fabric SQL with the container's managed identity."""
    token = _credential.get_token("https://database.windows.net/.default").token
    token_bytes = token.encode("utf-16-le")
    token_struct = struct.pack(f"<I{len(token_bytes)}s", len(token_bytes), token_bytes)

    conn_str = (
        "Driver={ODBC Driver 18 for SQL Server};"
        f"Server=tcp:{SQL_SERVER},1433;"
        f"Database={SQL_DATABASE};"
        "Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;"
    )
    SQL_COPT_SS_ACCESS_TOKEN = 1256
    try:
        return pyodbc.connect(conn_str, attrs_before={SQL_COPT_SS_ACCESS_TOKEN: token_struct})
    except pyodbc.Error as exc:
        detail = str(exc)
        if "42131" in detail or "has been disabled" in detail:
            raise CapacityPaused(
                "The Fabric capacity hosting this database is paused, so no tests "
                "can run or be recorded. Resume the capacity in the Azure portal "
                "(Microsoft.Fabric/capacities) and the next scheduled run will "
                "proceed. No test has failed."
            ) from exc
        raise


def load_test(conn, test_id: str) -> dict:
    cur = conn.cursor()
    cur.execute(
        """
        SELECT t.name, t.timeout_seconds, a.name, a.start_url
        FROM dbo.TestCases t
        JOIN dbo.TestApplications a ON t.application_id = a.id
        WHERE t.id = ?
        """,
        test_id,
    )
    row = cur.fetchone()
    if not row:
        raise TestNotFound(f"Test {test_id} not found.")

    cur.execute(
        "SELECT TOP 1 script_body FROM dbo.TestScripts WHERE test_id = ? ORDER BY updated_at DESC",
        test_id,
    )
    script = cur.fetchone()
    if not script:
        raise ScriptMissing(
            f"Test '{row[0]}' has no Playwright script yet. Open it and choose "
            "'Generate script' first."
        )

    return {
        "name": row[0],
        "timeout": row[1] or 300,
        "app_name": row[2],
        "start_url": row[3],
        "script": script[0],
    }


def create_run(conn, test_id, triggered_by, suite_run_id, suite_name, created_by) -> str:
    run_id = str(uuid.uuid4())
    conn.cursor().execute(
        """
        INSERT INTO dbo.TestRuns
            (id, test_id, suite_run_id, suite_name, status, triggered_by, started_at, created_by)
        VALUES (?, ?, ?, ?, 'Running', ?, ?, ?)
        """,
        run_id, test_id, suite_run_id, suite_name,
        triggered_by, datetime.now(timezone.utc), created_by,
    )
    conn.commit()
    return run_id


def _screenshot_path(run_id: str, filename: str) -> str:
    """
    Build a OneLake path, refusing anything that could escape the run folder.

    Both segments arrive from a URL on the read path, so they are validated
    rather than trusted: a `..` or an encoded slash in either one would
    otherwise let a caller read arbitrary files in the lakehouse.
    """
    if not re.fullmatch(r"[0-9a-fA-F-]{36}", run_id):
        raise ValueError("run id is not a uuid")
    if not re.fullmatch(r"[A-Za-z0-9_.-]{1,128}\.png", filename) or ".." in filename:
        raise ValueError("screenshot name is not allowed")
    return f"{SCREENSHOT_LAKEHOUSE_ID}/Files/screenshots/{run_id}/{filename}"


def _onelake_filesystem():
    from azure.storage.filedatalake import DataLakeServiceClient

    service = DataLakeServiceClient(
        account_url="https://onelake.dfs.fabric.microsoft.com",
        credential=_credential,
    )
    return service.get_file_system_client(WORKSPACE_ID)


def upload_screenshot(run_id: str, filename: str, png: bytes) -> str | None:
    """Upload to OneLake Files and return the canonical OneLake path URL."""
    try:
        path = _screenshot_path(run_id, filename)
        _onelake_filesystem().get_file_client(path).upload_data(png, overwrite=True)
        return f"https://onelake.dfs.fabric.microsoft.com/{WORKSPACE_ID}/{path}"
    except Exception as exc:
        print(f"screenshot upload failed: {exc}", file=sys.stderr)
        return None


def download_screenshot(run_id: str, filename: str) -> bytes | None:
    """
    Fetch a screenshot's bytes, or None if it is missing.

    The stored OneLake URL is a data-plane API address, so a browser opening it
    directly gets 401 — there is no way to attach a bearer token to a plain
    navigation. Streaming the bytes back through this service lets the app show
    the image using the caller's existing session instead.
    """
    path = _screenshot_path(run_id, filename)
    try:
        return _onelake_filesystem().get_file_client(path).download_file().readall()
    except Exception as exc:
        print(f"screenshot download failed: {exc}", file=sys.stderr)
        return None


# Chromium needs a larger-than-default /dev/shm in containers. The image runs as
# the non-root `pwuser`, so the setuid sandbox is unavailable and must be off.
LAUNCH_ARGS = 'args=["--no-sandbox", "--disable-dev-shm-usage"], '


def prepare_script(script: str) -> str:
    """
    Inject container-safe Chromium launch flags.

    The script keeps its argparse block and is run as a child process with real
    command-line arguments, so nothing else needs rewriting.
    """
    return re.sub(r"chromium\.launch\(", f"chromium.launch({LAUNCH_ARGS}", script)


def execute_script(script: str, start_url: str, screenshot_dir: str, timeout: int) -> tuple[str, str | None]:
    """Run the script in a child process. Returns (stdout, error_reason)."""
    fd, path = tempfile.mkstemp(suffix=".py", prefix="test_", dir=screenshot_dir)
    with os.fdopen(fd, "w", encoding="utf-8") as fh:
        fh.write(prepare_script(script))
    try:
        proc = subprocess.run(
            [sys.executable, path,
             "--start-url", start_url,
             "--screenshot-dir", screenshot_dir,
             "--headless", "true"],
            capture_output=True, text=True, timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        return "", f"The test exceeded its {timeout}s timeout."
    finally:
        os.unlink(path)

    # A non-zero exit is expected when a step fails; only report it when the
    # script emitted nothing parseable, otherwise the step results tell the story.
    reason = None
    if proc.returncode != 0 and not proc.stdout.strip():
        reason = (proc.stderr or f"Script exited with code {proc.returncode}.").strip()[:2000]
    return proc.stdout, reason


def save_results(conn, run_id: str, steps: list[dict]) -> None:
    cur = conn.cursor()
    for s in steps:
        cur.execute(
            """
            INSERT INTO dbo.StepResults
                (id, run_id, step_number, action, target, status,
                 observation, screenshot_ref, screenshot_url, duration_seconds, healed)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
            """,
            str(uuid.uuid4()), run_id, s.get("step", 0),
            (s.get("action") or "unknown")[:32], (s.get("target") or "")[:1000],
            s.get("status", "Skipped"), (s.get("observation") or "")[:4000],
            # The bare filename is what the app needs to request the image back.
            (s.get("screenshot") or None),
            s.get("screenshot_url"), s.get("duration", 0),
        )
    conn.commit()


def complete_run(conn, run_id, test_id, status, duration, reason, summary):
    now = datetime.now(timezone.utc)
    cur = conn.cursor()
    cur.execute(
        """UPDATE dbo.TestRuns SET status=?, completed_at=?, duration_seconds=?,
           failure_reason=?, summary=? WHERE id=?""",
        status, now, duration, reason, summary, run_id,
    )
    cur.execute(
        "UPDATE dbo.TestCases SET last_run_status=?, last_run_at=? WHERE id=?",
        status, now, test_id,
    )
    conn.commit()


def execute_test(
    conn,
    test_id: str,
    triggered_by: str = "Manual",
    suite_run_id: str | None = None,
    suite_name: str | None = None,
    created_by: str = "app",
) -> dict:
    """Run one test end to end and persist everything. Returns a result summary."""
    test = load_test(conn, test_id)
    # Before the run row exists, so a missing credential cannot strand a run
    # in 'Running' forever.
    script, secrets = resolve_secrets(test["script"])
    run_id = create_run(conn, test_id, triggered_by, suite_run_id, suite_name, created_by)

    screenshot_dir = tempfile.mkdtemp(prefix="shots_")
    started = datetime.now(timezone.utc)
    status, steps = "Passed", []

    try:
        stdout, reason = execute_script(
            script, test["start_url"], screenshot_dir, test["timeout"]
        )
        stdout = redact(stdout, secrets)
        reason = redact(reason, secrets) if reason else reason
        if reason:
            status = "Error"

        for line in stdout.splitlines():
            try:
                data = json.loads(line.strip())
            except (json.JSONDecodeError, ValueError):
                continue
            if "step" in data:
                steps.append(data)
            elif "summary" in data:
                status = data.get("status", status)

        for s in steps:
            name = s.get("screenshot")
            if name:
                path = os.path.join(screenshot_dir, name)
                if os.path.exists(path):
                    with open(path, "rb") as fh:
                        s["screenshot_url"] = upload_screenshot(run_id, name, fh.read())
            if s.get("status") == "Failed":
                status = "Failed"
                reason = reason or (s.get("observation") or "")[:2000]

        save_results(conn, run_id, steps)
    finally:
        shutil.rmtree(screenshot_dir, ignore_errors=True)

    duration = (datetime.now(timezone.utc) - started).total_seconds()
    passed = sum(1 for s in steps if s.get("status") == "Passed")
    failed = sum(1 for s in steps if s.get("status") == "Failed")

    if not steps and status != "Error":
        status = "Error"
        reason = "The script produced no step results."

    summary = (
        f"Playwright executed {len(steps)} steps: {passed} passed, {failed} failed. "
        + (reason or "All steps completed successfully.")
    )
    complete_run(conn, run_id, test_id, status, duration, reason, summary[:4000])

    return {
        "run_id": run_id,
        "test_name": test["name"],
        "status": status,
        "duration_seconds": duration,
        "steps_passed": passed,
        "steps_failed": failed,
    }
