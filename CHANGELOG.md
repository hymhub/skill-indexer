# skill-indexer

## 0.2.0

### Minor Changes

- 2bf631d: Add the 0.2.0 cross-tool skill package contract.
  - Use `declared-first` scanning by default: `agents.skills`, `agents.experimentalSkills`, and `agents.skillsDir` are authoritative when present; packages without declarations still fall back to `skills/<name>/SKILL.md`.
  - Add the `experimentalSkills` channel and `--experimental` opt-in install path.
  - Add `--on-conflict keep-both`, which preserves duplicate skill names by installing later conflicts with deterministic package/folder-derived names and rewriting only the copied `SKILL.md` frontmatter.
  - Upgrade manifests to v2 with channel, source path, original name, and content hash metadata while preserving v1 reads for clean.

## 0.1.0

### Minor Changes

- d09abd8: Initial public release of `skill-indexer`.
  - Convention + declarative scanning of `node_modules` for `SKILL.md` directories (supports npm / yarn / pnpm layouts and scoped packages).
  - Strict `SKILL.md` frontmatter validation that silently filters out non-skill directories.
  - `include` / `exclude` glob filters on package names.
  - Same-name conflict policy: `error` / `first-wins` / `last-wins`; local sources always win.
  - Manifest-driven `install` and `clean` for safe two-way operations.
  - Targets: `cursor`, `codex`, `claude`, `copilot`, `amp`, `opencode`, `goose`.
  - CLI commands: `install`, `list`, `validate`, `clean` (each with `--json`).
  - Programmatic API: `loadConfig`, `scanAll`, `validateSkill`, `resolveSkills`, `installSkills`, `cleanInstalled`.
