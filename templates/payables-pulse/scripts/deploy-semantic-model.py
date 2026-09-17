"""Create or update the Payables Pulse semantic model in Fabric from local TMDL.

Usage:  python scripts/deploy-semantic-model.py
"""

import base64
import json
import os
import pathlib
import subprocess
import sys
import time
import urllib.error
import urllib.request

WORKSPACE_ID = os.environ.get("FABRIC_WORKSPACE_ID")
FOLDER_ID = os.environ.get("FABRIC_FOLDER_ID")
SQL_DATABASE_ITEM_ID = os.environ.get("PAYABLES_SQL_DATABASE_ITEM_ID")
DISPLAY_NAME = "Payables_Pulse_Model"
API = "https://api.fabric.microsoft.com/v1"
ROOT = pathlib.Path(__file__).resolve().parent.parent / "semantic-model"


def token() -> str:
    return subprocess.run(
        [
            "az", "account", "get-access-token",
            "--resource", "https://api.fabric.microsoft.com",
            "--query", "accessToken", "-o", "tsv",
        ],
        capture_output=True, text=True, check=True, shell=True,
    ).stdout.strip()


def call(method: str, url: str, body: dict | None = None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {TOKEN}")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as resp:
            payload = resp.read().decode()
            return resp.status, dict(resp.headers), json.loads(payload) if payload else {}
    except urllib.error.HTTPError as err:
        detail = err.read().decode()
        raise SystemExit(f"{method} {url} -> {err.code}\n{detail}") from err


def wait(headers: dict) -> None:
    location = headers.get("Location")
    if not location:
        return
    for _ in range(60):
        time.sleep(2)
        _, _, state = call("GET", location)
        status = state.get("status")
        if status == "Succeeded":
            return
        if status == "Failed":
            raise SystemExit(f"operation failed: {json.dumps(state, indent=2)}")
    raise SystemExit("operation timed out")


def parts() -> list[dict]:
    out = []
    for path in sorted(ROOT.rglob("*")):
        if path.is_dir():
            continue
        rel = path.relative_to(ROOT).as_posix()
        content = path.read_bytes()
        if path.suffix.lower() in {".json", ".pbism", ".tmdl"}:
            text = content.decode("utf-8")
            text = text.replace("__FABRIC_WORKSPACE_ID__", WORKSPACE_ID)
            text = text.replace("__SQL_DATABASE_ITEM_ID__", SQL_DATABASE_ITEM_ID)
            content = text.encode("utf-8")
        out.append(
            {
                "path": rel,
                "payload": base64.b64encode(content).decode(),
                "payloadType": "InlineBase64",
            }
        )
    return out


def find_existing() -> str | None:
    _, _, listing = call("GET", f"{API}/workspaces/{WORKSPACE_ID}/semanticModels")
    for item in listing.get("value", []):
        if item["displayName"] == DISPLAY_NAME:
            return item["id"]
    return None


if __name__ == "__main__":
    if not WORKSPACE_ID or not SQL_DATABASE_ITEM_ID:
        raise SystemExit(
            "Set FABRIC_WORKSPACE_ID and PAYABLES_SQL_DATABASE_ITEM_ID before deployment."
        )

    TOKEN = token()
    definition = {"parts": parts()}
    print(f"{len(definition['parts'])} parts:")
    for part in definition["parts"]:
        print(f"  {part['path']}")

    existing = find_existing()
    if existing:
        print(f"updating {existing}")
        _, headers, _ = call(
            "POST",
            f"{API}/workspaces/{WORKSPACE_ID}/semanticModels/{existing}/updateDefinition"
            "?updateMetadata=True",
            {"definition": definition},
        )
        wait(headers)
        model_id = existing
    else:
        print("creating")
        create_body = {
            "displayName": DISPLAY_NAME,
            "description": "Star schema over the Payables Pulse operational database.",
            "definition": definition,
        }
        if FOLDER_ID:
            create_body["folderId"] = FOLDER_ID
        status, headers, body = call(
            "POST",
            f"{API}/workspaces/{WORKSPACE_ID}/semanticModels",
            create_body,
        )
        if status == 202:
            wait(headers)
            model_id = find_existing()
        else:
            model_id = body.get("id")

    print(f"\nsemantic model id: {model_id}")
    print(
        f"portal: https://app.fabric.microsoft.com/groups/{WORKSPACE_ID}"
        f"/datasets/{model_id}"
    )
    sys.exit(0)
