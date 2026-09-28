# Setup — Contract Analyzer App v2

The app is a static SPA, one Python **Fabric User Data Function (UDF)** item
with two functions, and a **SQL database in Fabric** provisioned by Rayfin.

```
Browser (SPA)  ──invoke──▶  UDF: analyze_contract  ──▶  Content Understanding
      │                     UDF: ask_contract      ──▶  Foundry model (gpt-5-mini)
      │
      └──Rayfin data API──▶ SQL database in Fabric (Contracts table)
```

---

## Deployed resources (your workspace)

| Resource | Name | ID |
| --- | --- | --- |
| App backend | `contract-analyzer-app-v2` | `<app-backend-item-id>` |
| SQL database | `contract-analyzer-app-v2` | `<sql-database-item-id>` |
| User Data Functions | `contract-analyzer-functions` | `<udf-item-id>` |

Live at `<your-fabric-hosting-url>`.

The earlier hand-created `Contract_Analyzer_App_v2` items are **not** used —
`rayfin up` always creates its own items named after the `id` in `rayfin.yml`
and records the binding in `rayfin/.deployments.json`.

---

## Why a UDF is required

Two reasons, and the second matters more than the first:

1. **CORS.** Azure AI Content Understanding and the Foundry gateway do not emit
   CORS headers for arbitrary web origins, so a browser `fetch` is blocked
   before it leaves the tab.
2. **Policy.** Which analyzer runs, which model answers, and what the system
   prompt says are all decisions that belong on the server. Anything shipped in
   the SPA bundle is readable and editable by every user.

---

## Security model (no secrets anywhere)

| Concern | How it is handled |
| --- | --- |
| App credentials | None. MSAL runs as an Entra **public client** (auth-code + PKCE). There is no client secret, API key, connection string, or SAS token in the repo, the bundle, or the function. |
| Who can call Azure AI | The **signed-in user**. The browser acquires a short-lived token for `https://cognitiveservices.azure.com/.default` and the UDF forwards it verbatim, so Azure enforces that user's own RBAC. A user without the *Cognitive Services User* role on the AI resource gets a 403 — the app cannot lend them its own privileges, because it has none. |
| Endpoint disclosure | The Content Understanding host, analyzer id, Foundry URL, and model deployment live only in `fabric-udf/function_app.py`. They are never sent to the browser. |
| Token storage | `sessionStorage` only, cleared when the tab closes. Tokens are never written to disk, logged, or persisted by the function. |
| SSRF | The function only ever *calls* two allowlisted hosts, and composes those URLs from constants. The `Operation-Location` polling URL returned by Content Understanding is re-validated against the allowlist before it is followed. |
| Document reference URLs | The URL is fetched by **Content Understanding**, not by the function. It is still validated first: HTTPS only, no embedded credentials, no non-standard port, and no loopback / link-local / RFC-1918 / `.internal` host — so it cannot be used to probe a private network. |
| Prompt injection | The Q&A system prompt tells the model the contract JSON is untrusted data, not instructions. Document text is passed as a separate user-message payload and is never concatenated into the system prompt. |
| Who can read a stored contract | The **uploader only**. The `Contract` entity carries a row-level security policy of `claims.sub == owner_id`, enforced by the database, so one user's contracts are invisible to another even though the queries do not filter on the owner. |
| Hostile file content | Extracted values are rendered as escaped React text nodes — never `dangerouslySetInnerHTML`. |
| Denial of service | Uploads capped at 4 MB, questions at 2 000 characters, grounding context at 120 000 characters, and analyzer polling at 150 seconds. |

---

## 1. Entra app registration (SPA)

A dedicated registration, `<your-spa-client-id>`, single tenant,
**no client secret** — this is a public client and must stay one.

**Authentication → Single-page application** (SPA, not Web — PKCE requires it):

- `http://localhost:5173`
- `<your-fabric-hosting-url>`

**API permissions**, delegated:

| API | Permission | How it is granted |
| --- | --- | --- |
| Power BI Service | `UserDataFunction.Execute.All` | Configured statically on the registration |
| Azure Cognitive Services | `user_impersonation` | **Incremental consent at first use** |

### Why Cognitive Services is not configured statically

The Cognitive Services API does not appear in this tenant's *APIs my
organization uses* picker, so the permission cannot be added to the
registration up front. The app therefore requests the **explicit** scope
`https://cognitiveservices.azure.com/user_impersonation` rather than
`.default`, which makes Entra prompt for consent the first time a token is
needed.

`.default` would fail here: it means *"everything already statically configured
for this resource"*, and is rejected outright when nothing is configured. See
the comment block in [`src/services/fabricAuth.ts`](../src/services/fabricAuth.ts)
— do not change that scope back.

The resource itself is real and reachable in the tenant; a token request for
`https://cognitiveservices.azure.com` returns `aud = https://cognitiveservices.azure.com`
issued by `<your-tenant-id>`. It is simply hidden from the permissions picker.

---

## 2. Grant users access to the AI resources

Assign each app user the **Cognitive Services User** role on **both** Foundry
resources (Azure portal → resource → *Access control (IAM)* → *Add role
assignment*):

| Resource | Used for |
| --- | --- |
| `<your-content-understanding-resource>` | Document analysis |
| `<your-foundry-resource>` | The `gpt-5-mini` Q&A model |

