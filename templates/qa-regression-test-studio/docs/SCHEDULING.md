# Scheduling unattended runs

Suites with `schedule_enabled` set and a `schedule_cron` expression now run
unattended. Execution is handled by the **`regression-test-scheduler` Container
Apps Job**, not by the app itself.

## How it works

A Fabric App is a static single-page application: the code runs in a browser tab
under the signed-in user's delegated token. There is no server-side process to
wake up at 02:00, and a delegated token is short-lived and cannot be persisted
for unattended use without turning it into a stored credential.

So execution moved to a Container Apps Job that authenticates as its own
**system-assigned managed identity** — no stored secret anywhere.

```
Container Apps Job (cron */15)  ->  Fabric SQL: which suites are due?
        |
        +-- for each due suite, for each test in sort_order:
                core.execute_test()   <- the same function the
                                         "Run with screenshots"
                                         button calls
        |
        +-- screenshots -> OneLake, results -> TestRuns / StepResults
```

Because a scheduled run and a manual run go through the same `core.execute_test`,
a scheduled failure can always be reproduced by pressing the button.

### Tick and claim, not one schedule per suite

The Job ticks every 15 minutes and asks the database what is due. It does **not**
have one Azure schedule per suite. That means adding a suite, changing its cron,
or disabling it is a data change a business analyst makes in the app — no Azure
deployment, no permission to grant, no redeploy.

Each tick, for every enabled suite, it computes the most recent cron occurrence
and compares it against `last_run_at`:

- occurrence is newer than `last_run_at` → due
- occurrence is older than the catch-up window (default 6h, `CATCHUP_HOURS`) →
  skipped, so an outage does not fire a backlog at the applications all at once

Comparing occurrences rather than asking "does *now* match the cron?" is what
lets a coarse 15-minute tick honour a `0 2 * * 1` schedule exactly once, and
what stops a late tick dropping an occurrence.

Before running, the Job claims the suite with a conditional `UPDATE`. If two
executions overlap — possible when a suite takes longer than the tick interval —
only the one that updates the row first proceeds.

**All cron expressions are evaluated in UTC.**

## Operating it

| Task | Command |
|---|---|
| Run now | `az containerapp job start -n regression-test-scheduler -g <YOUR-RESOURCE-GROUP>` |
| Recent executions | `az containerapp job execution list -n regression-test-scheduler -g <YOUR-RESOURCE-GROUP> -o table` |
| Logs | `az containerapp job logs show -n regression-test-scheduler -g <YOUR-RESOURCE-GROUP> --container regression-test-scheduler` |
| Change tick rate | `az containerapp job update -n regression-test-scheduler -g <YOUR-RESOURCE-GROUP> --cron-expression "*/30 * * * *"` |

## Paused Fabric capacity

The Job writes results to Fabric SQL, so **a paused capacity means scheduled runs
cannot happen**. The driver reports this as *"This SQL database has been
disabled"*, which reads like a permissions fault and is not one.

The Job detects this case specifically, logs `SKIPPED TICK` with an explanation,
and **exits 0** — it is a self-healing condition that no test owner can act on,
and failing the execution would raise an alert for something that is not a
regression. Nothing is recorded as a test failure.

If scheduled runs stop appearing, check capacity state first:

```
az resource show -g Fabric -n <capacity> \
  --resource-type Microsoft.Fabric/capacities --query properties.state
```

(`az resource list` returns `state: null` — it must be `show`.)

## Recommended cron values for this customer

| Suite | Cron | Meaning |
|---|---|---|
| Monthly patch validation | `0 2 3 * *` | 02:00 on the 3rd — after Patch Tuesday rollout |
| Nightly smoke | `0 1 * * 1-5` | 01:00 on weekdays |
| Post-upgrade regression | *(blank)* | Run on demand, tied to a release |

## Notes

- Scheduled runs are written with `triggered_by = 'Scheduled'`, so they can be
  told apart from manual runs in run history and in the CSV export.
- A test with no generated script is logged and skipped; it does not abandon the
  rest of the suite.
- The database schema remains the integration contract: anything that can write
  `TestRun` / `StepResult` / `AssertionResult` shows up in run history with no
  front-end change.
