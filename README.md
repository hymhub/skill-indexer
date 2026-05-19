# skill-indexer

**English** | [简体中文](./README.zh-CN.md)

[![npm version](https://img.shields.io/npm/v/skill-indexer.svg)](https://www.npmjs.com/package/skill-indexer)
[![CI](https://github.com/hymhub/skill-indexer/actions/workflows/ci.yml/badge.svg)](https://github.com/hymhub/skill-indexer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![Node](https://img.shields.io/node/v/skill-indexer.svg)](#)

> Zero-config CLI that scans your npm dependencies for `SKILL.md` directories, **validates them against the SKILL.md spec**, and installs them into Cursor / Codex / Claude / Copilot / Amp / OpenCode / Goose skill folders.

Library authors ship Agent Skills inside their npm packages. Consumers run **one command** to import every valid skill from their `node_modules` into the IDE-specific folders their AI assistant expects — with strict frontmatter validation so accidental `skills/` folders that aren't real skills never leak through.

---

## Why another tool?

| | `skill-indexer` | [`npm-agentskills`](https://github.com/onmax/npm-agentskills) | `add-skill` / various |
|---|---|---|---|
| Convention scan (no `package.json` change needed) | yes | no | varies |
| Declarative `agents.skills` field | yes (compat) | yes | varies |
| Strict `SKILL.md` frontmatter validation | yes | partial | no |
| `include` / `exclude` glob filters | yes | no | no |
| Same-name conflict policy (`error` / `first-wins` / `last-wins`) | yes | no | no |
| Manifest-driven safe `clean` | yes | no | no |
| Multi-target install in one command | yes | yes | varies |

If you've ever had a dependency that *coincidentally* contains a `skills/` directory or a `SKILL.md` file that wasn't meant for AI agents, `skill-indexer` will silently skip it instead of polluting your `.cursor/skills/`.

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

Publish a `SKILL.md` inside your package. The simplest "convention" layout requires **no `package.json` change**:

```
my-awesome-lib/
├── package.json
├── src/
└── skills/
    └── my-awesome-lib/
        ├── SKILL.md
        └── reference.md
```

```markdown
---
name: my-awesome-lib
description: Use the my-awesome-lib API to do X. Trigger when the user mentions Y or asks how to Z.
---

# my-awesome-lib

Step 1: ...
```

Prefer the declarative form (and want compatibility with `npm-agentskills`)? Add an `agents` field:

```json
{
  "name": "my-awesome-lib",
  "agents": {
    "skills": [
      { "name": "my-awesome-lib", "path": "./skills/my-awesome-lib" }
    ]
  }
}
```

Both forms are detected automatically.

---

## Supported targets

All paths are **project-local** — `skill-indexer` never writes to global config.

| Flag | Tool | Directory |
|------|------|-----------|
| `cursor` | [Cursor](https://cursor.com/docs/skills) | `.cursor/skills/` |
| `codex` | [OpenAI Codex](https://developers.openai.com/codex/skills) | `.codex/skills/` |
| `claude` | [Claude Code](https://code.claude.com/docs/en/skills) | `.claude/skills/` |
| `copilot` | [GitHub Copilot](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills) | `.github/skills/` |
| `amp` | [Amp](https://ampcode.com/news/agent-skills) | `.agents/skills/` |
| `opencode` | [OpenCode](https://opencode.ai/docs/skills) | `.opencode/skill/` |
| `goose` | [Goose](https://block.github.io/goose/docs/guides/context-engineering/using-skills) | `.goose/skills/` |
| `all` | every supported target above | — |

---

## CLI reference

```bash
skill-indexer install [options]
skill-indexer list    [options]
skill-indexer validate [path] [options]
skill-indexer clean   [options]
```

### Common options

| Flag | Description |
|------|-------------|
| `-t, --target <list>` | Comma-separated targets (e.g. `cursor,codex,claude`, or `all`). |
| `--cwd <dir>` | Project root (defaults to `process.cwd()`). |
| `--config <path>` | Explicit path to a config file. |
| `--include <patterns>` | Comma-separated globs (matched against npm package name). |
| `--exclude <patterns>` | Comma-separated globs (matched against npm package name). |
| `--overwrite <mode>` | `skip` (default) / `overwrite` / `merge`. |
| `--on-conflict <mode>` | `error` / `first-wins` (default) / `last-wins`. |
| `--strict` | Promote validation warnings to errors. |
| `--dry-run` | Print actions without writing files. |
| `--no-convention` | Disable convention scan. |
| `--no-declarative` | Disable declarative scan. |
| `--json` | Emit machine-readable JSON to stdout (progress goes to stderr). |

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
    "scan": { "convention": true, "declarative": true },
    "overwrite": "skip",
    "strict": false,
    "onConflict": "first-wins"
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

- **`error`** (default for libraries who want determinism): abort with a non-zero exit and list both sources.
- **`first-wins`** (default): keep whichever was discovered first; warn about the loser.
- **`last-wins`**: keep the latest match; useful when you intentionally shadow upstream skills.
- A skill defined locally in the consumer project (`./skills/<name>`) **always** wins, regardless of mode.

---

## Manifest

After every successful `install`, `skill-indexer` writes `./.skill-indexer.manifest.json`:

```json
{
  "version": 1,
  "updatedAt": "2026-05-19T07:00:00.000Z",
  "entries": [
    {
      "name": "my-awesome-lib",
      "source": { "packageName": "my-awesome-lib", "packageVersion": "1.2.3", "kind": "convention" },
      "targets": [
        { "target": "cursor", "dest": "/abs/path/to/.cursor/skills/my-awesome-lib" },
        { "target": "codex", "dest": "/abs/path/to/.codex/skills/my-awesome-lib" }
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

Every type used above is exported from the package root (`Skill`, `ValidatedSkill`, `Target`, `SkillSyncConfig`, `Manifest`, …).

---

## How discovery works

```
node_modules/<pkg>/skills/<name>/SKILL.md            <- convention scan
node_modules/@scope/<pkg>/skills/<name>/SKILL.md     <- convention scan (scoped)
node_modules/.pnpm/<id>/node_modules/<pkg>/skills/.. <- convention scan (pnpm flat store)
node_modules/<pkg>/package.json#agents.skills        <- declarative scan
node_modules/<pkg>/package.json#agents.skillsDir     <- declarative scan (whole folder)
<cwd>/skills/<name>/SKILL.md                         <- local source (always wins)
```

Symlinks are dereferenced and deduplicated by realpath, so a pnpm hardlink + top-level symlink are never scanned twice.

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
