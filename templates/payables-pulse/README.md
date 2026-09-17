# Payables Pulse

Payables Pulse is a reusable Microsoft Fabric Rayfin app template for payment operations and accounts-payable exception management. It includes a synthetic demonstration dataset, an operational Rayfin data model, an optional reporting star schema, and a Direct Lake semantic model template.

No real customer, vendor, bank account, card, invoice, employee, or transaction data is included.

## Features

- Operations command center for throughput, backlog, and service-level exposure
- Exception queue with filtering, sorting, assignment, notes, retry simulation, escalation, and resolution
- Customer payment health and vendor insights
- Administration for categories, service-level rules, payment methods, users, and roles
- Immutable audit trail and role-aware authorization
- Offline demo mode with deterministic synthetic data
- Optional SQL analytics layer and Direct Lake semantic model

<img width="2833" height="1465" alt="image" src="https://github.com/user-attachments/assets/4b397a10-0ce9-40b0-b4e6-eb31c9fc9d15" />

<img width="2835" height="1464" alt="image" src="https://github.com/user-attachments/assets/f7abc993-7c51-4a4f-8c5a-a7e64f635263" />

<img width="2812" height="1480" alt="image" src="https://github.com/user-attachments/assets/14e4dd90-ba1e-45bf-b099-19be33ccb8e8" />

<img width="2782" height="1483" alt="image" src="https://github.com/user-attachments/assets/20b60723-d05b-41a2-ab04-e3d791d81a3a" />





## Prerequisites

- Node.js 20 or later and npm
- Access to a Microsoft Fabric workspace on a supported capacity
- Permission to create and deploy Fabric items in the target workspace
- Azure CLI for the optional helper scripts
- Python 3, `pyodbc`, and Microsoft ODBC Driver 18 for SQL Server for SQL helper scripts

## Deploy the Rayfin app

1. Copy this template to a new working directory.
2. Install dependencies:

   ```powershell
   npm install
   ```

3. Sign in to the Rayfin CLI when prompted and deploy/start the app:

   ```powershell
   npm run dev
   ```

4. Select the target Fabric workspace during deployment.
5. Open `http://localhost:5173` for local development.

Rayfin generates workspace-specific values in `rayfin/.env`, `rayfin/.deployments.json`, and `.env.local`. These files are ignored by Git and must not be committed.

For a backend-free demonstration:

```powershell
npm run dev:offline
```

Offline mode is development-only and uses the in-memory synthetic dataset.

## Load demonstration data

When the database is empty, the app presents a **Load the demonstration dataset** screen. The fixed-seed generator creates synthetic customers, vendors, invoices, payments, exceptions, assignments, notes, audit events, and operating metrics.

## Optional analytics and semantic model

The `scripts/analytics-layer.sql` script creates an additive reporting star schema in the Rayfin SQL database. It does not alter Rayfin-managed operational tables.

Copy the values from `template.env.example` into your shell environment:

```powershell
$env:FABRIC_WORKSPACE_ID = '<workspace-id>'
$env:PAYABLES_SQL_DATABASE_ITEM_ID = '<sql-database-item-id>'
$env:PAYABLES_SQL_SERVER = '<sql-endpoint>.database.fabric.microsoft.com,1433'
$env:PAYABLES_SQL_DATABASE = '<database-name>'
```

Create the analytics tables:

```powershell
python scripts/sqldb.py scripts/analytics-layer.sql
```

Deploy the Direct Lake semantic model:

```powershell
python scripts/deploy-semantic-model.py
```

`FABRIC_FOLDER_ID` is optional. After deployment, set `PAYABLES_SEMANTIC_MODEL_ID` to run DAX queries with `scripts/dax.py`.

The deployment script substitutes the target workspace and SQL database item IDs into the TMDL in memory. The committed semantic model contains placeholders rather than tenant-specific identifiers.

## Roles

| Role | Capabilities |
|---|---|
| Operations Manager | Full operational and administrative access |
| Payment Operations Specialist | Queue assignment, notes, retries, resolution, escalation, and vendor review |
| Customer Success Manager | Customer health review and follow-up notes |
| Auditor | Read-only access |

Authorization is enforced in both the application service layer and Rayfin data policies.

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Deploy/start Rayfin services and run Vite |
| `npm run dev:offline` | Run against an in-memory synthetic dataset |
| `npm run build` | Type-check and build the app |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest tests |
| `npm run up` | Deploy the Rayfin app |

## Template sanitization

The template excludes generated deployment/environment files, dependencies, build output, and local Rayfin state. Before contributing updates, verify that no workspace, tenant, item, capacity, folder, semantic-model, SQL endpoint, publishable-key, connection-string, or deployed-hosting values were added.
