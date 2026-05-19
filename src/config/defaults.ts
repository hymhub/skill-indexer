import type { SkillSyncConfig } from '../types.js';

export const DEFAULT_CONFIG: Omit<SkillSyncConfig, 'cwd'> = {
  targets: [],
  include: [],
  exclude: [],
  scan: { convention: true, declarative: true },
  overwrite: 'skip',
  strict: false,
  onConflict: 'first-wins',
  dryRun: false,
};
