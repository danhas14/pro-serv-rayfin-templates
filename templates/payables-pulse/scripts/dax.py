"""Run a DAX query against the Payables Pulse semantic model.

Usage:  python scripts/dax.py "EVALUATE ROW(\"v\", [Payment Value])"
        python scripts/dax.py --file query.dax
"""

import json
import os
import pathlib
import subprocess
import sys
import urllib.error
import urllib.request

WORKSPACE_ID = os.environ.get("FABRIC_WORKSPACE_ID")
MODEL_ID = os.environ.get("PAYABLES_SEMANTIC_MODEL_ID")
URL = (
    f"https://api.powerbi.com/v1.0/myorg/groups/{WORKSPACE_ID}"
    f"/datasets/{MODEL_ID}/executeQueries"
)


def token() -> str:
    return subprocess.run(
        [
            "az", "account", "get-access-token",
            "--resource", "https://analysis.windows.net/powerbi/api",
            "--query", "accessToken", "-o", "tsv",
        ],
        capture_output=True, text=True, check=True, shell=True,
    ).stdout.strip()


def run(dax: str) -> None:
    body = {
        "queries": [{"query": dax}],
        "serializerSettings": {"includeNulls": True},
    }
    req = urllib.request.Request(URL, data=json.dumps(body).encode(), method="POST")
    req.add_header("Authorization", f"Bearer {token()}")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as resp:
            payload = json.loads(resp.read().decode())
    except urllib.error.HTTPError as err:
        print(f"HTTP {err.code}")
        print(err.read().decode()[:4000])
        sys.exit(1)

    tables = payload["results"][0].get("tables", [])
    for table in tables:
        rows = table.get("rows", [])
        if not rows:
            print("(no rows)")
            continue
        headers = list(rows[0].keys())
        print(" | ".join(headers))
        for row in rows[:60]:
            print(" | ".join(str(row.get(h)) for h in headers))
        if len(rows) > 60:
            print(f"... {len(rows)} rows total")


if __name__ == "__main__":
    if not WORKSPACE_ID or not MODEL_ID:
        raise SystemExit(
            "Set FABRIC_WORKSPACE_ID and PAYABLES_SEMANTIC_MODEL_ID before querying."
        )
    if len(sys.argv) > 2 and sys.argv[1] == "--file":
        run(pathlib.Path(sys.argv[2]).read_text(encoding="utf-8"))
    else:
        run(sys.argv[1])
