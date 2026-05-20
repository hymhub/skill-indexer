import type { SkillSyncConfig } from '../types.js';

export const DEFAULT_CONFIG: Omit<SkillSyncConfig, 'cwd'> = {
  targets: [],
  include: [],
  exclude: [],
  scan: { mode: 'declared-first', convention: true, declarative: true },
  overwrite: 'skip',
  strict: false,
  onConflict: 'first-wins',
  dryRun: false,
  experimental: false,
};
