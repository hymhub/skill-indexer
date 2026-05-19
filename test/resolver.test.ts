import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveSkills, SkillSyncConflictError } from '../src/core/resolver.js';
import { scanAll } from '../src/core/scanner.js';
import { DEFAULT_CONFIG } from '../src/config/defaults.js';
import type { SkillSyncConfig } from '../src/types.js';
import { createTempProject, type TempProject } from './helpers/tempProject.js';

function configFor(project: TempProject, partial: Partial<SkillSyncConfig> = {}): SkillSyncConfig {
  return {
    ...DEFAULT_CONFIG,
    cwd: project.root,
    targets: ['cursor'],
    ...partial,
  };
}

describe('resolveSkills', () => {
  let project: TempProject;
  beforeEach(async () => {
    project = await createTempProject();
  });
  afterEach(async () => {
    await project.cleanup();
  });

  it('keeps valid skills and surfaces invalid ones in report.invalid', async () => {
    const a = await project.mkPackage('a-pkg');
    await project.writeSkill(a, 'good', { name: 'good', description: 'g' });
    const b = await project.mkPackage('b-pkg');
    await project.writeSkill(b, 'bad', { name: 'BAD', description: 'b' });

    const candidates = await scanAll({ cwd: project.root, scan: DEFAULT_CONFIG.scan });
    const result = await resolveSkills(candidates, configFor(project));
    expect(result.skills.map((s) => s.name)).toContain('good');
    expect(result.invalid.length).toBe(1);
    expect(result.invalid[0]?.candidate.dirName).toBe('bad');
  });

  it('filters by exclude pattern', async () => {
    const a = await project.mkPackage('keep-me');
    await project.writeSkill(a, 's1', { name: 's1', description: 'd' });
    const b = await project.mkPackage('skip-me');
    await project.writeSkill(b, 's2', { name: 's2', description: 'd' });

    const candidates = await scanAll({ cwd: project.root, scan: DEFAULT_CONFIG.scan });
    const result = await resolveSkills(
      candidates,
      configFor(project, { exclude: ['skip-*'] }),
    );
    expect(result.skills.map((s) => s.name).sort()).toEqual(['s1']);
    expect(result.filtered.some((f) => f.candidate.source.packageName === 'skip-me')).toBe(true);
  });

  it('filters by include pattern (only listed packages pass)', async () => {
    const a = await project.mkPackage('@team/wanted');
    await project.writeSkill(a, 's1', { name: 's1', description: 'd' });
    const b = await project.mkPackage('@team/extra');
    await project.writeSkill(b, 's2', { name: 's2', description: 'd' });
    const c = await project.mkPackage('outsider');
    await project.writeSkill(c, 's3', { name: 's3', description: 'd' });

    const candidates = await scanAll({ cwd: project.root, scan: DEFAULT_CONFIG.scan });
    const result = await resolveSkills(
      candidates,
      configFor(project, { include: ['@team/*'] }),
    );
    expect(result.skills.map((s) => s.name).sort()).toEqual(['s1', 's2']);
  });

  it('first-wins on duplicate names', async () => {
    const a = await project.mkPackage('alpha-pkg');
    await project.writeSkill(a, 'shared', { name: 'shared', description: 'a' });
    const b = await project.mkPackage('beta-pkg');
    await project.writeSkill(b, 'shared', { name: 'shared', description: 'b' });

    const candidates = await scanAll({ cwd: project.root, scan: DEFAULT_CONFIG.scan });
    const result = await resolveSkills(
      candidates,
      configFor(project, { onConflict: 'first-wins' }),
    );
    expect(result.skills).toHaveLength(1);
    expect(result.conflicts).toHaveLength(1);
    expect(result.skills[0]?.source.packageName).toBe('alpha-pkg');
  });

  it('last-wins on duplicate names', async () => {
    const a = await project.mkPackage('alpha-pkg');
    await project.writeSkill(a, 'shared', { name: 'shared', description: 'a' });
    const b = await project.mkPackage('beta-pkg');
    await project.writeSkill(b, 'shared', { name: 'shared', description: 'b' });

    const candidates = await scanAll({ cwd: project.root, scan: DEFAULT_CONFIG.scan });
    const result = await resolveSkills(
      candidates,
      configFor(project, { onConflict: 'last-wins' }),
    );
    expect(result.skills).toHaveLength(1);
    expect(result.skills[0]?.source.packageName).toBe('beta-pkg');
  });

  it('throws on conflict when mode is "error"', async () => {
    const a = await project.mkPackage('alpha-pkg');
    await project.writeSkill(a, 'shared', { name: 'shared', description: 'a' });
    const b = await project.mkPackage('beta-pkg');
    await project.writeSkill(b, 'shared', { name: 'shared', description: 'b' });
    const candidates = await scanAll({ cwd: project.root, scan: DEFAULT_CONFIG.scan });
    await expect(
      resolveSkills(candidates, configFor(project, { onConflict: 'error' })),
    ).rejects.toBeInstanceOf(SkillSyncConflictError);
  });

  it('local source always wins over dependencies regardless of mode', async () => {
    await project.writeSkill(project.root, 'shared', { name: 'shared', description: 'local' });
    const a = await project.mkPackage('dep-pkg');
    await project.writeSkill(a, 'shared', { name: 'shared', description: 'remote' });

    const candidates = await scanAll({ cwd: project.root, scan: DEFAULT_CONFIG.scan });
    const result = await resolveSkills(
      candidates,
      configFor(project, { onConflict: 'last-wins' }),
    );
    expect(result.skills).toHaveLength(1);
    expect(result.skills[0]?.source.kind).toBe('local');
  });
});
