import path from 'node:path';
import { promises as fs } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateSkill } from '../src/core/validator.js';
import type { SkillCandidate } from '../src/types.js';
import { createTempProject, type TempProject } from './helpers/tempProject.js';

function candidate(project: TempProject, dir: string, dirName?: string): SkillCandidate {
  return {
    source: { kind: 'local', packageName: '.', packageRoot: project.root },
    dir,
    skillMdPath: path.join(dir, 'SKILL.md'),
    dirName: dirName ?? path.basename(dir),
  };
}

describe('validateSkill', () => {
  let project: TempProject;

  beforeEach(async () => {
    project = await createTempProject();
  });
  afterEach(async () => {
    await project.cleanup();
  });

  it('accepts a well-formed skill', async () => {
    const dir = await project.writeSkill(project.root, 'my-skill', {
      name: 'my-skill',
      description: 'Does a useful thing.',
    });
    const result = await validateSkill(candidate(project, dir));
    expect(result.valid).toBe(true);
    expect(result.skill?.name).toBe('my-skill');
    expect(result.skill?.description).toBe('Does a useful thing.');
    expect(result.skill?.warnings).toEqual([]);
  });

  it('rejects missing frontmatter', async () => {
    const dir = path.join(project.root, 'no-fm');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'SKILL.md'), '# Hello\nNo frontmatter here.\n');
    const result = await validateSkill(candidate(project, dir));
    expect(result.valid).toBe(false);
    expect(result.issues.map((i) => i.message).join('\n')).toMatch(/frontmatter|required/);
  });

  it('rejects invalid name', async () => {
    const dir = await project.writeSkill(project.root, 'BadName', {
      name: 'BadName',
      description: 'desc',
    });
    const result = await validateSkill(candidate(project, dir, 'BadName'));
    expect(result.valid).toBe(false);
    expect(result.issues.find((i) => i.field === 'name')?.message).toMatch(/lowercase|match/);
  });

  it('rejects missing description', async () => {
    const dir = await project.writeSkill(project.root, 'no-desc', {
      name: 'no-desc',
      description: '',
    });
    const result = await validateSkill(candidate(project, dir));
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.field === 'description')).toBe(true);
  });

  it('rejects name longer than 64 chars', async () => {
    const longName = 'a'.repeat(70);
    const dir = await project.writeSkill(project.root, longName, {
      name: longName,
      description: 'desc',
    });
    const result = await validateSkill(candidate(project, dir, longName));
    expect(result.valid).toBe(false);
    const msg = result.issues.find((i) => i.field === 'name')?.message ?? '';
    expect(msg.toLowerCase()).toMatch(/64|characters|match/);
  });

  it('rejects description over 1024 chars', async () => {
    const longDesc = 'x'.repeat(1100);
    const dir = await project.writeSkill(project.root, 'long-desc', {
      name: 'long-desc',
      description: longDesc,
    });
    const result = await validateSkill(candidate(project, dir));
    expect(result.valid).toBe(false);
    expect(result.issues.find((i) => i.field === 'description')?.message).toMatch(/1024/);
  });

  it('warns when directory name does not match `name`', async () => {
    const dir = await project.writeSkill(
      project.root,
      'real-name',
      { name: 'real-name', description: 'desc' },
      { folder: 'different-folder' },
    );
    const result = await validateSkill(candidate(project, dir, 'different-folder'));
    expect(result.valid).toBe(true);
    expect(result.skill?.warnings.some((w) => /does not match/.test(w))).toBe(true);
  });

  it('strict mode promotes warnings to errors', async () => {
    const dir = await project.writeSkill(
      project.root,
      'real-name',
      { name: 'real-name', description: 'desc' },
      { folder: 'different-folder' },
    );
    const result = await validateSkill(candidate(project, dir, 'different-folder'), {
      strict: true,
    });
    expect(result.valid).toBe(false);
  });

  it('warns on SKILL.md exceeding the soft line limit', async () => {
    const dir = await project.writeSkill(project.root, 'huge', {
      name: 'huge',
      description: 'desc',
      bodyText: '# Huge\n' + 'line\n'.repeat(600),
    });
    const result = await validateSkill(candidate(project, dir));
    expect(result.valid).toBe(true);
    expect(result.skill?.warnings.some((w) => /lines/.test(w))).toBe(true);
  });
});
