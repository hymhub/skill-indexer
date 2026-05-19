import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTempProject, type TempProject } from './helpers/tempProject.js';

const execFileAsync = promisify(execFile);
const CLI = path.resolve(__dirname, '..', 'dist', 'cli.js');

async function ensureCliBuilt() {
  try {
    await fs.access(CLI);
  } catch {
    throw new Error(`CLI bundle not found at ${CLI}. Run \`npm run build\` first.`);
  }
}

async function runCli(args: string[], cwd: string) {
  return await execFileAsync(process.execPath, [CLI, ...args], { cwd });
}

describe('cli (integration)', () => {
  let project: TempProject;
  beforeEach(async () => {
    await ensureCliBuilt();
    project = await createTempProject();
  });
  afterEach(async () => {
    await project.cleanup();
  });

  it('install --target cursor copies skills end-to-end', async () => {
    const pkg = await project.mkPackage('the-lib');
    await project.writeSkill(pkg, 'first', { name: 'first', description: 'desc' });

    const { stdout } = await runCli(['install', '-t', 'cursor', '--json'], project.root);
    const parsed = JSON.parse(stdout);
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0].action).toBe('created');
    expect(await project.exists('.cursor/skills/first/SKILL.md')).toBe(true);
    expect(await project.exists('.skill-indexer.manifest.json')).toBe(true);
  });

  it('list --json reports discovered + invalid candidates', async () => {
    const pkg = await project.mkPackage('lib-list');
    await project.writeSkill(pkg, 'good', { name: 'good', description: 'd' });
    await project.writeSkill(pkg, 'BAD', { name: 'BAD', description: 'd' });

    const { stdout } = await runCli(['list', '-t', 'cursor', '--json'], project.root);
    const parsed = JSON.parse(stdout);
    expect(parsed.skills.map((s: { name: string }) => s.name)).toContain('good');
    expect(parsed.invalid.length).toBeGreaterThanOrEqual(1);
  });

  it('validate exits non-zero when invalid', async () => {
    const dir = path.join(project.root, 'broken');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'SKILL.md'), '# no frontmatter\n');
    await expect(runCli(['validate', dir], project.root)).rejects.toMatchObject({
      code: 1,
    });
  });

  it('clean removes previously installed skills and manifest', async () => {
    const pkg = await project.mkPackage('lib-clean');
    await project.writeSkill(pkg, 'cleanme', { name: 'cleanme', description: 'd' });
    await runCli(['install', '-t', 'cursor'], project.root);
    expect(await project.exists('.cursor/skills/cleanme/SKILL.md')).toBe(true);
    await runCli(['clean', '-t', 'cursor'], project.root);
    expect(await project.exists('.cursor/skills/cleanme/SKILL.md')).toBe(false);
    expect(await project.exists('.skill-indexer.manifest.json')).toBe(false);
  });

  it('install --dry-run does not write files', async () => {
    const pkg = await project.mkPackage('dry-lib');
    await project.writeSkill(pkg, 'dry', { name: 'dry', description: 'd' });
    await runCli(['install', '-t', 'cursor', '--dry-run'], project.root);
    expect(await project.exists('.cursor/skills/dry/SKILL.md')).toBe(false);
    expect(await project.exists('.skill-indexer.manifest.json')).toBe(false);
  });
});
