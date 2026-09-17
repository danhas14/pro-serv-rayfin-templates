"""Validate every .dax file in the app against the semantic model over XMLA.

The Fabric REST executeQueries path 401s for a service-principal az session, so
validation runs through the MCP/XMLA tooling instead. This script just prints
the resolved query text with tokens substituted so it can be pasted or piped.

Usage:  python scripts/print-queries.py [windowDays]
"""

import pathlib
import sys

WINDOW = sys.argv[1] if len(sys.argv) > 1 else "90"
ROOT = pathlib.Path(__file__).resolve().parent.parent / "src" / "queries" / "payables"

for path in sorted(ROOT.glob("*.dax")):
    text = path.read_text(encoding="utf-8").replace("__WINDOW_DAYS__", WINDOW)
    print(f"===== {path.name}")
    print(text.strip())
    print()
