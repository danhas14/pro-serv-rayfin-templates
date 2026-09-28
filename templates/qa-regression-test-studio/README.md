# Regression Test Studio

A Fabric App that lets business analysts build, run, and audit automated
regression tests for web applications — without writing code or maintaining
selectors.

Steps are written in plain language ("Click the Categories menu"). The app turns
them into either an agent-driven browser session or a generated Playwright
script, and records every run as queryable, auditable history.

> **Screenshots wanted.** This template ships without UI screenshots because the
> originals contained tenant-specific data. If you deploy it, please add a few.

---

## Two execution paths

The template supports two ways to run a test, and the choice matters.

| | **Run test** (agent) | **Run with screenshots** (container) |
|---|---|---|
| Executes | Your steps, interpreted live | A generated Playwright script |
| Browser | Microsoft-hosted | Chromium in a Container App |
| Screenshot evidence | No | **Yes**, to OneLake |
| Self-healing locators | **Yes** | No |
| Credentials for the site under test | Entered per run, memory only | **Azure Key Vault** |
| Can run unattended | No | **Yes** (cron) |
| Extra Azure resources | None | Container App + ACR + Key Vault |

**The agent path is the cheaper starting point.** It needs no Azure resources
beyond a Foundry agent, and it improves your tests over time by resolving
plain-language targets into durable locators and writing them back onto the step.

