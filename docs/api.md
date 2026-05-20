# Programmatic API

All symbols exported by `skill-indexer` are typed and stable within a major version.

```ts
import {
  loadConfig,
  scanAll,
  resolveSkills,
  installSkills,
  cleanInstalled,
  validateSkill,
  ALL_TARGETS,
  TARGET_DIRS,
} from 'skill-indexer';

import type {
  Target,
  SkillSyncConfig,
  ValidatedSkill,
  ValidationResult,
  Manifest,
  ResolveReport,
  InstallReport,
} from 'skill-indexer';
```

## End-to-end pipeline

```ts
const { config } = await loadConfig({
  cwd: process.cwd(),
  overrides: { targets: ['cursor', 'claude'] },
});

const candidates = await scanAll({ cwd: config.cwd, scan: config.scan });
const report = await resolveSkills(candidates, config);

if (report.invalid.length) {
  console.warn(
    `Skipped ${report.invalid.length} candidate(s) – run \`skill-indexer list\` for details.`,
  );
}

const result = await installSkills(report.skills, { config });
for (const entry of result.entries) {
  console.log(entry.action, entry.skill.name, '->', entry.dest);
}
```

## Functions

### `loadConfig(options?): Promise<LoadedConfig>`

Merges defaults + `package.json#skillIndexer` + `skill-indexer.config.json` + explicit `overrides`. Returns the finalized `SkillSyncConfig` plus a `sources` record describing where each fragment came from.

### `scanAll({ cwd, scan }): Promise<SkillCandidate[]>`

Discovers every skill candidate reachable from `cwd`. The default scan mode is `declared-first`: packages with `agents.skills`, `agents.experimentalSkills`, or `agents.skillsDir` use those declarations; packages without declarations fall back to `skills/<name>/SKILL.md`. Symlinks are dereferenced and pnpm flat stores are walked.

### `validateSkill(candidate, { strict? }): Promise<ValidationResult>`

Reads and validates `<candidate>/SKILL.md`. Always returns a structured result; never throws on bad input. Promotes warnings to errors in `strict` mode.

### `resolveSkills(candidates, config): Promise<ResolveReport>`

Applies `include` / `exclude`, filters experimental skills unless `config.experimental` is true, validates each candidate, then resolves same-name conflicts. Throws `SkillSyncConflictError` only when `config.onConflict === 'error'`.

### `installSkills(skills, { config }): Promise<InstallReport>`

Copies each skill to each `target` directory under `config.cwd`. Respects `config.overwrite` and `config.dryRun`. Writes (or merges) the manifest unless dry-running.

### `cleanInstalled(cwd, targets, { dryRun? }): Promise<{ removed, manifest }>`

Removes installed skill directories listed in the manifest for the given targets and rewrites the manifest. Deletes the manifest file entirely if no entries remain. Hand-written, non-manifest paths are untouched.

## Types

See [`src/types.ts`](../src/types.ts) for the authoritative definitions. Key shapes:

```ts
type Target = 'cursor' | 'codex' | 'claude' | 'copilot' | 'amp' | 'opencode' | 'goose';

interface SkillSyncConfig {
  cwd: string;
  targets: Target[];
  include: string[];
  exclude: string[];
  scan: {
    mode?: 'declared-first' | 'both' | 'convention' | 'declarative';
    convention: boolean;
    declarative: boolean;
  };
  overwrite: 'skip' | 'overwrite' | 'merge';
  strict: boolean;
  onConflict: 'error' | 'first-wins' | 'last-wins' | 'keep-both';
  dryRun: boolean;
  experimental: boolean;
}

interface ValidatedSkill {
  name: string;
  originalName: string;
  description: string;
  frontmatter: Record<string, unknown>;
  channel: 'stable' | 'experimental';
  dir: string;
  skillMdPath: string;
  dirName: string;
  source: {
    kind: 'convention' | 'declarative' | 'local';
    packageName: string;
    packageVersion?: string;
    packageRoot: string;
  };
  warnings: string[];
  lines: number;
}

interface InstallReport {
  dryRun: boolean;
  entries: Array<{
    skill: ValidatedSkill;
    target: Target;
    dest: string;
    action: 'created' | 'overwritten' | 'merged' | 'skipped';
  }>;
  manifest: Manifest;
}
```
