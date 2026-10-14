# AGENTS.md

This template ships Rayfin agent context.
Load `.agents/skills/rayfin/SKILL.md` and the `rayfin` MCP server in `.mcp.json`
before writing Rayfin code (run `npx rayfin init ai-files` if they are absent).

Rayfin docs are version-locked to the packages installed in this project.
Prefer the MCP tools `search_docs`, `get_doc`, `list_docs`, and `discover_packages`
for examples, API details, and troubleshooting. If MCP is unavailable, run
`rayfin docs ...` from the project root so the CLI reads this project's
`node_modules`. If `rayfin` is not on `PATH`, use
`npx -y @microsoft/rayfin-cli docs ...`.

## Project notes

- **The semantic model is the data source.** All operational figures come from the
  model in `semantic-model/`, bound via `fabric.yaml` → `src/fabric.generated.ts`.
  Never hard-code a figure into a component or an assistant response; add it to the
  model, project it in `src/queries/twin.ts`, and derive from it in
  `src/lib/metrics.ts`.
- `semantic-model/` is **generated** by `npm run generate:semantic-model` from
  `src/lib/twin-fixture.ts`. Edit the fixture and regenerate rather than editing
  TMDL by hand, so the deployed model and the dev snapshot cannot drift apart.
- `src/lib/metrics.ts` exposes `buildTwin(data)` — a pure function of the fetched
  data with no module-level state. Components read it through `useTwin()`;
  `useTwinState()` exposes loading/error/source.
- The loader resolves query results **by column name**, not by index. If you change
  a `SUMMARIZECOLUMNS` projection, update the matching `*_COLUMNS` tuple in
  `src/queries/twin.ts` — `twin-loader.test.ts` asserts this contract.
- Queries use the Fabric **embed proxy**, which only works inside the Fabric portal.
  `npm run dev` falls back to `src/lib/twin-fixture.ts`. That fallback sits behind
  `import.meta.env.DEV` so Vite eliminates it from production — keep it that way,
  and verify after bundling changes that fixture text is absent from `dist/`.
- Building `hotspot` polygons live in `src/data/geometry.ts` as percent-of-image
  coordinates keyed by building id, joined onto model rows at load time. They are
  presentation geometry, not model data.
- Measures for stocks (population, officers) are **semi-additive** — latest month in
  filter context. Incidents are additive. Preserve that distinction when adding
  measures, or totals across months become meaningless.
- The `data` and `storage` services are intentionally disabled in `rayfin.yml`, and
  password auth is off because a deployed Fabric app ships its publishable key in
  the bundle. Don't re-enable them without a reason.
- `rayfin up` needs `--workspace <name>` explicitly; without it the CLI provisions a
  brand-new workspace instead of reusing yours.
