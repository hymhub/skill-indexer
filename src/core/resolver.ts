import type {
  ConflictMode,
  SkillCandidate,
  SkillSyncConfig,
  ValidatedSkill,
  ValidationIssue,
} from '../types.js';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { matchesFilter } from '../utils/glob.js';
import { validateSkill } from './validator.js';

export interface ResolveReport {
  skills: ValidatedSkill[];
  /** Candidates rejected by include/exclude (kept for diagnostics). */
  filtered: {
    candidate: SkillCandidate;
    reason: 'excluded' | 'not-included' | 'target-mismatch';
  }[];
  /** Experimental candidates skipped because the consumer did not opt in. */
  experimental: { candidate: SkillCandidate }[];
  /** Candidates that failed validation (kept for diagnostics). */
  invalid: { candidate: SkillCandidate; issues: ValidationIssue[] }[];
  /** Conflicts that were resolved (or surfaced as errors in 'error' mode). */
  conflicts: ConflictRecord[];
}

export interface ConflictRecord {
  name: string;
  winner: ValidatedSkill;
  losers: ValidatedSkill[];
  renamed?: { from: string; to: string; packageName: string; dir: string }[];
}

export class SkillSyncConflictError extends Error {
  constructor(public readonly conflicts: ConflictRecord[]) {
    super(
      `Conflicting skill names detected: ${conflicts
        .map(
          (c) =>
            `${c.name} <- [${[c.winner, ...c.losers].map((s) => s.source.packageName).join(', ')}]`,
        )
        .join('; ')}`,
    );
    this.name = 'SkillSyncConflictError';
  }
}

/**
 * Apply include/exclude filters, validate every remaining candidate,
 * and reduce duplicates (same `name`) according to the conflict policy.
 */
export async function resolveSkills(
  candidates: SkillCandidate[],
  config: SkillSyncConfig,
): Promise<ResolveReport> {
  const filtered: ResolveReport['filtered'] = [];
  const experimental: ResolveReport['experimental'] = [];
  const invalid: ResolveReport['invalid'] = [];
  const accepted: ValidatedSkill[] = [];

  const keep: SkillCandidate[] = [];
  for (const candidate of candidates) {
    if ((candidate.channel ?? 'stable') === 'experimental' && !config.experimental) {
      experimental.push({ candidate });
      continue;
    }
    if (candidate.source.kind === 'local') {
      keep.push(candidate);
      continue;
    }
    const pkg = candidate.source.packageName;
    if (config.include.length > 0 && !matchesFilter(pkg, { include: config.include })) {
      filtered.push({ candidate, reason: 'not-included' });
      continue;
    }
    if (config.exclude.length > 0 && !matchesFilter(pkg, { exclude: config.exclude })) {
      filtered.push({ candidate, reason: 'excluded' });
      continue;
    }
    if (
      candidate.declaredTargets &&
      config.targets.length > 0 &&
      !candidate.declaredTargets.some((declared) =>
        config.targets.some((target) => target === declared),
      )
    ) {
      filtered.push({ candidate, reason: 'target-mismatch' });
      continue;
    }
    keep.push(candidate);
  }

  for (const candidate of keep) {
    const result = await validateSkill(candidate, { strict: config.strict });
    if (!result.valid || !result.skill) {
      invalid.push({ candidate, issues: result.issues });
      continue;
    }
    accepted.push(result.skill);
  }

  const { skills, conflicts } = reduceConflicts(accepted, config.onConflict);
  return { skills, filtered, experimental, invalid, conflicts };
}

