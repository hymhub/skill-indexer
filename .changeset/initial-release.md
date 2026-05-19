---
'skill-indexer': minor
---

Initial public release of `skill-indexer`.

- Convention + declarative scanning of `node_modules` for `SKILL.md` directories (supports npm / yarn / pnpm layouts and scoped packages).
- Strict `SKILL.md` frontmatter validation that silently filters out non-skill directories.
- `include` / `exclude` glob filters on package names.
- Same-name conflict policy: `error` / `first-wins` / `last-wins`; local sources always win.
- Manifest-driven `install` and `clean` for safe two-way operations.
- Targets: `cursor`, `codex`, `claude`, `copilot`, `amp`, `opencode`, `goose`.
- CLI commands: `install`, `list`, `validate`, `clean` (each with `--json`).
- Programmatic API: `loadConfig`, `scanAll`, `validateSkill`, `resolveSkills`, `installSkills`, `cleanInstalled`.
