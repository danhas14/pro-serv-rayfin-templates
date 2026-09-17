"""Connect to the Fabric SQL database with an Entra token and run a query or script."""

import os
import pathlib
import re
import struct
import subprocess
import sys

import pyodbc

SERVER = os.environ.get("PAYABLES_SQL_SERVER")
DATABASE = os.environ.get("PAYABLES_SQL_DATABASE")
SQL_COPT_SS_ACCESS_TOKEN = 1256


def token_struct() -> bytes:
    token = subprocess.run(
        [
            "az",
            "account",
            "get-access-token",
            "--resource",
            "https://database.windows.net/",
            "--query",
            "accessToken",
            "-o",
            "tsv",
        ],
        capture_output=True,
        text=True,
        check=True,
        shell=True,
    ).stdout.strip()
    encoded = token.encode("utf-16-le")
    return struct.pack("<i", len(encoded)) + encoded


def connect() -> pyodbc.Connection:
    if not SERVER or not DATABASE:
        raise SystemExit(
            "Set PAYABLES_SQL_SERVER and PAYABLES_SQL_DATABASE before connecting."
        )
    conn_str = (
        "Driver={ODBC Driver 18 for SQL Server};"
        f"Server={SERVER};Database={DATABASE};"
        "Encrypt=yes;TrustServerCertificate=no;Connection Timeout=60;"
    )
    return pyodbc.connect(
        conn_str, attrs_before={SQL_COPT_SS_ACCESS_TOKEN: token_struct()}
    )


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else (
        "SELECT s.name AS [schema], t.name AS [table], "
        "SUM(p.rows) AS [rows] "
        "FROM sys.tables t "
        "JOIN sys.schemas s ON s.schema_id = t.schema_id "
        "JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0,1) "
        "GROUP BY s.name, t.name ORDER BY t.name"
    )

    if arg.lower().endswith(".sql"):
        script = pathlib.Path(arg).read_text(encoding="utf-8")
        batches = [
            b.strip()
            for b in re.split(r"^\s*GO\s*$", script, flags=re.MULTILINE | re.IGNORECASE)
            if b.strip()
        ]
        with connect() as cnx:
            cnx.autocommit = True
            cur = cnx.cursor()
            for index, batch in enumerate(batches, start=1):
                cur.execute(batch)
                while cur.nextset():
                    pass
                print(f"batch {index}/{len(batches)} ok")
        sys.exit(0)

    with connect() as cnx:
        cur = cnx.cursor()
        cur.execute(arg)
        if cur.description:
            print(" | ".join(c[0] for c in cur.description))
            for row in cur.fetchall():
                print(" | ".join("" if v is None else str(v) for v in row))
        else:
            print(f"rows affected: {cur.rowcount}")
