# Comparison with similar tools

There are a handful of other ways to ship or pull in Agent Skills via npm. Here's how `skill-indexer` differs.

## Feature matrix

|                                                | **skill-indexer**                                  | [`npm-agentskills`](https://github.com/onmax/npm-agentskills) | `agent-skills-cli`           | `add-skill` |
| ---------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------- | ---------------------------- | ----------- |
| Declarative `agents.skills` field              | yes (recommended)                                  | yes                                                           | varies                       | varies      |
| Convention fallback (no `package.json` change) | yes                                                | no                                                            | partial                      | partial     |
| Strict `SKILL.md` frontmatter validation       | yes                                                | partial                                                       | no                           | no          |
| Experimental skill channel                     | yes                                                | no                                                            | no                           | no          |
| `include` / `exclude` glob filters             | yes                                                | no                                                            | no                           | no          |
| Same-name conflict policy                      | `error` / `first-wins` / `last-wins` / `keep-both` | n/a                                                           | n/a                          | n/a         |
| Manifest-driven `clean` + source audit         | yes                                                | no                                                            | no                           | no          |
| Multi-target install in one command            | yes                                                | yes                                                           | yes                          | yes         |
| Programmatic API + types                       | yes                                                | yes                                                           | partial                      | no          |
| Targets supported                              | 7                                                  | 7                                                             | 45+ (but lighter validation) | varies      |
| ESM + CJS dual build, Node 18+                 | yes                                                | yes                                                           | varies                       | varies      |

## When to use which

**Use `skill-indexer` when:**

- You want a single, opinionated tool that's strict about what counts as a valid skill.
- Your dependency graph is messy and you need glob-based `include` / `exclude`.
- You want safe two-way (`install` / `clean`) operations driven by a manifest.
- You want npm to remain the install and version-locking layer while following the SKILL.md format introduced at `agentskills.io`.

**Use `npm-agentskills` when:**

- You're already invested in its declarative `agents.skills` convention and the Nuxt module.
- You don't need strict validation and prefer opt-in publishing only.

**Use `agent-skills-cli` when:**

- You want to install skills _by name_ from a public registry-like catalog of 45+ agents.

The conventions are mostly compatible. `skill-indexer` treats `agents.skills` as authoritative when present and falls back to the bare `skills/<name>/SKILL.md` convention only for packages that do not declare a skill list.

## Migrating from `npm-agentskills`

`skill-indexer` is a drop-in superset for `npm-agentskills` consumers. Replace:

```json
{ "scripts": { "postinstall": "agents export --target claude" } }
```

with:

```json
{ "scripts": { "postinstall": "skill-indexer install -t claude" } }
```

You don't have to change your library's `agents.skills` field — `skill-indexer` reads it. Packages without an `agents` declaration still work through the bare `skills/<name>/SKILL.md` fallback.