function reduceConflicts(
  skills: ValidatedSkill[],
  mode: ConflictMode,
): { skills: ValidatedSkill[]; conflicts: ConflictRecord[] } {
  const groups = new Map<string, ValidatedSkill[]>();
  for (const skill of skills) {
    const list = groups.get(skill.name) ?? [];
    list.push(skill);
    groups.set(skill.name, list);
  }

  const out: ValidatedSkill[] = [];
  const conflicts: ConflictRecord[] = [];

  for (const [name, list] of groups) {
    if (list.length === 1) {
      out.push(list[0]!);
      continue;
    }

    if (mode === 'keep-both') {
      const kept = keepBoth(name, list);
      out.push(...kept.skills);
      conflicts.push({
        name,
        winner: kept.skills[0]!,
        losers: kept.skills.slice(1),
        renamed: kept.renamed,
      });
      continue;
    }

    // Local sources always beat external ones regardless of mode, so a user's
    // hand-written skill is never silently overwritten by a dependency.
    const local = list.filter((s) => s.source.kind === 'local');
    if (local.length === 1) {
      const winner = local[0]!;
      conflicts.push({
        name,
        winner,
        losers: list.filter((s) => s !== winner),
      });
      out.push(winner);
      continue;
    }

    if (mode === 'error') {
      conflicts.push({ name, winner: list[0]!, losers: list.slice(1) });
      continue;
    }

    const winner = mode === 'last-wins' ? list[list.length - 1]! : list[0]!;
    out.push(winner);
    conflicts.push({
      name,
      winner,
      losers: list.filter((s) => s !== winner),
    });
  }

  if (mode === 'error' && conflicts.length > 0) {
    throw new SkillSyncConflictError(conflicts);
  }

  return { skills: out, conflicts };
}

function keepBoth(
  name: string,
  list: ValidatedSkill[],
): { skills: ValidatedSkill[]; renamed: NonNullable<ConflictRecord['renamed']> } {
  const used = new Set<string>();
  const local = list.filter((s) => s.source.kind === 'local');
  const ordered =
    local.length > 0 ? [...local, ...list.filter((s) => s.source.kind !== 'local')] : list;
  const skills: ValidatedSkill[] = [];
  const renamed: NonNullable<ConflictRecord['renamed']> = [];

  for (const skill of ordered) {
    const resolvedName =
      used.size === 0 && !used.has(name) ? name : uniqueResolvedName(name, skill, used);
    used.add(resolvedName);

    if (resolvedName === skill.name) {
      skills.push(skill);
      continue;
    }

    const next: ValidatedSkill = {
      ...skill,
      name: resolvedName,
      originalName: skill.originalName ?? skill.name,
      frontmatter: { ...skill.frontmatter, name: resolvedName },
      warnings: [
        ...skill.warnings,
        `Installed as "${resolvedName}" because another skill already uses "${name}".`,
      ],
    };
    skills.push(next);
    renamed.push({
      from: skill.name,
      to: resolvedName,
      packageName: skill.source.packageName,
      dir: skill.dir,
    });
  }

  return { skills, renamed };
}

function uniqueResolvedName(base: string, skill: ValidatedSkill, used: Set<string>): string {
  const packageSlug = slugifyName(
    skill.source.packageName === '.' ? 'local' : skill.source.packageName,
  );
  const dirSlug = slugifyName(path.basename(skill.dir));
  const baseSlug = slugifyName(base);
  const hash = createHash('sha1')
    .update(`${skill.source.packageName}\0${skill.dir}`)
    .digest('hex')
    .slice(0, 6);
  const primarySuffix = dirSlug && dirSlug !== baseSlug ? `${packageSlug}-${dirSlug}` : packageSlug;
  const suffixes = Array.from(
    new Set([
      primarySuffix,
      packageSlug,
      `${packageSlug}-${dirSlug}`,
      `${packageSlug}-${dirSlug}-${hash}`,
    ]),
  );

  for (const suffix of suffixes) {
    const candidate = joinResolvedName(base, suffix);
    if (!used.has(candidate)) return candidate;
  }

  for (let i = 2; ; i++) {
    const candidate = joinResolvedName(base, `${packageSlug}-${hash}-${i}`);
    if (!used.has(candidate)) return candidate;
  }
}

function slugifyName(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (slug || 'skill').slice(0, 32).replace(/-+$/g, '') || 'skill';
}

function joinResolvedName(base: string, suffix: string): string {
  const cleanSuffix = suffix.slice(0, 40).replace(/-+$/g, '') || 'skill';
  const maxBase = Math.max(1, 64 - cleanSuffix.length - 2);
  const cleanBase = base.slice(0, maxBase).replace(/-+$/g, '') || 'skill';
  return `${cleanBase}--${cleanSuffix}`;
}
