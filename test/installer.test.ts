import path from 'node:path';
import { promises as fs } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanInstalled, installSkills } from '../src/core/installer.js';
import { scanAll } from '../src/core/scanner.js';
import { resolveSkills } from '../src/core/resolver.js';
import { DEFAULT_CONFIG } from '../src/config/defaults.js';
import { readManifest, manifestPath } from '../src/core/manifest.js';
import type { SkillSyncConfig } from '../src/types.js';
import { createTempProject, type TempProject } from './helpers/tempProject.js';

async function prepareSkills(project: TempProject, partial: Partial<SkillSyncConfig> = {}) {
  const config: SkillSyncConfig = {
    ...DEFAULT_CONFIG,
    cwd: project.root,
    targets: ['cursor', 'codex'],
    ...partial,
  };
  const candidates = await scanAll({ cwd: project.root, scan: config.scan });
  const report = await resolveSkills(candidates, config);
  return { config, skills: report.skills };
}

describe('installSkills', () => {
  let project: TempProject;
  beforeEach(async () => {
    project = await createTempProject();
  });
  afterEach(async () => {
    await project.cleanup();
  });

  it('copies each validated skill into every target directory', async () => {
    const pkg = await project.mkPackage('lib-a');
    await project.writeSkill(pkg, 'alpha', { name: 'alpha', description: 'd' });
    const { config, skills } = await prepareSkills(project);
    const report = await installSkills(skills, { config });
    expect(report.dryRun).toBe(false);
    expect(await project.exists('.cursor/skills/alpha/SKILL.md')).toBe(true);
    expect(await project.exists('.codex/skills/alpha/SKILL.md')).toBe(true);
    expect(report.entries.every((e) => e.action === 'created')).toBe(true);
  });

  it('writes a manifest describing every installed target', async () => {
    const pkg = await project.mkPackage('lib-b');
    await project.writeSkill(pkg, 'beta', { name: 'beta', description: 'd' });
    const { config, skills } = await prepareSkills(project);
    await installSkills(skills, { config });
    const manifest = await readManifest(project.root);
    expect(manifest?.entries).toHaveLength(1);
    expect(manifest?.entries[0]?.name).toBe('beta');
    expect(manifest?.entries[0]?.targets.map((t) => t.target).sort()).toEqual(['codex', 'cursor']);
    expect(manifest?.entries[0]?.source.packageName).toBe('lib-b');
  });

  it('dry-run leaves no files on disk but reports actions', async () => {
    const pkg = await project.mkPackage('lib-c');
    await project.writeSkill(pkg, 'gamma', { name: 'gamma', description: 'd' });
    const { config, skills } = await prepareSkills(project, { dryRun: true });
    const report = await installSkills(skills, { config });
    expect(report.dryRun).toBe(true);
    expect(report.entries.every((e) => e.action === 'created')).toBe(true);
    expect(await project.exists('.cursor/skills/gamma/SKILL.md')).toBe(false);
    expect(await project.exists(path.basename(manifestPath(project.root)))).toBe(false);
  });

  it('overwrite=skip leaves existing skills untouched', async () => {
    const pkg = await project.mkPackage('lib-d');
    await project.writeSkill(pkg, 'delta', { name: 'delta', description: 'd' });
    const targetFile = path.join(project.root, '.cursor/skills/delta/SKILL.md');
    await fs.mkdir(path.dirname(targetFile), { recursive: true });
    await fs.writeFile(targetFile, 'PRE-EXISTING\n');

    const { config, skills } = await prepareSkills(project, {
      targets: ['cursor'],
      overwrite: 'skip',
    });
    const report = await installSkills(skills, { config });
    expect(report.entries[0]?.action).toBe('skipped');
    const after = await fs.readFile(targetFile, 'utf8');
    expect(after).toBe('PRE-EXISTING\n');
  });

  it('overwrite=overwrite replaces the existing directory entirely', async () => {
    const pkg = await project.mkPackage('lib-e');
    await project.writeSkill(pkg, 'epsilon', { name: 'epsilon', description: 'd' });
    const oldFile = path.join(project.root, '.cursor/skills/epsilon/old.txt');
    await fs.mkdir(path.dirname(oldFile), { recursive: true });
    await fs.writeFile(oldFile, 'OLD');

    const { config, skills } = await prepareSkills(project, {
      targets: ['cursor'],
      overwrite: 'overwrite',
    });
    await installSkills(skills, { config });
    expect(await project.exists('.cursor/skills/epsilon/old.txt')).toBe(false);
    expect(await project.exists('.cursor/skills/epsilon/SKILL.md')).toBe(true);
  });
});

describe('cleanInstalled', () => {
  let project: TempProject;
  beforeEach(async () => {
    project = await createTempProject();
  });
  afterEach(async () => {
    await project.cleanup();
  });

  it('removes installed skills for the requested targets and rewrites the manifest', async () => {
    const pkg = await project.mkPackage('lib-f');
    await project.writeSkill(pkg, 'zeta', { name: 'zeta', description: 'd' });
    const { config, skills } = await prepareSkills(project, {
      targets: ['cursor', 'codex'],
    });
    await installSkills(skills, { config });
    expect(await project.exists('.cursor/skills/zeta/SKILL.md')).toBe(true);

    const result = await cleanInstalled(project.root, ['cursor']);
    expect(result.removed.length).toBe(1);
    expect(await project.exists('.cursor/skills/zeta/SKILL.md')).toBe(false);
    expect(await project.exists('.codex/skills/zeta/SKILL.md')).toBe(true);
    const manifest = await readManifest(project.root);
    expect(manifest?.entries[0]?.targets.map((t) => t.target)).toEqual(['codex']);
  });

  it('dry-run clean leaves files in place and reports paths', async () => {
    const pkg = await project.mkPackage('lib-g');
    await project.writeSkill(pkg, 'eta', { name: 'eta', description: 'd' });
    const { config, skills } = await prepareSkills(project, {
      targets: ['cursor'],
    });
    await installSkills(skills, { config });
    const result = await cleanInstalled(project.root, ['cursor'], { dryRun: true });
    expect(result.removed.length).toBe(1);
    expect(await project.exists('.cursor/skills/eta/SKILL.md')).toBe(true);
  });
});
