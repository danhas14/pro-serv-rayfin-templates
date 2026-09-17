# ProServ Rayfin Templates

A shared catalog of Microsoft Fabric app templates contributed by SEs. Use this repo to publish, discover, and reuse Fabric solution templates across engagements.

## What goes here

Each subfolder under `templates/` is one self-contained Fabric app template (e.g., a Power BI report + semantic model, a Dataflow, a notebook-based pipeline, or a full Fabric workspace export) along with documentation describing what it does and how to deploy it.

## Browsing templates

| Template | Description | Owner | Tags |
|---|---|---|---|
| [example-template](templates/example-template) | Starter example — replace with real templates | @dahassel_microsoft | example |
| [contoso-glossary](templates/contoso_glossary) | Searchable, role-aware Fabric business glossary with synthetic sample data | @dahassel_microsoft | fabric-app, rayfin, glossary |

> This table is maintained manually for now. As the catalog grows, we can automate it from each template's `metadata.yaml`.

## Contributing a template

See [CONTRIBUTING.md](CONTRIBUTING.md) for folder conventions, the metadata schema, and the PR process.

## Security note

Fabric exports can embed connection strings, workspace IDs, or credentials. Do **not** commit secrets. See CONTRIBUTING.md for the sanitization checklist. This repo is private — do not make it public without review.
