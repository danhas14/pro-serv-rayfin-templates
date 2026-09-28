# Contract Analyzer

A Fabric-authenticated React + Vite app that extracts structured fields from a
contract with **Azure AI Content Understanding**, answers questions about it
with a **Foundry model**, and stores both the document and the extraction in a
**SQL database in Fabric**.

All AI calls go through a Python **Fabric User Data Function**. The browser
never learns the AI endpoints, and there are no secrets anywhere — the app runs
entirely on short-lived delegated tokens for the signed-in user.

See [`docs/SETUP.md`](docs/SETUP.md) for deployment and the security model.

<img width="1700" height="840" alt="image" src="https://github.com/user-attachments/assets/8d85dbd4-5e12-4486-9eab-3217f9bc7e48" />

Previously parsed contracts are stored in the Fabric SQL database. File upload tool can upload from your local computer or use a SharePoint document location. The SharePoint option allows for much larger document sizes (> 50 MB).

<img width="1044" height="833" alt="image" src="https://github.com/user-attachments/assets/9262833a-7a97-4bd8-b4ec-a4d78a9a947a" />

---

## Layout

```
fabric-udf/function_app.py     Three UDFs: analyze_contract, poll_contract, ask_contract
rayfin/data/Contract.ts        Entity + row-level security policy
rayfin/rayfin.yml              Rayfin service config
src/config/udfConfig.ts        Build-time UDF URLs + Entra client id
src/services/fabricAuth.ts     MSAL public client — Power BI + Azure AI tokens
src/services/contractAiClient  Invokes the UDFs
src/services/contractStore.ts  Reads/writes the Contract table
src/components/                Intake, Extracted Fields, Q&A panels
src/pages/HomePage.tsx         Three-panel layout
```

## Develop

```powershell
npm install
Copy-Item .env.example .env    # fill in the client id and the three UDF URLs
npm run dev                    # http://localhost:5173
```

## Deploy

```powershell
npx rayfin login
npx rayfin up                  # builds, deploys, and applies the schema
npx rayfin up status
```

## Checks

```powershell
npx tsc -b        # types
npm run lint      # eslint
npm test          # vitest
npm run build     # production bundle
```
