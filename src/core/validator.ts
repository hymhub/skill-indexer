import { promises as fs } from 'node:fs';
import matter from 'gray-matter';
import type {
  SkillCandidate,
  SkillFrontmatter,
  ValidatedSkill,
  ValidationIssue,
  ValidationResult,
} from '../types.js';
import { countLines } from '../utils/fs.js';

const NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const NAME_MAX = 64;
const DESCRIPTION_MAX = 1024;
const LINES_SOFT_LIMIT = 500;

export interface ValidateOptions {
  /** In strict mode, every warning is promoted to an error. */
  strict?: boolean;
}

/**
 * Validate a single skill candidate against the SKILL.md spec.
 *
 * The validator is the gatekeeper that lets us safely scan directories
 * conventionally: anything that doesn't pass these checks is silently
 * skipped, so accidental `skills/` folders inside dependencies don't
 * leak into the consumer's `.cursor/skills/`.
 */
export async function validateSkill(
  candidate: SkillCandidate,
  options: ValidateOptions = {},
): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];
  let raw: string;
  try {
    raw = await fs.readFile(candidate.skillMdPath, 'utf8');
  } catch (err) {
    issues.push({
      level: 'error',
      message: `Cannot read SKILL.md: ${(err as Error).message}`,
    });
    return { valid: false, issues };
  }

  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(raw);
  } catch (err) {
    issues.push({
      level: 'error',
      message: `Invalid YAML frontmatter: ${(err as Error).message}`,
    });
    return { valid: false, issues };
  }

  const frontmatter = (parsed.data ?? {}) as SkillFrontmatter;
  const lines = await countLines(candidate.skillMdPath);

  const name = typeof frontmatter.name === 'string' ? frontmatter.name.trim() : '';
  const description =
    typeof frontmatter.description === 'string' ? frontmatter.description.trim() : '';

  if (!hasFrontmatter(raw)) {
    issues.push({
      level: 'error',
      message: 'SKILL.md is missing a YAML frontmatter block (--- ... ---).',
    });
  }

  if (!name) {
    issues.push({ level: 'error', field: 'name', message: '`name` is required.' });
  } else if (name.length > NAME_MAX) {
    issues.push({
      level: 'error',
      field: 'name',
      message: `\`name\` must be <= ${NAME_MAX} characters (got ${name.length}).`,
    });
  } else if (!NAME_PATTERN.test(name)) {
    issues.push({
      level: 'error',
      field: 'name',
      message:
        '`name` must match /^[a-z0-9][a-z0-9-]{0,63}$/ (lowercase letters, numbers, hyphens).',
    });
  }

  if (!description) {
    issues.push({
      level: 'error',
      field: 'description',
      message: '`description` is required and must be a non-empty string.',
    });
  } else if (description.length > DESCRIPTION_MAX) {
    issues.push({
      level: 'error',
      field: 'description',
      message: `\`description\` must be <= ${DESCRIPTION_MAX} characters (got ${description.length}).`,
    });
  }

  if (name && candidate.dirName !== name) {
    issues.push({
      level: 'warning',
      field: 'name',
      message: `Directory name "${candidate.dirName}" does not match frontmatter \`name: ${name}\`.`,
    });
  }

  if (lines > LINES_SOFT_LIMIT) {
    issues.push({
      level: 'warning',
      message: `SKILL.md is ${lines} lines; consider splitting (soft limit ${LINES_SOFT_LIMIT}).`,
    });
  }

  const errorCount = issues.filter((i) => i.level === 'error').length;
  const effectiveErrors = options.strict ? issues.length : errorCount;

  if (effectiveErrors > 0) {
    return { valid: false, issues };
  }

  const warnings = issues.filter((i) => i.level === 'warning').map((i) => i.message);
  const skill: ValidatedSkill = {
    ...candidate,
    name,
    originalName: name,
    description,
    frontmatter,
    warnings,
    lines,
    channel: candidate.channel ?? 'stable',
  };
  return { valid: true, issues, skill };
}

function hasFrontmatter(raw: string): boolean {
  if (!raw.startsWith('---')) return false;
  const rest = raw.slice(3);
  return rest.includes('\n---');
}
