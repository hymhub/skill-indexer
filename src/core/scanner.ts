import { promises as fs, type Dirent } from 'node:fs';
import path from 'node:path';
import type {
  DeclarativeSkillSpec,
  PackageJsonLike,
  ScanOptions,
  SkillChannel,
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

    const packagePlan = scanPlan(scan, pkg);

    if (packagePlan.convention) {
      candidates.push(...(await scanConventionDir(root, source)));
    }
    if (packagePlan.declarative) {
      candidates.push(...(await scanDeclarative(root, pkg, source)));
    }
  }
  return dedupeCandidates(candidates);
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
  const plan = scanPlan(scan, pkg);
  if (plan.convention) {
    out.push(...(await scanConventionDir(cwd, source)));
  }
  if (plan.declarative) {
    out.push(...(await scanDeclarative(cwd, pkg, source)));
  }
  return dedupeCandidates(out);
}

function scanPlan(
  scan: ScanOptions,
  pkg: PackageJsonLike,
): { convention: boolean; declarative: boolean } {
  const mode = scan.mode ?? deriveScanMode(scan);
  if (mode === 'convention') return { convention: scan.convention, declarative: false };
  if (mode === 'declarative') return { convention: false, declarative: scan.declarative };
  if (mode === 'both') return { convention: scan.convention, declarative: scan.declarative };

  const hasDeclared = hasDeclarativeSkills(pkg);
  return {
    convention: scan.convention && !hasDeclared,
    declarative: scan.declarative && hasDeclared,
  };
}

function deriveScanMode(scan: ScanOptions): NonNullable<ScanOptions['mode']> {
  if (scan.convention && !scan.declarative) return 'convention';
  if (!scan.convention && scan.declarative) return 'declarative';
  return 'declared-first';
}

function hasDeclarativeSkills(pkg: PackageJsonLike): boolean {
  const agents = pkg.agents;
  if (!agents) return false;
  return (
    (Array.isArray(agents.skills) && agents.skills.length > 0) ||
    (Array.isArray(agents.experimentalSkills) && agents.experimentalSkills.length > 0) ||
    typeof agents.skillsDir === 'string' ||
    typeof agents.experimentalSkillsDir === 'string'
  );
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
    const entries = await fs.readdir(p, { withFileTypes: true });
    return entries.sort((a, b) => a.name.localeCompare(b.name));
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
async function scanConventionDir(root: string, source: SkillSource): Promise<SkillCandidate[]> {
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
      channel: 'stable',
      declaredPath: relativeToRoot(root, dir),
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

  out.push(...(await scanDeclarativeSpecs(root, source, agents.skills, 'stable')));
  out.push(
    ...(await scanDeclarativeSpecs(root, source, agents.experimentalSkills, 'experimental')),
  );

  if (typeof agents.skillsDir === 'string') {
    out.push(...(await scanDeclarativeDir(root, source, agents.skillsDir, 'stable')));
  }

  if (typeof agents.experimentalSkillsDir === 'string') {
    out.push(
      ...(await scanDeclarativeDir(root, source, agents.experimentalSkillsDir, 'experimental')),
    );
  }
  return out;
}

async function scanDeclarativeSpecs(
  root: string,
  source: SkillSource,
  specs: DeclarativeSkillSpec[] | undefined,
  defaultChannel: SkillChannel,
): Promise<SkillCandidate[]> {
  const out: SkillCandidate[] = [];
  for (const spec of Array.isArray(specs) ? specs : []) {
    if (!spec || typeof spec.path !== 'string') continue;
    const dir = path.resolve(root, spec.path);
    const skillMd = path.join(dir, 'SKILL.md');
    if (!(await isFile(skillMd))) continue;
    out.push({
      source: { ...source, kind: source.kind === 'local' ? 'local' : 'declarative' },
      dir,
      skillMdPath: skillMd,
      dirName: spec.name ?? path.basename(dir),
      channel: isSkillChannel(spec.channel) ? spec.channel : defaultChannel,
      declaredPath: relativeToRoot(root, dir),
      declaredTargets: Array.isArray(spec.targets) ? spec.targets : undefined,
    });
  }
  return out;
}

async function scanDeclarativeDir(
  root: string,
  source: SkillSource,
  dirSpec: string,
  channel: SkillChannel,
): Promise<SkillCandidate[]> {
  const baseDir = path.resolve(root, dirSpec);
  if (!(await isDirectory(baseDir))) return [];

  const entries = await safeReaddir(baseDir);
  const out: SkillCandidate[] = [];
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
      channel,
      declaredPath: relativeToRoot(root, dir),
    });
  }
  return out;
}

function relativeToRoot(root: string, dir: string): string {
  return path.relative(root, dir).split(path.sep).join('/');
}

function isSkillChannel(value: unknown): value is SkillChannel {
  return value === 'stable' || value === 'experimental';
}

function dedupeCandidates(candidates: SkillCandidate[]): SkillCandidate[] {
  const byDir = new Map<string, SkillCandidate>();
  for (const candidate of candidates) {
    const key = candidate.dir;
    const existing = byDir.get(key);
    if (!existing || candidateRank(candidate) > candidateRank(existing)) {
      byDir.set(key, candidate);
    }
  }
  return [...byDir.values()];
}

function candidateRank(candidate: SkillCandidate): number {
  const sourceRank = candidate.source.kind === 'declarative' ? 2 : 1;
  const channelRank = candidate.channel === 'stable' ? 1 : 0;
  return sourceRank * 10 + channelRank;
}
