import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  Manifest,
  ManifestEntry,
  OverwriteMode,
  SkillSyncConfig,
  Target,
  ValidatedSkill,
} from '../types.js';
import { TARGET_DIRS } from '../targets.js';
import { copyDir, ensureDir, isDirectory, pathExists, removeDir } from '../utils/fs.js';
import { buildManifest, manifestPath, readManifest, writeManifest } from './manifest.js';

export interface InstallOptions {
  config: SkillSyncConfig;
}

export type InstallAction = 'created' | 'overwritten' | 'merged' | 'skipped';

export interface InstallEntryReport {
  skill: ValidatedSkill;
  target: Target;
  dest: string;
  action: InstallAction;
  /** Bytes that *would* be written; only filled in dry-run mode. */
  dryRun: boolean;
}

export interface InstallReport {
  entries: InstallEntryReport[];
  manifest: Manifest;
  dryRun: boolean;
}

/**
 * Copy each validated skill into each target's project-local directory, then
 * write a manifest describing the installation. In dry-run mode no filesystem
 * writes are performed but the report still describes the actions that *would*
 * be taken.
 */
export async function installSkills(
  skills: ValidatedSkill[],
  options: InstallOptions,
): Promise<InstallReport> {
  const { config } = options;
  const entries: InstallEntryReport[] = [];
  const manifestEntries: ManifestEntry[] = [];

  for (const skill of skills) {
    const targetEntries: ManifestEntry['targets'] = [];
    for (const target of config.targets) {
      const destRoot = path.resolve(config.cwd, TARGET_DIRS[target]);
      const dest = path.join(destRoot, skill.name);
      const action = await applyInstall(skill, dest, config.overwrite, config.dryRun);
      entries.push({ skill, target, dest, action, dryRun: config.dryRun });
      if (action !== 'skipped') {
        targetEntries.push({ target, dest });
      }
    }
    if (targetEntries.length > 0) {
      manifestEntries.push({
        name: skill.name,
        source: {
          packageName: skill.source.packageName,
          packageVersion: skill.source.packageVersion,
          kind: skill.source.kind,
        },
        targets: targetEntries,
        installedAt: new Date().toISOString(),
      });
    }
  }

  const manifest = await mergeManifest(config.cwd, manifestEntries);
  if (!config.dryRun) {
    await writeManifest(config.cwd, manifest);
  }
  return { entries, manifest, dryRun: config.dryRun };
}

async function applyInstall(
  skill: ValidatedSkill,
  dest: string,
  overwrite: OverwriteMode,
  dryRun: boolean,
): Promise<InstallAction> {
  const exists = await pathExists(dest);
  if (exists) {
    if (overwrite === 'skip') return 'skipped';
    if (overwrite === 'overwrite') {
      if (!dryRun) {
        await removeDir(dest);
        await copyDir(skill.dir, dest);
      }
      return 'overwritten';
    }
    if (overwrite === 'merge') {
      if (!dryRun) {
        await copyDir(skill.dir, dest);
      }
      return 'merged';
    }
  }
  if (!dryRun) {
    await ensureDir(path.dirname(dest));
    await copyDir(skill.dir, dest);
  }
  return 'created';
}

/**
 * Merge new install entries with any existing manifest entries.
 *
 * We replace any prior record for a skill name that was just (re)installed,
 * but preserve entries for skills that aren't touched by the current run so
 * `clean` can still remove them later.
 */
async function mergeManifest(cwd: string, fresh: ManifestEntry[]): Promise<Manifest> {
  const prior = await readManifest(cwd);
  const byName = new Map<string, ManifestEntry>();
  if (prior) {
    for (const entry of prior.entries) {
      byName.set(entry.name, entry);
    }
  }
  for (const entry of fresh) {
    byName.set(entry.name, entry);
  }
  return buildManifest([...byName.values()].sort((a, b) => a.name.localeCompare(b.name)));
}

/**
 * Remove installed skills described in the manifest for the given targets.
 * Returns the list of paths that were removed (or would be removed in dry-run).
 */
export async function cleanInstalled(
  cwd: string,
  targets: Target[],
  options: { dryRun?: boolean } = {},
): Promise<{ removed: string[]; manifest: Manifest }> {
  const manifest = (await readManifest(cwd)) ?? buildManifest([]);
  const targetSet = new Set(targets);
  const removed: string[] = [];
  const remaining: ManifestEntry[] = [];

  for (const entry of manifest.entries) {
    const keepTargets: ManifestEntry['targets'] = [];
    for (const t of entry.targets) {
      if (!targetSet.has(t.target)) {
        keepTargets.push(t);
        continue;
      }
      if (await isDirectory(t.dest)) {
        if (!options.dryRun) await removeDir(t.dest);
        removed.push(t.dest);
      }
    }
    if (keepTargets.length > 0) {
      remaining.push({ ...entry, targets: keepTargets });
    }
  }

  const next = buildManifest(remaining);
  if (!options.dryRun) {
    if (remaining.length === 0) {
      const file = manifestPath(cwd);
      if (await pathExists(file)) await fs.unlink(file);
    } else {
      await writeManifest(cwd, next);
    }
  }
  return { removed, manifest: next };
}
