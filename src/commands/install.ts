import kleur from 'kleur';
import { loadConfig } from '../config/load.js';
import { scanAll } from '../core/scanner.js';
import { resolveSkills, SkillSyncConflictError } from '../core/resolver.js';
import { installSkills } from '../core/installer.js';
import { ALL_TARGETS } from '../targets.js';
import { createLogger } from '../utils/logger.js';
import { flagsToOverrides, formatRelative, type SharedFlags } from './shared.js';

export interface InstallFlags extends SharedFlags {}

export async function installCommand(flags: InstallFlags): Promise<void> {
  const logger = createLogger();
  const { cwd, configPath, overrides } = flagsToOverrides(flags);
  const { config, sources } = await loadConfig({ cwd, configPath, overrides });

  if (config.targets.length === 0) {
    logger.error(
      `No targets specified. Pass --target cursor,codex,claude (or "all"), or set "targets" in your config.`,
    );
    process.exit(2);
  }

  if (sources.file) logger.debug(`config: ${formatRelative(sources.file, cwd)}`);
  if (sources.packageJson)
    logger.debug(`package.json#skillIndexer: ${formatRelative(sources.packageJson, cwd)}`);

  logger.info(
    `scanning ${kleur.cyan(cwd)} -> targets: ${kleur.cyan(config.targets.join(', '))}` +
      (config.dryRun ? kleur.yellow(' (dry-run)') : ''),
  );

  const candidates = await scanAll({ cwd: config.cwd, scan: config.scan });
  logger.debug(`found ${candidates.length} candidate skill directories`);

  let report;
  try {
    report = await resolveSkills(candidates, config);
  } catch (err) {
    if (err instanceof SkillSyncConflictError) {
      logger.error(err.message);
      for (const c of err.conflicts) {
        logger.error(
          `  - ${kleur.bold(c.name)} provided by ${[c.winner, ...c.losers]
            .map((s) => `${s.source.packageName}@${s.source.packageVersion ?? '?'}`)
            .join(', ')}`,
        );
      }
      process.exit(3);
      return;
    }
    throw err;
  }

  for (const { candidate, reason } of report.filtered) {
    logger.debug(`filtered (${reason}): ${candidate.source.packageName} :: ${candidate.dirName}`);
  }
  for (const { candidate, issues } of report.invalid) {
    const msg = issues.map((i) => i.message).join('; ');
    logger.warn(
      `skipped ${kleur.bold(candidate.source.packageName)}::${candidate.dirName} – ${msg}`,
    );
  }
  for (const { candidate } of report.experimental) {
    logger.debug(`skipped experimental: ${candidate.source.packageName} :: ${candidate.dirName}`);
  }
  for (const conflict of report.conflicts) {
    if (conflict.renamed && conflict.renamed.length > 0) {
      logger.warn(
        `conflict on "${conflict.name}": kept all, renamed ${conflict.renamed
          .map((r) => `${r.from} -> ${r.to}`)
          .join(', ')}`,
      );
    } else {
      logger.warn(
        `conflict on "${conflict.name}": kept ${kleur.bold(
          conflict.winner.source.packageName,
        )}, ignored ${conflict.losers.map((s) => s.source.packageName).join(', ')}`,
      );
    }
  }

  if (report.skills.length === 0) {
    logger.warn('No valid skills to install.');
    if (flags.json) process.stdout.write(`${JSON.stringify({ installed: [] }, null, 2)}\n`);
    return;
  }

  const install = await installSkills(report.skills, { config });

  if (flags.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          dryRun: install.dryRun,
          entries: install.entries.map((e) => ({
            name: e.skill.name,
            originalName: e.skill.originalName !== e.skill.name ? e.skill.originalName : undefined,
            channel: e.skill.channel,
            source: e.skill.source.packageName,
            target: e.target,
            dest: e.dest,
            action: e.action,
          })),
          skipped: {
            invalid: report.invalid.length,
            experimental: report.experimental.length,
            filtered: report.filtered.length,
          },
          manifest: install.manifest,
        },
        null,
        2,
      )}\n`,
    );
    return;
  }

  for (const e of install.entries) {
    const arrow = e.action === 'skipped' ? kleur.gray('skip') : kleur.green(e.action);
    logger.raw(
      `  ${arrow}  ${kleur.bold(e.skill.name)}  ->  ${formatRelative(e.dest, cwd)}` +
        kleur.gray(`  (${e.target}, from ${e.skill.source.packageName})`),
    );
  }
  const created = install.entries.filter((e) => e.action !== 'skipped').length;
  const skipped = install.entries.length - created;
  logger.success(
    `${install.dryRun ? 'would install' : 'installed'} ${created} skill target(s), ${skipped} skipped` +
      (install.dryRun ? kleur.yellow(' (dry-run, no files written)') : ''),
  );
  if (report.invalid.length > 0 || report.experimental.length > 0 || report.filtered.length > 0) {
    logger.info(
      `skipped candidates: ${report.invalid.length} invalid, ${report.experimental.length} experimental, ${report.filtered.length} filtered`,
    );
  }
  if (config.targets.length === ALL_TARGETS.length) {
    logger.debug('all known targets selected');
  }
}
