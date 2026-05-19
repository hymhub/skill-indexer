import path from 'node:path';
import kleur from 'kleur';
import { loadConfig } from '../config/load.js';
import { scanAll } from '../core/scanner.js';
import { validateSkill } from '../core/validator.js';
import { isDirectory, isFile } from '../utils/fs.js';
import { createLogger } from '../utils/logger.js';
import { flagsToOverrides, type SharedFlags } from './shared.js';
import type { SkillCandidate } from '../types.js';

export interface ValidateFlags extends SharedFlags {}

export async function validateCommand(target: string | undefined, flags: ValidateFlags): Promise<void> {
  const logger = createLogger();
  const { cwd, configPath, overrides } = flagsToOverrides(flags);
  const { config } = await loadConfig({ cwd, configPath, overrides });

  let candidates: SkillCandidate[];
  if (target) {
    const dir = path.resolve(cwd, target);
    if (!(await isDirectory(dir))) {
      logger.error(`Not a directory: ${dir}`);
      process.exit(2);
      return;
    }
    const skillMd = path.join(dir, 'SKILL.md');
    if (!(await isFile(skillMd))) {
      logger.error(`SKILL.md not found in: ${dir}`);
      process.exit(2);
      return;
    }
    candidates = [
      {
        source: { kind: 'local', packageName: '.', packageRoot: cwd },
        dir,
        skillMdPath: skillMd,
        dirName: path.basename(dir),
      },
    ];
  } else {
    candidates = (await scanAll({ cwd: config.cwd, scan: config.scan })).filter(
      (c) => c.source.kind === 'local',
    );
    if (candidates.length === 0) {
      logger.warn('No local skills found. Pass a path to validate an external directory.');
      return;
    }
  }

  let okCount = 0;
  let failCount = 0;
  const json: unknown[] = [];

  for (const candidate of candidates) {
    const result = await validateSkill(candidate, { strict: config.strict });
    if (flags.json) {
      json.push({
        dir: candidate.dir,
        valid: result.valid,
        issues: result.issues,
        skill: result.skill && {
          name: result.skill.name,
          description: result.skill.description,
        },
      });
      continue;
    }

    const label = `${kleur.bold(candidate.dirName)}  ${kleur.gray(candidate.dir)}`;
    if (result.valid && result.skill) {
      okCount++;
      logger.raw(`${kleur.green('✓')} ${label}`);
      for (const w of result.skill.warnings) logger.raw(kleur.yellow(`  ! ${w}`));
    } else {
      failCount++;
      logger.raw(`${kleur.red('×')} ${label}`);
      for (const issue of result.issues) {
        logger.raw(
          `  ${issue.level === 'error' ? kleur.red('error') : kleur.yellow('warn')}: ${issue.message}`,
        );
      }
    }
  }

  if (flags.json) {
    process.stdout.write(`${JSON.stringify(json, null, 2)}\n`);
  } else {
    logger.raw('');
    logger.raw(`${okCount} valid, ${failCount} invalid`);
  }

  if (failCount > 0) process.exit(1);
}
