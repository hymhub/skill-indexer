import path from 'node:path';
import type {
  ConflictMode,
  OverwriteMode,
  PackageJsonLike,
  ScanOptions,
  ScanMode,
  SkillSyncConfig,
  Target,
  UserConfig,
} from '../types.js';
import { normalizeTargets } from '../targets.js';
import { isFile, readJsonSafe } from '../utils/fs.js';
import { DEFAULT_CONFIG } from './defaults.js';

export interface LoadConfigOptions {
  cwd?: string;
  /** Explicit path to a config file (skips lookup). */
  configPath?: string;
  /** CLI overrides; applied last so they always win. */
  overrides?: UserConfig;
}

export interface LoadedConfig {
  config: SkillSyncConfig;
  sources: { file?: string; packageJson?: string };
}

const CONFIG_FILENAMES = ['skill-indexer.config.json', '.skill-indexerrc.json', '.skill-indexerrc'];

const VALID_OVERWRITE: OverwriteMode[] = ['skip', 'overwrite', 'merge'];
const VALID_CONFLICT: ConflictMode[] = ['error', 'first-wins', 'last-wins', 'keep-both'];
const VALID_SCAN_MODE: ScanMode[] = ['declared-first', 'both', 'convention', 'declarative'];

export async function loadConfig(options: LoadConfigOptions = {}): Promise<LoadedConfig> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const sources: LoadedConfig['sources'] = {};

  let user: UserConfig = {};

  const pkgPath = path.join(cwd, 'package.json');
  const pkg = await readJsonSafe<PackageJsonLike>(pkgPath);
  if (pkg?.skillIndexer) {
    user = mergeUserConfig(user, pkg.skillIndexer);
    sources.packageJson = pkgPath;
  }

  const explicit = options.configPath ? path.resolve(cwd, options.configPath) : undefined;
  const fromFile = explicit ?? (await findConfigFile(cwd));
  if (fromFile) {
    const fileConfig = await readJsonSafe<UserConfig>(fromFile);
    if (fileConfig) {
      user = mergeUserConfig(user, fileConfig);
      sources.file = fromFile;
    }
  }

  if (options.overrides) {
    user = mergeUserConfig(user, options.overrides);
  }

  const config = finalize(user, cwd);
  return { config, sources };
}

async function findConfigFile(cwd: string): Promise<string | undefined> {
  for (const name of CONFIG_FILENAMES) {
    const candidate = path.join(cwd, name);
    if (await isFile(candidate)) return candidate;
  }
  return undefined;
}

export function mergeUserConfig(base: UserConfig, extra: UserConfig): UserConfig {
  return {
    ...base,
    ...extra,
    scan: { ...(base.scan ?? {}), ...(extra.scan ?? {}) },
    include: extra.include ?? base.include,
    exclude: extra.exclude ?? base.exclude,
    targets: extra.targets ?? base.targets,
  };
}

function finalize(user: UserConfig, cwd: string): SkillSyncConfig {
  const targets: Target[] = normalizeTargets(user.targets);
  const scanMode = ensureEnum(
    user.scan?.mode,
    VALID_SCAN_MODE,
    deriveScanMode(user.scan),
    'scan.mode',
  );
  const scan: ScanOptions = {
    mode: scanMode,
    convention: user.scan?.convention ?? scanMode !== 'declarative',
    declarative: user.scan?.declarative ?? scanMode !== 'convention',
  };
  const overwrite = ensureEnum(
    user.overwrite,
    VALID_OVERWRITE,
    DEFAULT_CONFIG.overwrite,
    'overwrite',
  );
  const onConflict = ensureEnum(
    user.onConflict,
    VALID_CONFLICT,
    DEFAULT_CONFIG.onConflict,
    'onConflict',
  );
  return {
    cwd,
    targets,
    include: user.include ? [...user.include] : [],
    exclude: user.exclude ? [...user.exclude] : [],
    scan,
    overwrite,
    strict: Boolean(user.strict ?? DEFAULT_CONFIG.strict),
    onConflict,
    dryRun: Boolean(user.dryRun ?? DEFAULT_CONFIG.dryRun),
    experimental: Boolean(user.experimental ?? DEFAULT_CONFIG.experimental),
  };
}

function deriveScanMode(scan: Partial<ScanOptions> | undefined): ScanMode {
  if (!scan) return DEFAULT_CONFIG.scan.mode ?? 'declared-first';
  if (scan.convention === false && scan.declarative !== false) return 'declarative';
  if (scan.declarative === false && scan.convention !== false) return 'convention';
  return DEFAULT_CONFIG.scan.mode ?? 'declared-first';
}

function ensureEnum<T extends string>(
  value: T | undefined,
  allowed: readonly T[],
  fallback: T,
  field: string,
): T {
  if (value === undefined) return fallback;
  if (!allowed.includes(value)) {
    throw new Error(
      `Invalid value for "${field}": ${String(value)}. Expected one of: ${allowed.join(', ')}.`,
    );
  }
  return value;
}
