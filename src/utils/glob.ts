import picomatch from 'picomatch';

export function compileMatchers(patterns: string[] | undefined): ((value: string) => boolean) | null {
  if (!patterns || patterns.length === 0) return null;
  const matchers = patterns.map((p) => picomatch(p, { dot: true, nocase: false }));
  return (value: string) => matchers.some((fn) => fn(value));
}

export interface FilterOptions {
  include?: string[];
  exclude?: string[];
}

export function matchesFilter(value: string, options: FilterOptions): boolean {
  const inc = compileMatchers(options.include);
  const exc = compileMatchers(options.exclude);
  if (inc && !inc(value)) return false;
  if (exc && exc(value)) return false;
  return true;
}
