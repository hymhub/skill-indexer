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
        └── reference.md      <- optional, linked from SKILL.md
```

No `agents.skills` field is needed — the convention scan does the discovery.

## Key bits of `package.json`

```json
{
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
