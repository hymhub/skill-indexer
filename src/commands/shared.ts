import path from 'node:path';
import type { OverwriteMode, ConflictMode, UserConfig } from '../types.js';

export interface SharedFlags {
  cwd?: string;
  config?: string;
  target?: string | string[];
  include?: string | string[];
  exclude?: string | string[];
  overwrite?: string;
  strict?: boolean;
  dryRun?: boolean;
  convention?: boolean;
  declarative?: boolean;
  onConflict?: string;
  json?: boolean;
}

export function flagsToOverrides(flags: SharedFlags): {
  cwd: string;
  configPath: string | undefined;
  overrides: UserConfig;
} {
  const cwd = path.resolve(flags.cwd ?? process.cwd());
  const overrides: UserConfig = {};

  const targets = parseCsv(flags.target);
  if (targets) overrides.targets = targets;

  const include = parseCsv(flags.include);
  if (include) overrides.include = include;

  const exclude = parseCsv(flags.exclude);
  if (exclude) overrides.exclude = exclude;

  if (flags.overwrite !== undefined) {
    overrides.overwrite = flags.overwrite as OverwriteMode;
  }
  if (flags.onConflict !== undefined) {
    overrides.onConflict = flags.onConflict as ConflictMode;
  }
  if (flags.strict !== undefined) overrides.strict = flags.strict;
  if (flags.dryRun !== undefined) overrides.dryRun = flags.dryRun;
  if (flags.convention !== undefined || flags.declarative !== undefined) {
    overrides.scan = {
      ...(flags.convention !== undefined ? { convention: flags.convention } : {}),
      ...(flags.declarative !== undefined ? { declarative: flags.declarative } : {}),
    };
  }

  return { cwd, configPath: flags.config, overrides };
}

function parseCsv(value: string | string[] | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  const arr = Array.isArray(value) ? value : [value];
  const out: string[] = [];
  for (const item of arr) {
    for (const piece of String(item).split(',')) {
      const trimmed = piece.trim();
      if (trimmed) out.push(trimmed);
    }
  }
  return out.length > 0 ? out : undefined;
}

export function formatRelative(target: string, base: string): string {
  const rel = path.relative(base, target);
  return rel.startsWith('..') || path.isAbsolute(rel) ? target : rel || '.';
}
