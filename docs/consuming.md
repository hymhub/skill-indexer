# Consumer guide

This guide is for developers using one or more AI coding agents (Cursor, Codex, Claude Code, Copilot, …) who want to import skills shipped inside their `node_modules` dependencies.

## 1. Install

```bash
npm i -D skill-indexer
```

## 2. Pick your targets

Targets are which agent's skill folder you want to populate. You can pass them on the CLI:

```bash
npx skill-indexer install -t cursor,codex,claude
```

…or set them once in `package.json`:

```json
{
  "skillIndexer": {
    "targets": ["cursor", "codex", "claude"],
    "scan": { "mode": "declared-first" }
  }
}
```

`all` expands to every supported tool.

## 3. Sync automatically on install

```json
{
  "scripts": {
    "postinstall": "skill-indexer install"
  }
}
```

Your team members get the same skill bundle the moment they run `npm install`.

## 4. Inspect what's available

```bash
npx skill-indexer list
```

Shows everything `skill-indexer` discovered, grouped by source. Use `--json` to feed it into tooling. The output also surfaces:

- **Skipped** candidates — directories that contained `SKILL.md` but failed validation. Useful for diagnosing why a dependency's skill didn't appear.
- **Filtered** candidates — directories that matched your `exclude` patterns (or didn't match `include`).
- **Experimental** candidates — skills declared through `agents.experimentalSkills`; install them only with `--experimental`.

## 5. Keep junk out

Sometimes a dependency happens to have a `skills/` folder that isn't really an agent skill. Two layers protect you:

1. **Validation.** Anything without a valid `SKILL.md` frontmatter is silently skipped. Run `skill-indexer list` to see what was rejected.
2. **Exclude.** Add the package's name (or a glob) to `exclude`:

```json
{
  "skillIndexer": {
    "exclude": ["some-noisy-pkg", "legacy-*", "@old-org/*"]
  }
}
```

If you want a strict allow-list instead:

```json
{
  "skillIndexer": {
    "include": ["@my-org/*", "awesome-skills"]
  }
}
```

`include` and `exclude` are evaluated against the **npm package name** (e.g. `@scope/name`).

## 6. Avoid accidental overwrites

By default `skill-indexer` uses `overwrite: skip`, so it won't touch any directory that already exists at the destination. This protects skills you wrote by hand.

Other modes:

- `overwrite`: blow away the existing destination directory and replace it.
- `merge`: copy in over the existing tree (existing files at the same path are replaced, others are kept).

You can also project-locally version `./skills/<name>` — local skills **always** win against duplicates from dependencies, regardless of mode.

If you want to keep conflicting dependency skills instead of choosing one, use:

```bash
npx skill-indexer install -t all --on-conflict keep-both
```

Later conflicts are installed with deterministic names such as `shared--beta-pkg`. If one package publishes multiple skills with the same frontmatter `name`, the folder name is included, such as `shared--multi-pkg-two`. The installed copy's `SKILL.md` frontmatter is rewritten to match the resolved name; the package in `node_modules` is untouched.

## 7. Uninstall what you imported

`skill-indexer clean -t cursor` reads `.skill-indexer.manifest.json` and removes only the paths it remembers installing. Hand-written skills are never touched.

```bash
# Remove every skill skill-indexer installed across every target
npx skill-indexer clean -t all

# Or just one
npx skill-indexer clean -t claude
```

## 8. CI patterns

Strict, no-write check:

```bash
skill-indexer install -t cursor --strict --dry-run
```

This exits non-zero if any candidate would fail validation, but writes nothing to disk — perfect for `pull_request` workflows.

Install experimental skills explicitly:

```bash
skill-indexer install -t codex --experimental
```

## Troubleshooting

| Symptom                                                | Likely cause                                                                                                                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `info  scanning ...` then "No valid skills to install" | No dependency ships a valid skill, or your include/exclude excluded everything. Run `skill-indexer list` to see all candidates.                               |
| Existing skill folder wasn't updated                   | Default mode is `--overwrite skip`. Use `--overwrite overwrite` or `merge`.                                                                                   |
| Experimental skill is listed but not installed         | Pass `--experimental`; experimental skills are opt-in by design.                                                                                              |
| pnpm install: skills missing                           | Make sure you're running `skill-indexer` _after_ the pnpm install completes (pnpm hoists asynchronously in some CI setups).                                   |
| Skill installed but the agent ignores it               | Check the agent's documentation — most require the directory name to equal the `name` frontmatter field, which `skill-indexer` warns about during validation. |
