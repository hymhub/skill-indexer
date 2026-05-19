#!/usr/bin/env node
import { cac } from 'cac';
import { installCommand } from './commands/install.js';
import { listCommand } from './commands/list.js';
import { validateCommand } from './commands/validate.js';
import { cleanCommand } from './commands/clean.js';

declare const __SKILL_INDEXER_VERSION__: string;
const VERSION =
  typeof __SKILL_INDEXER_VERSION__ === 'string' ? __SKILL_INDEXER_VERSION__ : '0.0.0';

const cli = cac('skill-indexer');

const sharedOptions = (cmd: ReturnType<typeof cli.command>) =>
  cmd
    .option('-t, --target <targets>', 'Comma-separated targets: cursor,codex,claude,copilot,amp,opencode,goose,all')
    .option('--cwd <dir>', 'Project root (defaults to current working directory)')
    .option('--config <path>', 'Path to a skill-indexer config file (JSON)')
    .option('--include <patterns>', 'Comma-separated glob patterns to include (matched against package name)')
    .option('--exclude <patterns>', 'Comma-separated glob patterns to exclude (matched against package name)')
    .option('--overwrite <mode>', 'How to handle existing files: skip | overwrite | merge')
    .option('--on-conflict <mode>', 'Conflict policy: error | first-wins | last-wins')
    .option('--strict', 'Promote validation warnings to errors')
    .option('--dry-run', 'Plan the operation without writing files')
    .option('--no-convention', 'Disable convention scan (skills/<name>/SKILL.md)')
    .option('--no-declarative', 'Disable declarative scan (package.json#agents.skills)')
    .option('--json', 'Emit machine-readable JSON output');

sharedOptions(
  cli
    .command('install', 'Validate and install agent skills from dependencies into target directories')
    .example('  skill-indexer install -t cursor,codex,claude')
    .example('  skill-indexer install -t all --dry-run')
    .action(installCommand),
);

sharedOptions(
  cli
    .command('list', 'List skill candidates discovered from the project and its dependencies')
    .example('  skill-indexer list --json')
    .action(listCommand),
);

sharedOptions(
  cli
    .command('validate [path]', 'Validate a single SKILL.md directory or the project\'s own skills/')
    .example('  skill-indexer validate ./skills/my-skill')
    .example('  skill-indexer validate --strict')
    .action(validateCommand),
);

sharedOptions(
  cli
    .command('clean', 'Remove previously installed skills based on the manifest')
    .example('  skill-indexer clean -t cursor')
    .action(cleanCommand),
);

cli.help();
cli.version(VERSION);

main();

async function main() {
  try {
    cli.parse(process.argv, { run: false });
    await cli.runMatchedCommand();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`error: ${message}\n`);
    process.exit(1);
  }
}
