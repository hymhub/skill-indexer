# Authoring guide (library authors)

This guide is for npm package maintainers who want to ship Agent Skills with their library.

## TL;DR

Put your skills under `skills/<skill-name>/SKILL.md` inside your package. That's it — no `package.json` change required. Consumers running `skill-indexer install` will pick them up automatically.

```
my-awesome-lib/
├── package.json
├── src/
└── skills/
    └── my-awesome-lib/
        ├── SKILL.md
        ├── reference.md
        └── scripts/
            └── validate.py
```

## Step 1 — Write `SKILL.md`

`SKILL.md` is a markdown file with YAML frontmatter. `skill-indexer` enforces the [Agent Skills spec](https://agentskills.io) at install time.

```markdown
---
name: my-awesome-lib
description: Use the my-awesome-lib API to render charts. Trigger when the user mentions charts, plotting, or visualization, or asks to "show data".
---

# my-awesome-lib

## Quick start

```ts
import { chart } from 'my-awesome-lib';
chart(data).render();
```
```

### Required frontmatter

| Field | Rule |
|-------|------|
| `name` | `^[a-z0-9][a-z0-9-]{0,63}$`, ≤ 64 chars. Must match the directory name. |
| `description` | Non-empty, ≤ 1024 chars. Include both **what** the skill does and **when** to use it. |

### Strongly recommended

- Write `description` in **third person** ("Renders charts…", not "I can render charts…"). The description is injected into the agent's system prompt.
- Mention concrete trigger terms ("charts", "plot", "visualization") so the agent can decide when to invoke the skill.
- Keep `SKILL.md` under 500 lines; move detail into `reference.md` / `examples.md` and link to them.

## Step 2 — Choose convention or declarative

**Convention (recommended).** Put each skill at `skills/<name>/SKILL.md`. Nothing else to do.

**Declarative** (`agents` field, compatible with `npm-agentskills`):

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

You can also point at a whole directory:

```json
{
  "agents": {
    "skillsDir": "./skills"
  }
}
```

Convention + declarative entries are merged; the same skill (same directory) is deduplicated automatically.

## Step 3 — Make sure your skill ships

Add the `skills` directory to `files` in your `package.json` (or your `.npmignore` doesn't strip it):

```json
{
  "files": ["dist", "skills"]
}
```

Sanity check what npm will publish:

```bash
npm pack --dry-run
```

## Step 4 — Validate before publishing

Run `skill-indexer validate` against your local skill folder in CI:

```bash
npx skill-indexer validate ./skills/my-awesome-lib --strict
```

It exits non-zero on any validation error, so you can wire it into `prepublishOnly`:

```json
{
  "scripts": {
    "prepublishOnly": "skill-indexer validate --strict"
  }
}
```

## Naming guidance

Pick a globally-distinct `name` so it doesn't collide with other libraries' skills. Examples that work well:

- `my-awesome-lib` (just your package name)
- `my-awesome-lib-quickstart`
- `acme-stripe-integration`

Collisions are resolved per the consumer's `onConflict` policy, but the friendliest default is to avoid them entirely.
