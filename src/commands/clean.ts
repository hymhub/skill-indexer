import kleur from 'kleur';
import { loadConfig } from '../config/load.js';
import { cleanInstalled } from '../core/installer.js';
import { ALL_TARGETS } from '../targets.js';
import { createLogger } from '../utils/logger.js';
import { flagsToOverrides, formatRelative, type SharedFlags } from './shared.js';

export interface CleanFlags extends SharedFlags {}

export async function cleanCommand(flags: CleanFlags): Promise<void> {
  const logger = createLogger();
  const { cwd, configPath, overrides } = flagsToOverrides(flags);
  const { config } = await loadConfig({ cwd, configPath, overrides });

  const targets = config.targets.length > 0 ? config.targets : [...ALL_TARGETS];
  const result = await cleanInstalled(cwd, targets, { dryRun: config.dryRun });

  if (flags.json) {
    process.stdout.write(
      `${JSON.stringify(
        { dryRun: config.dryRun, removed: result.removed, manifest: result.manifest },
        null,
        2,
      )}\n`,
    );
    return;
  }

  if (result.removed.length === 0) {
    logger.info('Nothing to clean.');
    return;
  }
  for (const dest of result.removed) {
    logger.raw(`  ${kleur.red('removed')}  ${formatRelative(dest, cwd)}`);
  }
  logger.success(
    `${config.dryRun ? 'would remove' : 'removed'} ${result.removed.length} skill target(s)` +
      (config.dryRun ? kleur.yellow(' (dry-run)') : ''),
  );
}
