# skill-indexer

**English** | [简体中文](./README.zh-CN.md)

[![npm version](https://img.shields.io/npm/v/skill-indexer.svg)](https://www.npmjs.com/package/skill-indexer)
[![CI](https://github.com/hymhub/skill-indexer/actions/workflows/ci.yml/badge.svg)](https://github.com/hymhub/skill-indexer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![Node](https://img.shields.io/node/v/skill-indexer.svg)](#)

> Zero-config CLI that scans your npm dependencies for `SKILL.md` directories, **validates them against the SKILL.md spec**, and installs them into Cursor / Codex / Claude / Copilot / Amp / OpenCode / Goose skill folders.

Library authors ship Agent Skills inside their npm packages. Consumers run **one command** to import every valid skill from their `node_modules` into the project-local folders their AI assistants expect — with strict frontmatter validation so accidental `skills/` folders that aren't real skills never leak through.

The design is intentionally cross-tool: npm stays the distribution substrate for version pinning, lockfiles, provenance, and audit, while `agents.skills` is the package-local declaration that tells every tool which directories are real skills. The SKILL.md format itself is introduced at [`agentskills.io`](https://agentskills.io); `skill-indexer` focuses on installing package-shipped skills into each tool's project-local folder.

---

## Why another tool?

|                                                                                | `skill-indexer`   | [`npm-agentskills`](https://github.com/onmax/npm-agentskills) | `add-skill` / various |
| ------------------------------------------------------------------------------ | ----------------- | ------------------------------------------------------------- | --------------------- |
| Declarative `agents.skills` field                                              | yes (recommended) | yes                                                           | varies                |
| Convention fallback (no `package.json` change needed)                          | yes               | no                                                            | varies                |
| Strict `SKILL.md` frontmatter validation                                       | yes               | partial                                                       | no                    |
| Experimental skill channel                                                     | yes               | no                                                            | no                    |
| `include` / `exclude` glob filters                                             | yes               | no                                                            | no                    |
| Same-name conflict policy (`error` / `first-wins` / `last-wins` / `keep-both`) | yes               | no                                                            | no                    |
| Manifest-driven safe `clean` + source audit                                    | yes               | no                                                            | no                    |
| Multi-target install in one command                                            | yes               | yes                                                           | varies                |

If you've ever had a dependency that _coincidentally_ contains a `skills/` directory or a `SKILL.md` file that wasn't meant for AI agents, `skill-indexer` will silently skip it instead of polluting your `.cursor/skills/`.

---

## Quick start

### As a consumer

```bash
# 1. Install once (project-local or global)
npm i -D skill-indexer

# 2. Sync every valid skill from your dependencies into Cursor + Codex + Claude
npx skill-indexer install -t cursor,codex,claude
```

That's it. The CLI will:

1. Scan `node_modules` (npm / yarn / pnpm layouts all supported) for skill candidates.
2. Validate every candidate's `SKILL.md` frontmatter.
3. Copy valid skills into `.cursor/skills/`, `.codex/skills/`, and `.claude/skills/`.
4. Write a `.skill-indexer.manifest.json` so `skill-indexer clean` can later remove them precisely.

Add it to your `postinstall` script to keep skills always in sync:

```json
{
  "scripts": {
    "postinstall": "skill-indexer install -t cursor,codex,claude"
  }
}
```

### As a library author

Publish one or more `SKILL.md` directories inside your package. The recommended form is declarative: list each skill in `package.json#agents.skills` so consumers do not have to guess which folders are meant for agents.

```
my-awesome-lib/
├── package.json
├── src/
└── skills/
    └── my-skill/
        ├── SKILL.md          # Required: metadata + instructions
        ├── scripts/          # Optional: executable code
        ├── references/       # Optional: documentation
        ├── assets/           # Optional: templates, resources
        └── ...               # Any additional files or directories
```

```markdown
---
name: my-skill
description: Use the my-awesome-lib API to do X. Trigger when the user mentions Y or asks how to Z.
---

# my-skill

Step 1: ...
```

Add an `agents` field:

```json
{
  "name": "my-awesome-lib",
  "agents": {
    "skills": [
      { "name": "my-skill", "path": "./skills/my-skill" },
      { "name": "my-skill-deep-dive", "path": "./skills/my-skill-deep-dive" }
    ]
  }
}
```

If a package declares `agents.skills`, those entries are authoritative. If it does not, `skill-indexer` falls back to the convention layout `skills/<name>/SKILL.md`.

---

## Supported targets

All paths are **project-local** — `skill-indexer` never writes to global config.

| Flag       | Tool                                                                                    | Directory          |
| ---------- | --------------------------------------------------------------------------------------- | ------------------ |
| `cursor`   | [Cursor](https://cursor.com/docs/skills)                                                | `.cursor/skills/`  |
| `codex`    | [OpenAI Codex](https://developers.openai.com/codex/skills)                              | `.codex/skills/`   |
| `claude`   | [Claude Code](https://code.claude.com/docs/en/skills)                                   | `.claude/skills/`  |
| `copilot`  | [GitHub Copilot](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills) | `.github/skills/`  |
| `amp`      | [Amp](https://ampcode.com/news/agent-skills)                                            | `.agents/skills/`  |
| `opencode` | [OpenCode](https://opencode.ai/docs/skills)                                             | `.opencode/skill/` |
| `goose`    | [Goose](https://block.github.io/goose/docs/guides/context-engineering/using-skills)     | `.goose/skills/`   |
| `all`      | every supported target above                                                            | —                  |

---

## CLI reference

```bash
skill-indexer install [options]          # Install valid dependency skills into target folders
skill-indexer list    [options]          # Show discovered, skipped, and filtered skills
skill-indexer validate [path] [options]  # Validate one skill directory, or local ./skills
skill-indexer clean   [options]          # Remove skills recorded in the manifest
```

### Common options

| Flag                   | Default             | Values                                                                    | Purpose                                                                           |
| ---------------------- | ------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `-t, --target <list>`  | config value / none | `cursor`, `codex`, `claude`, `copilot`, `amp`, `opencode`, `goose`, `all` | Choose target tool folders. Use commas for multiple targets.                      |
| `--cwd <dir>`          | `process.cwd()`     | filesystem path                                                           | Set the project root.                                                             |
| `--config <path>`      | auto-discover       | JSON config path                                                          | Read one config file.                                                             |
| `--include <patterns>` | none                | comma-separated globs                                                     | Only allow matching npm packages.                                                 |
| `--exclude <patterns>` | none                | comma-separated globs                                                     | Skip matching npm packages.                                                       |
| `--overwrite <mode>`   | `skip`              | `skip`, `overwrite`, `merge`                                              | If target exists: leave it, replace it, or copy into it.                          |
| `--on-conflict <mode>` | `first-wins`        | `first-wins`, `last-wins`, `error`, `keep-both`                           | If skill names collide: keep first, keep last, fail, or rename and keep all.      |
| `--scan <mode>`        | `declared-first`    | `declared-first`, `both`, `convention`, `declarative`                     | Discover from declarations first, both sources, only `skills/`, or only `agents`. |
| `--strict`             | `false`             | boolean flag                                                              | Treat validation warnings as errors.                                              |
| `--dry-run`            | `false`             | boolean flag                                                              | Show actions without writing files.                                               |
| `--experimental`       | `false`             | boolean flag                                                              | Include experimental skills.                                                      |
| `--no-convention`      | `false`             | boolean flag                                                              | Disable `skills/<name>/SKILL.md` fallback.                                        |
| `--no-declarative`     | `false`             | boolean flag                                                              | Disable `package.json#agents` discovery.                                          |
| `--json`               | `false`             | boolean flag                                                              | Print JSON to stdout.                                                             |

### Examples

```bash
# Install everything detected, into every supported target
skill-indexer install -t all

# Strict CI check: fail if any candidate would be skipped
skill-indexer install -t cursor --strict --dry-run

# Only allow skills from your org, and never from a legacy package
skill-indexer install -t cursor \
  --include "@my-org/*" \
  --exclude "legacy-*"

# Keep duplicate skill names by installing later conflicts with resolved names
skill-indexer install -t all --on-conflict keep-both

# Include experimental skills explicitly
skill-indexer install -t codex --experimental

# List discovered skills as JSON (great for tooling)
skill-indexer list --json

# Validate the project's own skills/ before committing
skill-indexer validate --strict

# Remove every skill that skill-indexer previously installed for Claude
skill-indexer clean -t claude
```

---

## Configuration

Either `package.json#skillIndexer` or a `skill-indexer.config.json` file:

```json
{
  "skillIndexer": {
    "targets": ["cursor", "codex", "claude"],
    "include": ["@my-org/*", "awesome-skills"],
    "exclude": ["legacy-pkg", "**/internal-only/*"],
    "scan": { "mode": "declared-first" },
    "overwrite": "skip",
    "strict": false,
    "onConflict": "first-wins",
    "experimental": false
  }
}
```

Precedence (lowest → highest): defaults → `package.json#skillIndexer` → config file → CLI flags.

---

## `SKILL.md` validation rules

A directory is treated as a valid skill only if its `SKILL.md`:

- Begins with a YAML frontmatter block (`--- ... ---`).
- Declares `name`: required, `^[a-z0-9][a-z0-9-]{0,63}$`, ≤ 64 chars.
- Declares `description`: required, non-empty, ≤ 1024 chars.

The following emit a warning (or an error in `--strict` mode):

- The directory name doesn't match `name`.
- `SKILL.md` exceeds 500 lines (soft limit; long skills hurt context efficiency).

Anything that fails the required checks is silently skipped during `install` and reported in `list`'s "invalid" section.

---

## Same-name conflicts

When two dependencies expose a skill with the same `name`:

- **`first-wins`** (default): keep whichever was discovered first; warn about the loser.
- **`last-wins`**: keep the latest match; useful when you intentionally shadow upstream skills.
- **`error`**: abort with a non-zero exit and list both sources.
- **`keep-both`**: install every conflicting skill by assigning deterministic names to later conflicts.
- A skill defined locally in the consumer project (`./skills/<name>`) **always** wins, regardless of mode.

In `keep-both`, the first skill keeps its frontmatter `name`. Later conflicts are renamed with a package-derived suffix, for example `shared` and `shared--beta-pkg`. If one package exposes multiple skills with the same `name`, the folder name is included, for example `shared--multi-pkg-two`. The copied `SKILL.md` frontmatter is rewritten in the destination only; the package in `node_modules` is never modified.

---

## Manifest

After every successful `install`, `skill-indexer` writes `./.skill-indexer.manifest.json`:

```json
{
  "version": 2,
  "updatedAt": "2026-05-19T07:00:00.000Z",
  "entries": [
    {
      "name": "my-skill",
      "channel": "stable",
      "contentHash": "sha256-...",
      "source": {
        "packageName": "my-awesome-lib",
        "packageVersion": "1.2.3",
        "kind": "declarative",
        "path": "skills/my-skill"
      },
      "targets": [
        { "target": "cursor", "dest": "/abs/path/to/.cursor/skills/my-skill" },
        { "target": "codex", "dest": "/abs/path/to/.codex/skills/my-skill" }
      ],
      "installedAt": "2026-05-19T07:00:00.000Z"
    }
  ]
}
```

`clean` only removes paths recorded in this manifest, so it will never delete a skill the user wrote by hand.

---

## Programmatic API

```ts
import {
  loadConfig,
  scanAll,
  resolveSkills,
  installSkills,
  cleanInstalled,
  validateSkill,
} from 'skill-indexer';

const { config } = await loadConfig({ cwd: process.cwd(), overrides: { targets: ['cursor'] } });
const candidates = await scanAll({ cwd: config.cwd, scan: config.scan });
const report = await resolveSkills(candidates, config);
const result = await installSkills(report.skills, { config });
console.log(result.entries);
```

Every type used above is exported from the package root (`ValidatedSkill`, `Target`, `SkillSyncConfig`, `Manifest`, …).

---

## How discovery works

```
node_modules/<pkg>/package.json#agents.skills              <- declarative scan
node_modules/<pkg>/package.json#agents.experimentalSkills  <- opt-in experimental scan
node_modules/<pkg>/package.json#agents.skillsDir           <- declarative scan (whole folder)
node_modules/<pkg>/skills/<name>/SKILL.md                  <- convention fallback
node_modules/@scope/<pkg>/skills/<name>/SKILL.md           <- convention fallback (scoped)
node_modules/.pnpm/<id>/node_modules/<pkg>/skills/..       <- convention fallback (pnpm flat store)
<cwd>/skills/<name>/SKILL.md                         <- local source (always wins)
```

Default scan mode is `declared-first`: a package with `agents.skills`, `agents.experimentalSkills`, or `agents.skillsDir` is treated as declarative and convention scanning is skipped for that package. Packages without declarations fall back to `skills/<name>/SKILL.md`. Use `--scan both` if you explicitly want both sources.

---

## Documentation

- [Authoring guide for library authors](./docs/authoring.md)
- [Consumer guide](./docs/consuming.md)
- [Programmatic API reference](./docs/api.md)
- [Comparison with similar tools](./docs/comparison.md)

---

## Contributing

PRs welcome! See [`CONTRIBUTING.md`](./CONTRIBUTING.md). The workflow is:

```bash
npm install
npm run build
npm run test
npm run lint
```

Add a [changeset](https://github.com/changesets/changesets) for every user-facing change:

```bash
npx changeset
```

---

## License

[MIT](./LICENSE)
