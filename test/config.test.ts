import path from 'node:path';
import { promises as fs } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/load.js';
import { createTempProject, type TempProject } from './helpers/tempProject.js';

describe('loadConfig', () => {
  let project: TempProject;
  beforeEach(async () => {
    project = await createTempProject();
  });
  afterEach(async () => {
    await project.cleanup();
  });

  it('reads `skillIndexer` field from package.json', async () => {
    await fs.writeFile(
      path.join(project.root, 'package.json'),
      JSON.stringify(
        {
          name: 'consumer',
          version: '0.0.0',
          skillIndexer: {
            targets: ['cursor', 'claude'],
            include: ['@my/*'],
            overwrite: 'overwrite',
          },
        },
        null,
        2,
      ),
    );
    const { config, sources } = await loadConfig({ cwd: project.root });
    expect(config.targets).toEqual(['cursor', 'claude']);
    expect(config.include).toEqual(['@my/*']);
    expect(config.overwrite).toBe('overwrite');
    expect(sources.packageJson).toBeTruthy();
  });

  it('reads skill-indexer.config.json and merges with package.json', async () => {
    await fs.writeFile(
      path.join(project.root, 'package.json'),
      JSON.stringify({ name: 'consumer', skillIndexer: { targets: ['cursor'] } }),
    );
    await fs.writeFile(
      path.join(project.root, 'skill-indexer.config.json'),
      JSON.stringify({ targets: ['codex', 'claude'], strict: true }),
    );
    const { config, sources } = await loadConfig({ cwd: project.root });
    expect(config.targets).toEqual(['codex', 'claude']);
    expect(config.strict).toBe(true);
    expect(sources.file).toBeTruthy();
    expect(sources.packageJson).toBeTruthy();
  });

  it('applies CLI overrides last', async () => {
    await fs.writeFile(
      path.join(project.root, 'package.json'),
      JSON.stringify({ name: 'consumer', skillIndexer: { targets: ['cursor'] } }),
    );
    const { config } = await loadConfig({
      cwd: project.root,
      overrides: { targets: ['claude'], dryRun: true },
    });
    expect(config.targets).toEqual(['claude']);
    expect(config.dryRun).toBe(true);
  });

  it('expands targets=all to every supported tool', async () => {
    const { config } = await loadConfig({
      cwd: project.root,
      overrides: { targets: 'all' },
    });
    expect(config.targets.length).toBeGreaterThan(3);
    expect(config.targets).toContain('cursor');
    expect(config.targets).toContain('codex');
    expect(config.targets).toContain('claude');
  });

  it('throws on unknown target', async () => {
    await expect(
      loadConfig({
        cwd: project.root,
        overrides: { targets: ['bogus'] },
      }),
    ).rejects.toThrow(/Unknown target/);
  });

  it('throws on invalid overwrite mode', async () => {
    await expect(
      loadConfig({
        cwd: project.root,
        overrides: { overwrite: 'invalid-mode' as never },
      }),
    ).rejects.toThrow(/overwrite/);
  });

  it('uses safe defaults when no config is found', async () => {
    const { config } = await loadConfig({ cwd: project.root });
    expect(config.targets).toEqual([]);
    expect(config.scan).toEqual({
      mode: 'declared-first',
      convention: true,
      declarative: true,
    });
    expect(config.overwrite).toBe('skip');
    expect(config.strict).toBe(false);
    expect(config.onConflict).toBe('first-wins');
    expect(config.experimental).toBe(false);
  });
});
