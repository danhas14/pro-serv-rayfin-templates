# Contributing a Fabric App Template

Thanks for sharing a template! Please follow these conventions so templates stay discoverable and safe to reuse.

## 1. Folder location and naming

Create a new folder under `templates/` using kebab-case:

```
templates/<domain>-<short-name>/
```

Examples: `templates/retail-inventory-dashboard`, `templates/finance-cost-forecast`.

Each template folder should contain:

```
templates/<domain>-<short-name>/
├── README.md          # required — what it does, prerequisites, how to deploy, screenshots
├── metadata.yaml       # required — see schema below
└── <your files>        # .pbip/.pbir, dataflow exports, notebooks, Fabric item definitions, etc.
```

## 2. metadata.yaml schema

```yaml
name: retail-inventory-dashboard
description: >-
  Power BI dashboard + semantic model for inventory turnover analysis,
  built on a Lakehouse source.
owner: your-alias@microsoft.com
tags:
  - power-bi
  - retail
  - inventory
fabric_item_types:
  - SemanticModel
  - Report
  - Lakehouse
last_updated: 2026-09-13
```

## 3. Before you open a PR — sanitize your export

Fabric/Power BI exports can embed secrets. Check for and remove:

- Connection strings, SAS tokens, API keys
- Hardcoded workspace IDs, tenant IDs, or customer names (parameterize instead)
- Embedded credentials in `.pbip`/`.pbir` connection files
- Any customer data samples — use synthetic/sample data only

## 4. Open a pull request

1. Fork or branch from `main`.
2. Add your template folder.
3. Update the table in the root `README.md` with your template's row.
4. Open a PR using the PR template — fill in description and testing notes.
5. A reviewer (CODEOWNERS) will review before merge.

## 5. Updating an existing template

Same process — PR your changes and bump `last_updated` in `metadata.yaml`.
