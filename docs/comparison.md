# Comparison with similar tools

There are a handful of other ways to ship or pull in Agent Skills via npm. Here's how `skill-indexer` differs.

## Feature matrix

|  | **skill-indexer** | [`npm-agentskills`](https://github.com/onmax/npm-agentskills) | `agent-skills-cli` | `add-skill` |
|---|---|---|---|---|
| Convention scan (no `package.json` change) | yes | no | partial | partial |
| Declarative `agents.skills` field | yes (compatible) | yes | varies | varies |
| Strict `SKILL.md` frontmatter validation | yes | partial | no | no |
| `include` / `exclude` glob filters | yes | no | no | no |
| Same-name conflict policy | `error` / `first-wins` / `last-wins` | n/a | n/a | n/a |
| Manifest-driven `clean` | yes | no | no | no |
| Multi-target install in one command | yes | yes | yes | yes |
| Programmatic API + types | yes | yes | partial | no |
| Targets supported | 7 | 7 | 45+ (but lighter validation) | varies |
| ESM + CJS dual build, Node 18+ | yes | yes | varies | varies |

## When to use which

**Use `skill-indexer` when:**

- You want a single, opinionated tool that's strict about what counts as a valid skill.
- Your dependency graph is messy and you need glob-based `include` / `exclude`.
- You want safe two-way (`install` / `clean`) operations driven by a manifest.

**Use `npm-agentskills` when:**

- You're already invested in its declarative `agents.skills` convention and the Nuxt module.
- You don't need strict validation and prefer opt-in publishing only.

**Use `agent-skills-cli` when:**

- You want to install skills *by name* from a public registry-like catalog of 45+ agents.

The conventions are mostly compatible — `skill-indexer` understands both the `agents.skills` declarative form and the bare `skills/<name>/SKILL.md` convention.

## Migrating from `npm-agentskills`

`skill-indexer` is a drop-in superset for `npm-agentskills` consumers. Replace:

```json
{ "scripts": { "postinstall": "agents export --target claude" } }
```

with:

```json
{ "scripts": { "postinstall": "skill-indexer install -t claude" } }
```

You don't have to change your library's `agents.skills` field — `skill-indexer` reads it. You'll just additionally pick up any skills published under the bare `skills/<name>/SKILL.md` convention.
