import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface TempProject {
  root: string;
  cleanup: () => Promise<void>;
  /**
   * Create a "package" inside node_modules. By default the package is placed
   * at `node_modules/<name>` (mirroring npm's hoisted layout). Set `pnpm` to
   * an arbitrary id to nest it under `node_modules/.pnpm/<id>/node_modules/<name>`
   * instead, simulating pnpm's flat store.
   */
  mkPackage: (
    name: string,
    options?: { version?: string; agents?: unknown; pnpm?: string },
  ) => Promise<string>;
  writeSkill: (
    inside: string,
    skillName: string,
    body: { name?: string; description?: string; extra?: Record<string, unknown>; bodyText?: string },
    options?: { folder?: string; rawFrontmatter?: string },
  ) => Promise<string>;
  writeFile: (rel: string, contents: string) => Promise<string>;
  exists: (rel: string) => Promise<boolean>;
}

export async function createTempProject(): Promise<TempProject> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-indexer-test-'));
  await fs.writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'consumer', version: '0.0.0' }, null, 2),
  );

  const mkPackage: TempProject['mkPackage'] = async (name, opts = {}) => {
    let pkgRoot: string;
    if (opts.pnpm) {
      pkgRoot = path.join(root, 'node_modules', '.pnpm', opts.pnpm, 'node_modules', name);
    } else {
      pkgRoot = path.join(root, 'node_modules', name);
    }
    await fs.mkdir(pkgRoot, { recursive: true });
    const pkgJson: Record<string, unknown> = {
      name,
      version: opts.version ?? '1.0.0',
    };
    if (opts.agents) pkgJson.agents = opts.agents;
    await fs.writeFile(path.join(pkgRoot, 'package.json'), JSON.stringify(pkgJson, null, 2));
    return pkgRoot;
  };

  const writeSkill: TempProject['writeSkill'] = async (
    inside,
    skillName,
    body,
    options = {},
  ) => {
    const folder = options.folder ?? skillName;
    const dir = path.join(inside, 'skills', folder);
    await fs.mkdir(dir, { recursive: true });
    const skillMd = path.join(dir, 'SKILL.md');
    const fm = options.rawFrontmatter ?? buildFrontmatter(body);
    const bodyText = body.bodyText ?? '# ' + (body.name ?? skillName) + '\n\nDoc body.';
    await fs.writeFile(skillMd, `${fm}\n${bodyText}\n`);
    return dir;
  };

  const writeFile: TempProject['writeFile'] = async (rel, contents) => {
    const full = path.join(root, rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, contents);
    return full;
  };

  const exists: TempProject['exists'] = async (rel) => {
    try {
      await fs.access(path.join(root, rel));
      return true;
    } catch {
      return false;
    }
  };

  const cleanup = async () => {
    await fs.rm(root, { recursive: true, force: true });
  };
  return { root, cleanup, mkPackage, writeSkill, writeFile, exists };
}

function buildFrontmatter(body: {
  name?: string;
  description?: string;
  extra?: Record<string, unknown>;
}): string {
  const lines: string[] = ['---'];
  if (body.name !== undefined) lines.push(`name: ${body.name}`);
  if (body.description !== undefined) lines.push(`description: ${JSON.stringify(body.description)}`);
  if (body.extra) {
    for (const [k, v] of Object.entries(body.extra)) {
      lines.push(`${k}: ${typeof v === 'string' ? JSON.stringify(v) : String(v)}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}
