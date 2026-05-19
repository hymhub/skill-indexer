import kleur from 'kleur';

export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

const LEVELS: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

export interface Logger {
  level: LogLevel;
  error: (msg: string) => void;
  warn: (msg: string) => void;
  info: (msg: string) => void;
  success: (msg: string) => void;
  debug: (msg: string) => void;
  raw: (msg: string) => void;
}

export function createLogger(level: LogLevel = 'info'): Logger {
  const enabled = (l: LogLevel) => LEVELS[level] >= LEVELS[l];
  return {
    level,
    error: (msg) => {
      if (enabled('error')) process.stderr.write(`${kleur.red('error')} ${msg}\n`);
    },
    warn: (msg) => {
      if (enabled('warn')) process.stderr.write(`${kleur.yellow('warn')}  ${msg}\n`);
    },
    info: (msg) => {
      if (enabled('info')) process.stderr.write(`${kleur.cyan('info')}  ${msg}\n`);
    },
    success: (msg) => {
      if (enabled('info')) process.stderr.write(`${kleur.green('ok')}    ${msg}\n`);
    },
    debug: (msg) => {
      if (enabled('debug')) process.stderr.write(`${kleur.gray('debug')} ${msg}\n`);
    },
    raw: (msg) => {
      process.stdout.write(`${msg}\n`);
    },
  };
}

export const noopLogger: Logger = {
  level: 'silent',
  error: () => undefined,
  warn: () => undefined,
  info: () => undefined,
  success: () => undefined,
  debug: () => undefined,
  raw: () => undefined,
};
