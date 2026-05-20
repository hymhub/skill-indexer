import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import matter from 'gray-matter';
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
    const contentHash = await hashDirectory(skill.dir);
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
        originalName: skill.originalName !== skill.name ? skill.originalName : undefined,
        channel: skill.channel,
        contentHash,
        source: {
          packageName: skill.source.packageName,
          packageVersion: skill.source.packageVersion,
          kind: skill.source.kind,
          path: skill.declaredPath ?? relativeSourcePath(skill),
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
        await copySkillDir(skill, dest);
      }
      return 'overwritten';
    }
    if (overwrite === 'merge') {
      if (!dryRun) {
        await copySkillDir(skill, dest);
      }
      return 'merged';
    }
  }
  if (!dryRun) {
    await ensureDir(path.dirname(dest));
    await copySkillDir(skill, dest);
  }
  return 'created';
}

async function copySkillDir(skill: ValidatedSkill, dest: string): Promise<void> {
  await copyDir(skill.dir, dest);
  if (skill.originalName !== skill.name) {
    await rewriteSkillName(path.join(dest, 'SKILL.md'), skill.name);
  }
}

async function rewriteSkillName(skillMdPath: string, name: string): Promise<void> {
  const raw = await fs.readFile(skillMdPath, 'utf8');
  const parsed = matter(raw);
  const data = { ...parsed.data, name };
  await fs.writeFile(skillMdPath, matter.stringify(parsed.content, data), 'utf8');
}

function relativeSourcePath(skill: ValidatedSkill): string {
  return path.relative(skill.source.packageRoot, skill.dir).split(path.sep).join('/');
}

async function hashDirectory(dir: string): Promise<string> {
  const hash = createHash('sha256');
  const files = await collectFiles(dir);
  for (const file of files) {
    const rel = path.relative(dir, file).split(path.sep).join('/');
    hash.update(rel);
    hash.update('\0');
    hash.update(await fs.readFile(file));
    hash.update('\0');
  }
  return `sha256-${hash.digest('hex')}`;
}

async function collectFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await collectFiles(full)));
    } else if (entry.isSymbolicLink()) {
      const real = await fs.realpath(full);
      const stat = await fs.stat(real);
      if (stat.isDirectory()) {
        out.push(...(await collectFiles(real)));
      } else if (stat.isFile()) {
        out.push(real);
      }
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
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
