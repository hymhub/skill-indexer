import { promises as fs, type Dirent } from 'node:fs';
import path from 'node:path';
import type {
  PackageJsonLike,
  ScanOptions,
  SkillCandidate,
  SkillSource,
} from '../types.js';
import { isDirectory, isFile, readJsonSafe } from '../utils/fs.js';

export interface ScanInput {
  cwd: string;
  scan: ScanOptions;
}

/**
 * Discover all skill candidates that can be installed into the project at `cwd`.
 *
 * - Convention scan: walks `node_modules` (including nested pnpm `.pnpm/<id>/node_modules/*`
 *   layouts and scoped packages) and reports every `skills/<name>/SKILL.md` directory.
 * - Declarative scan: reads each package's `package.json#agents.skills` field and reports
 *   the listed directories (matches the npm-agentskills convention).
 *
 * The local project itself (`cwd/skills/*`) is also included as a `local` source so users
 * can validate their own in-tree skills with the same toolchain.
 */
export async function scanAll(input: ScanInput): Promise<SkillCandidate[]> {
  const { cwd, scan } = input;
  const candidates: SkillCandidate[] = [];

  candidates.push(...(await scanLocalProject(cwd, scan)));

  const nodeModules = path.join(cwd, 'node_modules');
  if (!(await isDirectory(nodeModules))) {
    return candidates;
  }

  const packageRoots = await collectPackageRoots(nodeModules);
  for (const root of packageRoots) {
    const pkg = await readJsonSafe<PackageJsonLike>(path.join(root, 'package.json'));
    if (!pkg) continue;
    const source: SkillSource = {
      kind: 'convention',
      packageName: pkg.name ?? path.basename(root),
      packageVersion: pkg.version,
      packageRoot: root,
    };

    if (scan.convention) {
      candidates.push(...(await scanConventionDir(root, source)));
    }
    if (scan.declarative) {
      candidates.push(...(await scanDeclarative(root, pkg, source)));
    }
  }
  return candidates;
}

async function scanLocalProject(cwd: string, scan: ScanOptions): Promise<SkillCandidate[]> {
  const out: SkillCandidate[] = [];
  const pkg = (await readJsonSafe<PackageJsonLike>(path.join(cwd, 'package.json'))) ?? {};
  const source: SkillSource = {
    kind: 'local',
    packageName: pkg.name ?? '.',
    packageVersion: pkg.version,
    packageRoot: cwd,
  };
  if (scan.convention) {
    out.push(...(await scanConventionDir(cwd, source)));
  }
  if (scan.declarative) {
    out.push(...(await scanDeclarative(cwd, pkg, source)));
  }
  return out;
}

/**
 * Collect absolute paths to every installed package root inside a `node_modules`
 * directory, including:
 *   - top-level packages: node_modules/<name>
 *   - scoped packages:    node_modules/@scope/<name>
 *   - pnpm flat store:    node_modules/.pnpm/<id>/node_modules/<name|@scope/name>
 *
 * The result is deduplicated by realpath to avoid scanning the same package twice
 * when a pnpm hardlink and a top-level symlink point to the same location.
 */
async function collectPackageRoots(nodeModules: string): Promise<string[]> {
  const found = new Set<string>();
  const queue: string[] = [nodeModules];

  while (queue.length > 0) {
    const dir = queue.shift()!;
    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const name = entry.name;
      if (name === '.bin' || name === '.cache') continue;
      const full = path.join(dir, name);

      if (name === '.pnpm') {
        const pnpmEntries = await safeReaddir(full);
        for (const sub of pnpmEntries) {
          if (!sub.isDirectory() && !sub.isSymbolicLink()) continue;
          const nm = path.join(full, sub.name, 'node_modules');
          if (await isDirectory(nm)) queue.push(nm);
        }
        continue;
      }

      if (name.startsWith('@')) {
        const scopedEntries = await safeReaddir(full);
        for (const sub of scopedEntries) {
          if (!sub.isDirectory() && !sub.isSymbolicLink()) continue;
          await addPackageRoot(path.join(full, sub.name), found);
        }
        continue;
      }

      if (name.startsWith('.')) continue;
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      await addPackageRoot(full, found);
    }
  }
  return [...found].sort();
}

async function safeReaddir(p: string): Promise<Dirent[]> {
  try {
    return await fs.readdir(p, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function addPackageRoot(candidate: string, into: Set<string>): Promise<void> {
  let resolved = candidate;
  try {
    resolved = await fs.realpath(candidate);
  } catch {
    return;
  }
  if (!(await isFile(path.join(resolved, 'package.json')))) return;
  into.add(resolved);
}

/**
 * Convention scan inside a single package root: collect `<root>/skills/<name>/SKILL.md`.
 */
async function scanConventionDir(
  root: string,
  source: SkillSource,
): Promise<SkillCandidate[]> {
  const skillsDir = path.join(root, 'skills');
  if (!(await isDirectory(skillsDir))) return [];
  const entries = await safeReaddir(skillsDir);
  const out: SkillCandidate[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    const dir = path.join(skillsDir, entry.name);
    const skillMd = path.join(dir, 'SKILL.md');
    if (!(await isFile(skillMd))) continue;
    out.push({
      source: { ...source, kind: source.kind === 'local' ? 'local' : 'convention' },
      dir,
      skillMdPath: skillMd,
      dirName: entry.name,
    });
  }
  return out;
}

/**
 * Declarative scan: read `package.json#agents.skills` or `agents.skillsDir`
 * and resolve every entry relative to the package root.
 */
async function scanDeclarative(
  root: string,
  pkg: PackageJsonLike,
  source: SkillSource,
): Promise<SkillCandidate[]> {
  const out: SkillCandidate[] = [];
  const agents = pkg.agents;
  if (!agents) return out;

  const specs = Array.isArray(agents.skills) ? agents.skills : [];
  for (const spec of specs) {
    if (!spec || typeof spec.path !== 'string') continue;
    const dir = path.resolve(root, spec.path);
    const skillMd = path.join(dir, 'SKILL.md');
    if (!(await isFile(skillMd))) continue;
    out.push({
      source: { ...source, kind: source.kind === 'local' ? 'local' : 'declarative' },
      dir,
      skillMdPath: skillMd,
      dirName: spec.name ?? path.basename(dir),
    });
  }

  if (typeof agents.skillsDir === 'string') {
    const baseDir = path.resolve(root, agents.skillsDir);
    if (await isDirectory(baseDir)) {
      const entries = await safeReaddir(baseDir);
      for (const entry of entries) {
        if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
        const dir = path.join(baseDir, entry.name);
        const skillMd = path.join(dir, 'SKILL.md');
        if (!(await isFile(skillMd))) continue;
        out.push({
          source: { ...source, kind: source.kind === 'local' ? 'local' : 'declarative' },
          dir,
          skillMdPath: skillMd,
          dirName: entry.name,
        });
      }
    }
  }
  return out;
}
