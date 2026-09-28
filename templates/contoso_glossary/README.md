# Contoso Glossary

Contoso Glossary is a reusable Microsoft Fabric Rayfin app template for discovering and managing business terminology. It includes synthetic Contoso sample content and does not contain a preconfigured Fabric workspace, tenant, item, capacity, or deployment.

## Features

- Dashboard-style glossary home with search and filters
- Term details with synonyms, category, owner, related terms, and last-updated date
- Semantic search experience with keyword, natural-language, and synonym-aware ranking
- Term and category administration
- Editor and viewer role behavior
- Responsive light and dark themes

<img width="1831" height="841" alt="image" src="https://github.com/user-attachments/assets/0951e959-dcaf-4354-b3dd-2504fdf9d036" />

Separate permissions based on who can edit terms. Terms are saved to the Fabric SQL Database.

<img width="1312" height="892" alt="image" src="https://github.com/user-attachments/assets/400a73e7-606e-4b0f-a6d2-4f9f05306fcf" />

Edit terms with an AI assistance feature for definition and synonyms:

<img width="1407" height="834" alt="image" src="https://github.com/user-attachments/assets/ac50d144-721b-4d0c-9e93-919e236ab2e1" />

Add and edit categories:

<img width="1437" height="708" alt="image" src="https://github.com/user-attachments/assets/8dd3101f-f064-4ab9-b6e6-4c43399b06c2" />




## Prerequisites

- Node.js 20 or later
- npm
- Access to a Microsoft Fabric workspace on a supported capacity
- Permission to create and deploy Fabric items in the target workspace

## Deploy to your workspace

1. Copy this template to a new working directory.
2. Install dependencies:

   ```powershell
   npm install
   ```

3. Sign in to the Rayfin CLI when prompted and deploy/start the app:

   ```powershell
   npm run dev
   ```

4. Select your target Fabric workspace during deployment.
5. Open `http://localhost:5173` for local development.

Rayfin generates workspace-specific values in `rayfin/.env`, `rayfin/.deployments.json`, and `.env.local`. These files are ignored by Git and must not be committed.

## Data model

- `GlossaryTerm`: name, definition, synonyms, category, department, owner, related terms, and audit dates
- `GlossaryCategory`: name and description

The app seeds synthetic glossary categories and terms when the data store is empty.

## Editor access

By default, any signed-in user is treated as an editor. To require an explicit allowlist, set:

```text
VITE_GLOSSARY_REQUIRE_EDITOR_ALLOWLIST=true
```

Then replace the synthetic addresses in `src/services/glossaryService.ts` with the appropriate editor identities for your deployment.

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Deploy/start Rayfin services and run the Vite development server |
| `npm run build` | Type-check and build the app |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest tests |
| `npm run rayfin:up` | Deploy the Rayfin app |

## Template sanitization

The template intentionally excludes generated deployment and environment files, build output, dependencies, and external hosting configuration. Before contributing future updates, verify that no workspace IDs, tenant IDs, item IDs, publishable keys, connection strings, or deployed redirect URLs were added.