**The container path is what you need for evidence and scheduling.** It is also
the right choice whenever the target site requires a sign-in — see
[Credentials](#credentials-for-the-site-under-test).

You can deploy the agent path alone. Leave `VITE_RUNNER_URL` blank and the
screenshot button simply does not appear.

---

## Architecture

```
                 ┌──────────────────────────────┐
                 │  Fabric App (React SPA)      │
                 │  authoring · history · admin │
                 └──────┬───────────────┬───────┘
                        │               │
          agent path    │               │  container path
                        ▼               ▼
            ┌────────────────┐   ┌──────────────────────┐
            │ Foundry agent  │   │ Container App        │
            │ + Browser      │   │ (Playwright/Chromium)│
            │   Automation   │   └───────┬──────────────┘
            └───────┬────────┘           │
                    │                    ├──▶ Key Vault (credentials)
                    │                    └──▶ OneLake  (screenshots)
                    ▼                    │
              app under test ◀───────────┘
                    │
                    ▼
        Fabric SQL database (10 entities via Rayfin)

        Container Apps Job (cron) ──▶ same execution core as the button
```

---

## Prerequisites

- A Fabric workspace on an **active** capacity
- Node 20+ and the Rayfin CLI (`npm create @microsoft/rayfin@latest`)
- An Entra **SPA** app registration (public client, auth-code + PKCE)
- A Foundry project with an agent wired to the **Browser Automation** toolbox
- *Optional, for screenshots and scheduling:* an Azure Container Registry,
  Container Apps environment, and Key Vault

---

## Setup

### 1. Deploy the Fabric app

```bash
npm install
cp .env.example .env        # fill in the values below
npx rayfin up
```

`rayfin up` creates the AppBackend, the SQL database, and the static hosting,
and writes the binding into `rayfin/.deployments.json`.

### 2. Register the SPA in Entra

Create a **public client** app registration with platform **Single-page
application** (not Web — Web breaks PKCE with CORS errors on `/token`).

- Redirect URI must exactly equal the app's hosting origin
- Add delegated permission **Azure Cognitive Services → user_impersonation**
- Each user also needs the **Cognitive Services User** role on the AI resource.
  Consent lets the app *ask* for a token; the role is what makes the token *work*.

Add the hosting origin to `allowedRedirectUris` in `rayfin/rayfin.yml`, then
redeploy.

### 3. Create the Foundry agent

The agent needs the Browser Automation toolbox reachable as an MCP tool:

```json
{ "type": "mcp",
  "server_label": "<connection-name>",
  "server_url": ".../toolboxes/browser-automation-toolbox/versions/<n>/mcp?api-version=v1",
  "allowed_tools": { "tool_names": ["browser_automation_tool"] },
  "require_approval": { "never": { "tool_names": ["call_tool"] } },
  "project_connection_id": "<connection-name>" }
```

Read [Gotchas](#gotchas-that-will-cost-you-a-day) before doing this. Several
non-obvious details here caused multi-day debugging.

### 4. *Optional* — deploy the screenshot runner

```bash
cd runner
az acr build --registry <acr> --image regression-test-runner:v1 --file Dockerfile .

az containerapp create -n regression-test-runner -g <rg> \
  --environment <aca-env> \
  --image <acr>.azurecr.io/regression-test-runner:v1 \
  --system-assigned --ingress external --target-port 8000 \
  --cpu 2 --memory 4Gi --min-replicas 0 --max-replicas 3 \
  --env-vars SQL_SERVER=<fabric-sql-fqdn> SQL_DATABASE=<db-name> \
             FABRIC_WORKSPACE_ID=<ws-guid> SCREENSHOT_LAKEHOUSE_ID=<lakehouse-guid>
```

Then:

1. **Grant the managed identity access to Fabric** — this is a *Fabric* role
   assignment, not Azure RBAC:
   ```
   POST https://api.fabric.microsoft.com/v1/workspaces/{ws}/roleAssignments
   { "principal": { "id": "<MI-principalId>", "type": "ServicePrincipal" },
     "role": "Contributor" }
   ```
2. Apply Easy Auth using `runner/authconfig.json` (replace the placeholders).
3. Enable ingress CORS for your app origin — **at the ingress layer, not in
   FastAPI**. A preflight `OPTIONS` carries no `Authorization` header, so Easy
   Auth would reject it before the real request ever fires:
   ```bash
   az containerapp ingress cors enable -n regression-test-runner -g <rg> \
     --allowed-origins <app-origin> http://localhost:5173 \
     --allowed-methods GET POST OPTIONS \
     --allowed-headers authorization content-type
   ```
4. Set `VITE_RUNNER_URL` and redeploy the app.

See [`docs/SCHEDULING.md`](docs/SCHEDULING.md) for the Container Apps Job.

---

## Configuration

| Variable | Required | Purpose |
|---|---|---|
| `VITE_ENTRA_CLIENT_ID` | Yes | SPA app registration (public client) |
| `VITE_ENTRA_TENANT_ID` | No | Defaults to `organizations` |
| `VITE_AGENT_ENDPOINT` | Yes | Foundry agent responses endpoint |
| `VITE_AGENT_TIMEOUT_SECONDS` | No | Default 600 |
| `VITE_RUNNER_URL` | No | Container App base URL; blank disables screenshots |

Runner container variables: `SQL_SERVER`, `SQL_DATABASE`, `FABRIC_WORKSPACE_ID`,
`SCREENSHOT_LAKEHOUSE_ID`, and `KEY_VAULT_URL` (only if tests sign in).

**Nothing in `.env` is a secret.** `VITE_*` values are inlined into the browser
bundle at build time. The Entra registration is a public client with no secret
by design.

---

## Credentials for the site under test

Write `{{secret:PORTAL_PW}}` as a step's value. Where the value comes from
depends on the path:

- **Agent path** — collected in a dialog at run time, held in memory, never
  persisted. Note that the payload is serialised into the model prompt, so **the
  credential enters the LLM context**. Many security teams will not accept this.
- **Container path** — resolved from Key Vault by the container's managed
  identity and substituted into the script in-process. **No model sees it.**

Either way, resolved values are redacted from stdout and error text before
anything is written to the database.

A **service principal cannot be used to sign in to a web UI** — SPs have no user
identity and Entra rejects them at interactive endpoints. Use a dedicated,
low-privilege test *user* account.

Conditional Access is usually the real obstacle. The defensible pattern is to
exclude the test account from MFA *only* from a named location pinned to the
runner's egress IP. That mitigation is available on the container path and **not**
on the agent path, whose browser runs in Microsoft-managed infrastructure.

---

## Gotchas that will cost you a day

These are all things that actually went wrong during development.

**Foundry agent versions are immutable, and the endpoint has its own pin.**
Creating a new version does nothing until you move
`agent_endpoint.version_selector`. `POST {base}/versions` is the only call that
persists a definition change — `PATCH {base}` with `{definition: ...}` returns
**HTTP 200 and silently does nothing**. Always re-read after writing.

**`allowed_tools` filters on the underlying toolbox tool** (`browser_automation_tool`),
not the MCP wrappers. Listing `tool_search` there exposes it, the model calls it,
and the run stalls on an approval request with no output.

**The toolbox connection must specify an audience.** Create it with
`--auth-type user-entra-token --audience https://ai.azure.com`. Omitting it makes
*every* call fail with `tool_user_error` / "Missing required query parameter
'audience'".

**A Fabric capacity that is paused reports as a SQL error.** `This SQL database
has been disabled` (SQLSTATE 42131) means the capacity is paused, not that
anything is broken. The runner returns 503 and the scheduler exits 0 rather than
recording a false test failure.

**OneLake rejects friendly names.** Address the lakehouse by **GUID**, not
`<Name>.Lakehouse`, or you get `FriendlyNameSupportDisabled`.

**OneLake URLs cannot be opened in a browser.** They are data-plane API
addresses; a navigation carries no bearer token. The app proxies images through
the runner and offers a Fabric portal deep link via `selectedPath`.

**Run generated scripts as a subprocess, not `exec()`.** Under `exec()` the
script's `argparse` parses *uvicorn's* `sys.argv` and dies.

**`az containerapp create --registry-identity system` silently falls back to the
quickstart image** if the AcrPull role assignment fails — while still reporting
success. Always verify `properties.template.containers[0].image` after creating.

---

## What is deliberately not here

- **No `.env`, `.deployments.json`, or `dist/`** — these bind to a specific
  workspace and are regenerated by `rayfin up`.
- **No Fabric notebook runner.** A notebook cannot drive Chromium: Spark nodes
  lack the browser's system libraries, installing them needs sudo, and Python
  notebooks cannot attach a custom Environment. That is why the Container App
  exists.
- **No row-level security.** Tests and results are shared team-wide by design.
  Add `@authenticated` policies in `rayfin/data/` if you need isolation.

---

## Project layout

```
rayfin/data/        10 entities (TestCase, TestStep, TestRun, StepResult, …)
src/pages/          Dashboard, Tests, Editor, Import, Suites, Runs, Run detail
src/services/       testStore · testRunner · agentClient · containerAppRunner
                    scriptGenerator · failureSummarizer · entraAuth · docParser
runner/             FastAPI + Playwright container, scheduler, Easy Auth config
docs/SCHEDULING.md  Container Apps Job cron design
```

Run the tests with `npx vitest run` — 48 of them, covering redaction, the script
contract, URL building, and the step-to-prompt serialisation.
