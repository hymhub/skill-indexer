/**
 * Public types exported by skill-indexer.
 *
 * All path values are absolute unless explicitly documented otherwise.
 */

export type Target =
  | 'cursor'
  | 'codex'
  | 'claude'
  | 'copilot'
  | 'amp'
  | 'opencode'
  | 'goose';

/** Where a skill candidate came from. */
export type SkillSourceKind = 'convention' | 'declarative' | 'local';

export interface SkillSource {
  kind: SkillSourceKind;
  /** npm package name, or `.` if the source is the current project. */
  packageName: string;
  packageVersion?: string;
  /** Absolute path to the package root. */
  packageRoot: string;
}

/** Parsed frontmatter from a `SKILL.md` file (open-ended for forward compat). */
export interface SkillFrontmatter {
  name?: string;
  description?: string;
  [key: string]: unknown;
}

/** A skill directory that has been discovered but not yet validated. */
export interface SkillCandidate {
  source: SkillSource;
  /** Absolute path to the skill directory. */
  dir: string;
  /** Absolute path to the SKILL.md file inside that directory. */
  skillMdPath: string;
  /** The directory's basename. */
  dirName: string;
}

/** A skill candidate that has passed validation. */
export interface ValidatedSkill extends SkillCandidate {
  name: string;
  description: string;
  frontmatter: SkillFrontmatter;
  warnings: string[];
  /** Total line count of SKILL.md (used for advisory warnings). */
  lines: number;
}

export interface ValidationIssue {
  level: 'error' | 'warning';
  message: string;
  field?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  skill?: ValidatedSkill;
}

export type OverwriteMode = 'skip' | 'overwrite' | 'merge';
export type ConflictMode = 'error' | 'first-wins' | 'last-wins';

export interface ScanOptions {
  convention: boolean;
  declarative: boolean;
}

export interface SkillSyncConfig {
  targets: Target[];
  include: string[];
  exclude: string[];
  scan: ScanOptions;
  overwrite: OverwriteMode;
  strict: boolean;
  onConflict: ConflictMode;
  cwd: string;
  dryRun: boolean;
}

/** User-facing config shape (every field optional; `targets` may be 'all'). */
export interface UserConfig {
  targets?: Target[] | 'all' | string[];
  include?: string[];
  exclude?: string[];
  scan?: Partial<ScanOptions>;
  overwrite?: OverwriteMode;
  strict?: boolean;
  onConflict?: ConflictMode;
  cwd?: string;
  dryRun?: boolean;
}

export interface ManifestSourceInfo {
  packageName: string;
  packageVersion?: string;
  kind: SkillSourceKind;
}

export interface ManifestTargetInfo {
  target: Target;
  /** Absolute path of the installed skill directory. */
  dest: string;
}

export interface ManifestEntry {
  name: string;
  source: ManifestSourceInfo;
  targets: ManifestTargetInfo[];
  installedAt: string;
}

export interface Manifest {
  version: 1;
  updatedAt: string;
  entries: ManifestEntry[];
}

/** Declarative skill spec read from a package's `package.json#agents.skills`. */
export interface DeclarativeSkillSpec {
  name?: string;
  path: string;
}

export interface PackageAgentsField {
  skills?: DeclarativeSkillSpec[];
  skillsDir?: string;
}

export interface PackageJsonLike {
  name?: string;
  version?: string;
  agents?: PackageAgentsField;
  skillIndexer?: UserConfig;
  [key: string]: unknown;
}
