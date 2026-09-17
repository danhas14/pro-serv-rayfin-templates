# Payables Insights Data App

Payables Insights is a reusable Microsoft Fabric Data App template for reporting over the Payables Pulse semantic model. It provides an operations overview, guided question-and-answer experiences backed by curated DAX, and deterministic what-if forecasting.

All figures shown by the companion Payables Pulse solution are synthetic.

## Features

- Payment value, straight-through rate, open exceptions, resolution time, rebate opportunity, and SLA metrics
- Interactive payment, exception, vendor, and customer visualizations
- Curated natural-language intent matching that maps questions to reviewed DAX queries
- Browser-based queue forecasting with arrival, capacity, automation, and payment-method levers
- Fabric portal embedding and host-mediated authentication
- Reusable DAX query modules and Vega-Lite specifications

<img width="2306" height="1304" alt="image" src="https://github.com/user-attachments/assets/5dee765b-41ef-471b-924f-5dd534d754fb" />

<img width="2375" height="1276" alt="image" src="https://github.com/user-attachments/assets/a7a38c44-1641-45c0-bf30-d19016f97a4c" />

What if simulation:
<img width="2258" height="1320" alt="image" src="https://github.com/user-attachments/assets/04f2b8b4-182c-4571-8168-62242dd0f8be" />




## Prerequisites

- Node.js 20 or later and npm
- A Microsoft Fabric workspace on a supported capacity
- A deployed `Payables_Pulse_Model` semantic model, such as the optional model in [`../payables-pulse`](../payables-pulse)
- Read and execute-query access to the semantic model

## Configure the semantic model

Replace the neutral IDs in `fabric.yaml` with the target semantic model:

```yaml
activeProfile: default
profiles:
  default:
    semanticModels:
      payables:
        workspaceId: <workspace-id>
        itemId: <semantic-model-item-id>
```

Generate the typed client configuration:

```powershell
npx fabric-app-data generate -o src/fabric.generated.ts
```

`src/fabric.generated.ts` is generated locally and ignored by Git because it contains deployment-specific IDs.

## Run and deploy

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Generate the Fabric connection configuration as described above.
3. Start the local development server:

   ```powershell
   npm run dev
   ```

4. In another terminal, open the app through the Fabric portal:

   ```powershell
   npm run test:fabric
   ```

5. Deploy the app:

   ```powershell
   npx rayfin up
   ```

This app is designed to run inside the Fabric portal. Opening its hosting URL directly shows an expected message that the app cannot run outside Fabric.

Rayfin generates workspace-specific values in `rayfin/.env`, `rayfin/.deployments.json`, and `.env.local`. These files are ignored by Git and must not be committed.

## Query design

DAX lives under `src/queries/payables/`. Each visual uses a query factory and may include a Vega-Lite specification. Windowed queries use a `__WINDOW_DAYS__` token that the app substitutes at runtime.

The guided question experience is rule-based rather than generative: supported questions map to reviewed query intents, and unmatched questions are declined rather than guessed.

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Run the Vite development server |
| `npm run test:fabric` | Open the local app embedded in the Fabric portal |
| `npm run build` | Generate Fabric config, type-check, and build |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest tests |

## Template sanitization

The committed `fabric.yaml` contains neutral all-zero placeholder IDs. Generated Fabric client configuration, Rayfin deployment/environment files, build output, dependencies, and local test output are excluded. Replace the placeholders only in your working copy and do not commit generated tenant-specific files.
