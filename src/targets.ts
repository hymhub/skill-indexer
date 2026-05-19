import type { Target } from './types.js';

export const ALL_TARGETS = [
  'cursor',
  'codex',
  'claude',
  'copilot',
  'amp',
  'opencode',
  'goose',
] as const satisfies readonly Target[];

/**
 * Project-local install path for each supported agent.
 * Paths are relative to the project root and intentionally never global,
 * so a project's skills stay scoped to that project.
 */
export const TARGET_DIRS: Record<Target, string> = {
  cursor: '.cursor/skills',
  codex: '.codex/skills',
  claude: '.claude/skills',
  copilot: '.github/skills',
  amp: '.agents/skills',
  opencode: '.opencode/skill',
  goose: '.goose/skills',
};

export function isTarget(value: string): value is Target {
  return (ALL_TARGETS as readonly string[]).includes(value);
}

/** Normalize the user-facing `targets` value into a deduped Target[]. */
export function normalizeTargets(input: Target[] | 'all' | string[] | undefined): Target[] {
  if (!input || input === 'all') {
    return input === 'all' ? [...ALL_TARGETS] : [];
  }
  const out: Target[] = [];
  const seen = new Set<Target>();
  for (const raw of input) {
    const v = String(raw).trim().toLowerCase();
    if (v === 'all') {
      for (const t of ALL_TARGETS) {
        if (!seen.has(t)) {
          seen.add(t);
          out.push(t);
        }
      }
      continue;
    }
    if (!isTarget(v)) {
      throw new Error(
        `Unknown target "${raw}". Supported targets: ${ALL_TARGETS.join(', ')}, all.`,
      );
    }
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}
