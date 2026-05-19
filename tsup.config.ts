import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
  },
  format: ['esm', 'cjs'],
  dts: { entry: { index: 'src/index.ts' } },
  splitting: false,
  sourcemap: true,
  clean: true,
  target: 'node18',
  outDir: 'dist',
  shims: false,
  define: {
    __SKILL_INDEXER_VERSION__: JSON.stringify(pkg.version),
  },
});
