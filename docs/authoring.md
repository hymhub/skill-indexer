# Authoring guide (library authors)

This guide is for npm package maintainers who want to ship Agent Skills with their library.

## TL;DR

Put your skills under `skills/<skill-name>/` and list them in `package.json#agents.skills`. Consumers running `skill-indexer install` will pick them up across supported tools.

```
my-awesome-lib/
├── package.json
├── src/
└── skills/
    └── my-awesome-lib/
        ├── SKILL.md          # Required: metadata + instructions
        ├── scripts/          # Optional: executable code
        ├── references/       # Optional: documentation
        ├── assets/           # Optional: templates, resources
        └── ...               # Any additional files or directories
```

## Step 1 — Write `SKILL.md`

`SKILL.md` is a markdown file with YAML frontmatter. `skill-indexer` enforces the [Agent Skills spec](https://agentskills.io) at install time.

````markdown
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
````

````

### Required frontmatter

| Field | Rule |
|-------|------|
| `name` | `^[a-z0-9][a-z0-9-]{0,63}$`, ≤ 64 chars. Must match the directory name. |
| `description` | Non-empty, ≤ 1024 chars. Include both **what** the skill does and **when** to use it. |

### Strongly recommended

- Write `description` in **third person** ("Renders charts…", not "I can render charts…"). The description is injected into the agent's system prompt.
- Mention concrete trigger terms ("charts", "plot", "visualization") so the agent can decide when to invoke the skill.
- Keep `SKILL.md` under 500 lines; move detail into files under `references/` and link to them.

## Step 2 — Declare the package skills

Use the `agents` field as the cross-tool package contract:

```json
{
  "name": "my-awesome-lib",
  "agents": {
    "skills": [
      { "name": "my-awesome-lib", "path": "./skills/my-awesome-lib" }
    ]
  }
}
````

You can also point at a whole directory:

```json
{
  "agents": {
    "skillsDir": "./skills"
  }
}
```

If you need to publish work-in-progress skills without installing them by default, use `experimentalSkills`:

```json
{
  "agents": {
    "experimentalSkills": [{ "name": "next-api", "path": "./skills/next-api" }]
  }
}
```

Consumers must pass `--experimental` to install experimental skills.

If a package declares `agents.skills`, those entries are authoritative. If it does not, `skill-indexer` falls back to the convention layout `skills/<name>/SKILL.md`. That fallback keeps adoption low-friction, but published packages should prefer the declarative field so unrelated `skills/` folders never become part of the public contract by accident.

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
