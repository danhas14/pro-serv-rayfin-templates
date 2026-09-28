"""
Scheduled suite runner — the entrypoint for the Container Apps Job.

Runs on a cron tick (every 15 minutes), finds the suites that have become due
since their last run, and executes each of their tests through the same
`core.execute_test` path the app's "Run with screenshots" button uses.

Why a tick-and-claim design rather than one Azure schedule per suite: adding or
retiming a suite is then a data change made by a business analyst in the app,
with no Azure deployment and no permission to grant. The job never needs to
know how many suites exist.
"""
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

from croniter import croniter

from core import (
    CapacityPaused,
    RunnerError,
    execute_test,
    get_connection,
)

# How far back a missed occurrence may be picked up. A tick that fires late (or
# after a brief outage) should still run the suite; one that has been down for a
# day should not suddenly fire a week of backlog at the applications.
CATCHUP_WINDOW = timedelta(hours=int(os.getenv("CATCHUP_HOURS", "6")))


def log(msg: str) -> None:
    print(f"{datetime.now(timezone.utc).isoformat()} {msg}", flush=True)


def as_utc(value: datetime | None) -> datetime | None:
    """SQL returns naive datetimes; everything here is UTC."""
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def is_due(
    cron: str,
    last_run_at: datetime | None,
    now: datetime,
    window: timedelta = CATCHUP_WINDOW,
) -> datetime | None:
    """
    The cron occurrence that still needs running, or None.

    Comparing the most recent scheduled occurrence against `last_run_at` —
    rather than asking "does now match the cron?" — is what makes a coarse tick
    safe. The job can run every 15 minutes and still honour a `0 2 * * 1`
    schedule exactly once, and a tick that arrives a few minutes late does not
    drop the occurrence entirely.
    """
    previous = croniter(cron, now).get_prev(datetime)
    if previous < now - window:
        return None
    last = as_utc(last_run_at)
    if last is not None and last >= previous:
        return None
    return previous


def due_suites(conn, now: datetime) -> list[dict]:
    """Suites whose most recent cron occurrence has not been run yet."""
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, name, schedule_cron, last_run_at
        FROM dbo.TestSuites
        WHERE schedule_enabled = 1 AND schedule_cron IS NOT NULL AND schedule_cron <> ''
        """
    )

    due = []
    for suite_id, name, cron, last_run_at in cur.fetchall():
        try:
            occurrence = is_due(cron, last_run_at, now)
        except (ValueError, KeyError) as exc:
            # A bad expression must not stall every other suite.
            log(f"SKIP  '{name}': invalid cron {cron!r} ({exc})")
            continue

        if occurrence is not None:
            due.append({"id": suite_id, "name": name, "occurrence": occurrence})

    return due


def claim(conn, suite: dict, now: datetime) -> bool:
    """
    Mark the suite as started, but only if nobody else has.

    A suite can take longer than the tick interval, so two job executions can
    overlap. The conditional UPDATE is what stops the same occurrence being run
    twice: whichever tick updates the row first wins, and the other sees zero
    affected rows and moves on.
    """
    cur = conn.cursor()
    cur.execute(
        """
        UPDATE dbo.TestSuites
        SET last_run_at = ?, last_run_status = 'Running'
        WHERE id = ? AND (last_run_at IS NULL OR last_run_at < ?)
        """,
        now, suite["id"], suite["occurrence"],
    )
    claimed = cur.rowcount > 0
    conn.commit()
    return claimed


def suite_tests(conn, suite_id: str) -> list[tuple[str, str]]:
    cur = conn.cursor()
    cur.execute(
        """
        SELECT t.id, t.name
        FROM dbo.SuiteMembers m
        JOIN dbo.TestCases t ON m.test_id = t.id
        WHERE m.suite_id = ?
        ORDER BY m.sort_order
        """,
        suite_id,
    )
    return [(r[0], r[1]) for r in cur.fetchall()]


def run_suite(conn, suite: dict) -> str:
    """Run every test in the suite. Returns the overall status."""
    suite_run_id = str(uuid.uuid4())
    tests = suite_tests(conn, suite["id"])
    if not tests:
        log(f"SKIP  '{suite['name']}': no tests in suite")
        return "Skipped"

    log(f"RUN   '{suite['name']}' ({len(tests)} tests, suite_run {suite_run_id})")
    statuses = []

    for test_id, test_name in tests:
        try:
            result = execute_test(
                conn,
                test_id=test_id,
                triggered_by="Scheduled",
                suite_run_id=suite_run_id,
                suite_name=suite["name"],
                created_by="scheduler",
            )
            statuses.append(result["status"])
            log(
                f"  {result['status']:<8} {test_name} "
                f"({result['steps_passed']} passed, {result['steps_failed']} failed, "
                f"{result['duration_seconds']:.1f}s)"
            )
        except RunnerError as exc:
            # One unrunnable test (e.g. no script yet) must not abandon the rest
            # of the suite.
            statuses.append("Error")
            log(f"  Error    {test_name}: {exc}")

    if "Failed" in statuses:
        return "Failed"
    if "Error" in statuses:
        return "Error"
    return "Passed"


def finish(conn, suite_id: str, status: str) -> None:
    conn.cursor().execute(
        "UPDATE dbo.TestSuites SET last_run_status = ? WHERE id = ?", status, suite_id
    )
    conn.commit()


def main() -> int:
    now = datetime.now(timezone.utc)

    try:
        conn = get_connection()
    except CapacityPaused as exc:
        # Exit 0 deliberately. This is an expected, self-healing condition, and
        # failing the execution would raise an alert for something that is not
        # a regression and that no test owner can act on.
        log(f"SKIPPED TICK: {exc}")
        return 0

    try:
        suites = due_suites(conn, now)
        if not suites:
            log("nothing due")
            return 0

        for suite in suites:
            if not claim(conn, suite, now):
                log(f"SKIP  '{suite['name']}': already claimed by another run")
                continue
            status = run_suite(conn, suite)
            finish(conn, suite["id"], status)
            log(f"DONE  '{suite['name']}' -> {status}")

        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
