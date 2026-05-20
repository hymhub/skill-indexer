# Example: library author

This directory is a tiny npm package that ships an Agent Skill. It's the recommended
shape for any library that wants its skill to be picked up automatically by `skill-indexer`.

## Layout

```
example-skill-library/
├── package.json
└── skills/
    └── example-skill-library/
        ├── SKILL.md          <- required entry
        ├── references/       <- optional docs
        ├── scripts/          <- optional executables
        └── assets/           <- optional templates/resources
```

The package declares this directory in `package.json#agents.skills`. Packages without
that field still work through the `skills/<name>/SKILL.md` fallback, but published
packages should prefer an explicit declaration.

## Key bits of `package.json`

```json
{
  "agents": {
    "skills": [{ "name": "example-skill-library", "path": "./skills/example-skill-library" }]
  },
  "files": ["dist", "skills"],
  "scripts": {
    "prepublishOnly": "skill-indexer validate --strict"
  }
}
```

- `files` ensures `skills/` is included in the published tarball (run `npm pack --dry-run` to verify).
- `prepublishOnly` runs strict validation before npm publish so a broken `SKILL.md` never reaches consumers.

## Try it

After `npm publish` (or in this monorepo, after `npm pack`), a consumer can import the skill:

```bash
npm install example-skill-library
npx skill-indexer install -t cursor
# .cursor/skills/example-skill-library/SKILL.md now exists
```
