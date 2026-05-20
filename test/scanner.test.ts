import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scanAll } from '../src/core/scanner.js';
import { createTempProject, type TempProject } from './helpers/tempProject.js';

const SCAN_BOTH = { convention: true, declarative: true };

describe('scanAll', () => {
  let project: TempProject;
  beforeEach(async () => {
    project = await createTempProject();
  });
  afterEach(async () => {
    await project.cleanup();
  });

  it('finds skills via convention scan in node_modules', async () => {
    const pkg = await project.mkPackage('convention-pkg');
    await project.writeSkill(pkg, 'cool', { name: 'cool', description: 'desc' });
    const found = await scanAll({ cwd: project.root, scan: SCAN_BOTH });
    const names = found.map((c) => `${c.source.packageName}::${c.dirName}`);
    expect(names).toContain('convention-pkg::cool');
    const cool = found.find((c) => c.dirName === 'cool')!;
    expect(cool.source.kind).toBe('convention');
    expect(cool.source.packageVersion).toBe('1.0.0');
  });

  it('finds skills via declarative agents.skills field', async () => {
    await project.mkPackage('declarative-pkg', {
      agents: { skills: [{ name: 'task', path: './custom/task' }] },
    });
    await project.writeFile(
      `node_modules/declarative-pkg/custom/task/SKILL.md`,
      ['---', 'name: task', 'description: "Do task"', '---', '# Task'].join('\n'),
    );
    const found = await scanAll({ cwd: project.root, scan: SCAN_BOTH });
    const decl = found.find((c) => c.source.kind === 'declarative');
    expect(decl).toBeTruthy();
    expect(decl?.source.packageName).toBe('declarative-pkg');
    expect(decl?.dirName).toBe('task');
  });

  it('handles scoped packages and skips non-skill folders', async () => {
    const scopedPkg = await project.mkPackage('@scoped/utils');
    await project.writeSkill(scopedPkg, 'helper', { name: 'helper', description: 'helps' });
    const noSkillPkg = await project.mkPackage('no-skills');
    await project.writeFile(`${noSkillPkg}/index.js`.replace(project.root + '/', ''), '');
    const found = await scanAll({ cwd: project.root, scan: SCAN_BOTH });
    const scoped = found.find((c) => c.source.packageName === '@scoped/utils');
    expect(scoped?.dirName).toBe('helper');
    expect(found.some((c) => c.source.packageName === 'no-skills')).toBe(false);
  });

  it('discovers skills inside pnpm-style flat node_modules', async () => {
    const pkg = await project.mkPackage('pnpm-pkg', { pnpm: 'pnpm-pkg@1.0.0' });
    await project.writeSkill(pkg, 'sk', { name: 'sk', description: 'desc' });
    const found = await scanAll({ cwd: project.root, scan: SCAN_BOTH });
    expect(found.some((c) => c.source.packageName === 'pnpm-pkg' && c.dirName === 'sk')).toBe(true);
  });

  it('respects scan flags to disable convention or declarative scans', async () => {
    const pkg = await project.mkPackage('mix-pkg', {
      agents: { skills: [{ name: 'declared', path: './declared' }] },
    });
    await project.writeSkill(pkg, 'conv', { name: 'conv', description: 'd' });
    await project.writeFile(
      `node_modules/mix-pkg/declared/SKILL.md`,
      ['---', 'name: declared', 'description: "decl"', '---', '# Hi'].join('\n'),
    );

    const onlyConv = await scanAll({
      cwd: project.root,
      scan: { convention: true, declarative: false },
    });
    expect(onlyConv.some((c) => c.dirName === 'conv')).toBe(true);
    expect(onlyConv.some((c) => c.dirName === 'declared')).toBe(false);

    const onlyDecl = await scanAll({
      cwd: project.root,
      scan: { convention: false, declarative: true },
    });
    expect(onlyDecl.some((c) => c.dirName === 'conv')).toBe(false);
    expect(onlyDecl.some((c) => c.dirName === 'declared')).toBe(true);
  });

  it('uses declarative entries as the package authority in declared-first mode', async () => {
    const pkg = await project.mkPackage('declared-first-pkg', {
      agents: { skills: [{ name: 'declared', path: './declared' }] },
    });
    await project.writeSkill(pkg, 'convention-only', {
      name: 'convention-only',
      description: 'd',
    });
    await project.writeFile(
      `node_modules/declared-first-pkg/declared/SKILL.md`,
      ['---', 'name: declared', 'description: "decl"', '---', '# Declared'].join('\n'),
    );

    const found = await scanAll({ cwd: project.root, scan: SCAN_BOTH });
    expect(found.some((c) => c.dirName === 'declared')).toBe(true);
    expect(found.some((c) => c.dirName === 'convention-only')).toBe(false);

    const both = await scanAll({
      cwd: project.root,
      scan: { mode: 'both', convention: true, declarative: true },
    });
    expect(both.some((c) => c.dirName === 'declared')).toBe(true);
    expect(both.some((c) => c.dirName === 'convention-only')).toBe(true);
  });

  it('discovers experimental skills through the declarative field', async () => {
    await project.mkPackage('exp-pkg', {
      agents: { experimentalSkills: [{ name: 'future', path: './skills/future' }] },
    });
    await project.writeFile(
      `node_modules/exp-pkg/skills/future/SKILL.md`,
      ['---', 'name: future', 'description: "future"', '---', '# Future'].join('\n'),
    );

    const found = await scanAll({ cwd: project.root, scan: SCAN_BOTH });
    const future = found.find((c) => c.dirName === 'future');
    expect(future?.channel).toBe('experimental');
  });

  it("picks up the consumer project's own skills/ folder as local source", async () => {
    await project.writeSkill(project.root, 'own', { name: 'own', description: 'mine' });
    const found = await scanAll({ cwd: project.root, scan: SCAN_BOTH });
    const local = found.find((c) => c.source.kind === 'local');
    expect(local?.dirName).toBe('own');
    expect(local?.source.packageName).toBe('consumer');
  });
});
