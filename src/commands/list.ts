import kleur from 'kleur';
import { loadConfig } from '../config/load.js';
import { scanAll } from '../core/scanner.js';
import { resolveSkills } from '../core/resolver.js';
import { createLogger } from '../utils/logger.js';
import { flagsToOverrides, formatRelative, type SharedFlags } from './shared.js';

export interface ListFlags extends SharedFlags {}

export async function listCommand(flags: ListFlags): Promise<void> {
  const logger = createLogger();
  const { cwd, configPath, overrides } = flagsToOverrides(flags);
  const { config } = await loadConfig({ cwd, configPath, overrides });

  const candidates = await scanAll({ cwd: config.cwd, scan: config.scan });
  const report = await resolveSkills(candidates, config);

  if (flags.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          skills: report.skills.map((s) => ({
            name: s.name,
            description: s.description,
            dir: s.dir,
            source: s.source,
            warnings: s.warnings,
          })),
          invalid: report.invalid.map((i) => ({
            dir: i.candidate.dir,
            package: i.candidate.source.packageName,
            issues: i.issues,
          })),
          filtered: report.filtered.map((f) => ({
            dir: f.candidate.dir,
            package: f.candidate.source.packageName,
            reason: f.reason,
          })),
        },
        null,
        2,
      )}\n`,
    );
    return;
  }

  if (report.skills.length === 0) {
    logger.warn('No valid skills discovered.');
  } else {
    logger.raw(kleur.bold(`Discovered ${report.skills.length} skill(s):`));
    for (const s of report.skills) {
      logger.raw(
        `  ${kleur.green('•')} ${kleur.bold(s.name)}  ${kleur.gray(
          `(${s.source.kind} :: ${s.source.packageName}${
            s.source.packageVersion ? `@${s.source.packageVersion}` : ''
          })`,
        )}`,
      );
      logger.raw(`      ${kleur.gray(formatRelative(s.dir, cwd))}`);
      logger.raw(`      ${truncate(s.description, 120)}`);
      for (const w of s.warnings) logger.raw(kleur.yellow(`      ! ${w}`));
    }
  }

  if (report.invalid.length > 0) {
    logger.raw('');
    logger.raw(kleur.yellow(`Skipped ${report.invalid.length} invalid candidate(s):`));
    for (const i of report.invalid) {
      logger.raw(
        `  ${kleur.red('×')} ${kleur.bold(i.candidate.source.packageName)}::${i.candidate.dirName}`,
      );
      for (const issue of i.issues) {
        logger.raw(
          `      ${issue.level === 'error' ? kleur.red('error') : kleur.yellow('warn')}: ${issue.message}`,
        );
      }
    }
  }

  if (report.filtered.length > 0) {
    logger.raw('');
    logger.raw(kleur.gray(`Filtered ${report.filtered.length} candidate(s) by include/exclude.`));
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
