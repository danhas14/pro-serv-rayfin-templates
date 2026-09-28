"""
Regression Test Studio — Playwright runner HTTP service.

Exposes three endpoints:
  POST /runs                              execute one test now, return the result
  GET  /screenshots/{run_id}/{filename}   stream one screenshot from OneLake
  GET  /health                            liveness probe (excluded from Easy Auth)

Runs on the official Playwright image so Chromium and every system library it
needs are already present — the thing that made this impossible in a Fabric
notebook. The work itself lives in `core.py`, shared with the scheduler job so
a scheduled run and a manual run are the same code path.
"""
from fastapi import FastAPI, HTTPException, Response
from pydantic import BaseModel

from core import (
    CapacityPaused,
    ScriptMissing,
    SecretsUnavailable,
    TestNotFound,
    download_screenshot,
    execute_test,
    get_connection,
)

app = FastAPI(title="Regression Test Runner")


class RunRequest(BaseModel):
    test_id: str
    triggered_by: str = "Manual"
    suite_run_id: str | None = None
    suite_name: str | None = None
    created_by: str = "container-app"


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/screenshots/{run_id}/{filename}")
def get_screenshot(run_id: str, filename: str):
    """
    Return one screenshot as an image.

    Evidence lives in OneLake, whose URLs are data-plane API addresses that a
    browser cannot open (no way to attach a bearer token to a navigation).
    Easy Auth has already authenticated the caller by the time this runs, so
    the image can be fetched with the container's managed identity and handed
    back over the session the app already has.
    """
    try:
        png = download_screenshot(run_id, filename)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    if png is None:
        raise HTTPException(404, "That screenshot is no longer available.")

    return Response(
        content=png,
        media_type="image/png",
        headers={"Cache-Control": "private, max-age=3600"},
    )


@app.post("/runs")
def create_test_run(req: RunRequest):
    try:
        conn = get_connection()
    except CapacityPaused as exc:
        # 503 rather than 500: nothing is broken and the caller should simply
        # retry once the capacity is resumed.
        raise HTTPException(503, str(exc)) from exc

    try:
        return execute_test(
            conn,
            test_id=req.test_id,
            triggered_by=req.triggered_by,
            suite_run_id=req.suite_run_id,
            suite_name=req.suite_name,
            created_by=req.created_by,
        )
    except TestNotFound as exc:
        raise HTTPException(404, str(exc)) from exc
    except (ScriptMissing, SecretsUnavailable) as exc:
        raise HTTPException(400, str(exc)) from exc
    finally:
        conn.close()