This is what makes the "no secrets" model work: the app has no identity of its
own, so it can only do what the signed-in user is already allowed to do.

### Why not the APIM gateway

The model was originally pointed at
`https://<your-apim-gateway>.azure-api.net/<foundry-path>/openai/v1/responses`.
That gateway does not evaluate Entra tokens at all — it rejects them before any
RBAC check:

```text
WWW-Authenticate: AzureApiManagementKey realm="...",name="api-key",type="header"
{"statusCode":401,"message":"Access denied due to missing subscription key."}
```

Using it would have meant storing an APIM subscription key somewhere. The UDF
therefore calls the Foundry resource's own data-plane endpoint,
`https://<your-foundry-resource>.cognitiveservices.azure.com/openai/v1/responses`,
which accepts the same delegated `cognitiveservices.azure.com` token already
used for Content Understanding — verified returning HTTP 200. The app stays
secret-free.

If you later *want* to route through APIM (for quota, logging, or content
safety), add a `validate-jwt` policy on the API so the gateway accepts Entra
tokens, and point `FOUNDRY_HOST` back at it. Do not solve it with a key.

---

## 3. Deploy the User Data Function

Already done — the item was created through the Fabric REST API, which accepts
the same three-part definition (`definition.json`, `function_app.py`,
`.platform`) that the portal writes. No separate publish step was needed; both
invoke endpoints went live immediately.

To **push a code change**, either paste the new `function_app.py` into the item
in the portal and publish, or `POST .../items/{itemId}/updateDefinition` with
the three parts re-encoded as `InlineBase64`.

> Once the code references a connection (it now does, via `@udf.connection`),
> `updateDefinition` only works when called by the **item owner**. Anyone else
> — including a service principal that originally created the item — gets
> `ItemOwnerValidationFailure`. Note also that `updateDefinition` stores new
> source but does **not** republish the running functions; publish from the
> portal to activate a change.

To point the app at a different analyzer or model, edit the constants at the top
of `function_app.py` and redeploy the item. Nothing in the SPA changes.

### Binding the SQL connection

The functions write through a connection alias, which must be bound once:

1. Open the **contract-analyzer-functions** item in the Fabric portal.
2. **Manage connections** → add the `contract-analyzer-app-v2` SQL database.
3. Set the alias to exactly **`ContractDb`** (case-sensitive — it is matched
   against a string literal in the decorator).
4. **Publish**.

Give the users of the app **Execute** permission on the UDF item.

The invoke URLs are already in `.env`:

```text
https://<workspace-id-nodash>.z<n>.userdatafunctions.fabric.microsoft.com/v1/workspaces/<workspace-id>/userDataFunctions/<udf-item-id>/functions/analyze_contract/invoke
https://<workspace-id-nodash>.z<n>.userdatafunctions.fabric.microsoft.com/v1/workspaces/<workspace-id>/userDataFunctions/<udf-item-id>/functions/ask_contract/invoke
```

---

## 4. Configure the frontend

`.env` is already written. `rayfin env --framework vite` regenerates
`.env.local` with the workspace/item ids on every `dev` and `build` — do not
edit that file by hand.

```powershell
npm run dev      # local, http://localhost:5173
npx rayfin up    # rebuild, redeploy, and re-apply the schema
```

> `rayfin up` runs the Vite build, so `.env` must be correct **before** you
> deploy — otherwise the `VITE_*` values are baked into the bundle as
> `undefined`.


---

## What gets stored

One row per analyzed contract, in the `Contract` table:

| Column | Contents |
| --- | --- |
| `content_base64` | The uploaded document, byte-for-byte. Empty for URL-sourced contracts. |
| `source_url` | Set instead of `content_base64` when the document came from a reference URL. |
| `fields_json` | The flattened Content Understanding fields shown in the middle panel. |
| `result_json` | The trimmed analyzer result. This is the **grounding context** passed to `ask_contract`. |
| `markdown` | The analyzer's markdown rendering of the document. |
| `file_name`, `content_type`, `size_bytes`, `analyzer_id`, `status`, `created_at` | Metadata for the saved-contracts list. |
| `owner_id` | The uploader's `claims.sub`. Drives row-level security. |

`content_base64`, `fields_json`, `result_json`, and `markdown` are declared with
a bare `@text()` so they map to `NVARCHAR(MAX)` — a base64 PDF and a full
analyzer result both exceed the 4 000-character `NVARCHAR(n)` ceiling. None of
them is uniquely indexed, which is the one thing `NVARCHAR(MAX)` cannot support.

---

## Q&A is not persisted

Questions and answers live in React state for the current session only. Nothing
about the conversation is written to the database. Add a `ContractQuestion`
entity if you want a durable thread.

---

## Known limits

| Limit | Value | Where |
| --- | --- | --- |
| Upload size | 4 MB | `MAX_UPLOAD_BYTES` in `function_app.py` |
| Analyzer wait | 150 s | `POLL_TIMEOUT_SECONDS` |
| Question length | 2 000 chars | `MAX_QUESTION_CHARS` |
| Grounding context | 120 000 chars | `MAX_CONTEXT_CHARS` |
| Answer length | 1 200 tokens | `MAX_ANSWER_TOKENS` |

A very long contract can produce a `result_json` larger than the grounding
limit. When that happens `ask_contract` rejects the request rather than
silently truncating the contract — reduce the analyzer's output or split the
document.
