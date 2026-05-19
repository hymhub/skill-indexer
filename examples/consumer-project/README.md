# Example: consumer project

This directory shows the recommended way to integrate `skill-indexer` into a real project.

## Configuration

The shape of `package.json` that matters:

```json
{
  "devDependencies": {
    "skill-indexer": "^0.1.0"
  },
  "scripts": {
    "sync-skills": "skill-indexer install"
  },
  "skillIndexer": {
    "targets": ["cursor", "codex", "claude"],
    "exclude": ["legacy-pkg-with-noisy-skills-folder"],
    "overwrite": "skip",
    "onConflict": "first-wins"
  }
}
```

## Workflow

1. Install dependencies — including any that ship skills:

   ```bash
   npm install
   ```

2. Sync skills into your tool directories:

   ```bash
   npm run sync-skills
   ```

3. Commit `.skill-indexer.manifest.json` (and the synced `.cursor/skills/`, `.codex/skills/`, … if you want skills checked in for the team). Many teams gitignore the destination directories and rely on `postinstall` to re-sync per-machine.

## Strict CI check

Add a workflow step that verifies every candidate is valid:

```yaml
- run: npx skill-indexer install -t cursor --strict --dry-run
```

It exits non-zero on any invalid candidate without touching the filesystem.

## Uninstalling

If you ever want to back out:

```bash
npx skill-indexer clean -t all
```

It will only remove paths recorded in `.skill-indexer.manifest.json` — never any skill you wrote by hand.
