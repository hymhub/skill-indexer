import type {
  ConflictMode,
  SkillCandidate,
  SkillSyncConfig,
  ValidatedSkill,
  ValidationIssue,
} from '../types.js';
import { matchesFilter } from '../utils/glob.js';
import { validateSkill } from './validator.js';

export interface ResolveReport {
  skills: ValidatedSkill[];
  /** Candidates rejected by include/exclude (kept for diagnostics). */
  filtered: { candidate: SkillCandidate; reason: 'excluded' | 'not-included' }[];
  /** Candidates that failed validation (kept for diagnostics). */
  invalid: { candidate: SkillCandidate; issues: ValidationIssue[] }[];
  /** Conflicts that were resolved (or surfaced as errors in 'error' mode). */
  conflicts: ConflictRecord[];
}

export interface ConflictRecord {
  name: string;
  winner: ValidatedSkill;
  losers: ValidatedSkill[];
}

export class SkillSyncConflictError extends Error {
  constructor(public readonly conflicts: ConflictRecord[]) {
    super(
      `Conflicting skill names detected: ${conflicts
        .map(
          (c) =>
            `${c.name} <- [${[c.winner, ...c.losers]
              .map((s) => s.source.packageName)
              .join(', ')}]`,
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
  const invalid: ResolveReport['invalid'] = [];
  const accepted: ValidatedSkill[] = [];

  const keep: SkillCandidate[] = [];
  for (const candidate of candidates) {
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
  return { skills, filtered, invalid, conflicts };
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
