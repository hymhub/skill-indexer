# Contributing to skill-indexer

Thanks for your interest! This project lives on [GitHub](https://github.com/hymhub/skill-indexer).

## Development setup

```bash
git clone https://github.com/hymhub/skill-indexer.git
cd skill-indexer
npm install
npm run build
npm run test
```

## Commands

| Command | What it does |
|---------|--------------|
| `npm run build` | Bundle the library + CLI to `dist/` via tsup. |
| `npm run dev` | Watch-mode build. |
| `npm run typecheck` | Strict TypeScript check, no emit. |
| `npm run lint` / `npm run lint:fix` | ESLint over `src/`, `test/`. |
| `npm run format` / `npm run format:check` | Prettier. |
| `npm run test` / `npm run test:watch` | Vitest. |
| `npm run test:coverage` | Vitest with v8 coverage. |
| `npm run changeset` | Add a changeset entry for the next release. |

## Project layout

```
src/
├── cli.ts             # CLI entry (#!/usr/bin/env node)
├── index.ts           # Programmatic API surface
├── commands/          # One file per top-level CLI command
├── core/              # scanner, validator, resolver, installer, manifest
├── config/            # loader + defaults
├── targets.ts         # tool -> directory mapping
├── types.ts           # public type definitions
└── utils/             # fs, glob, logger helpers
test/
├── fixtures are constructed at runtime in test/helpers/tempProject.ts
└── *.test.ts          # one suite per module + cli.test.ts integration suite
```

## Adding a new target tool

1. Add the slug to the `Target` type in [`src/types.ts`](src/types.ts).
2. Add the slug to `ALL_TARGETS` and the directory in `TARGET_DIRS` in [`src/targets.ts`](src/targets.ts).
3. Add a row to the table in `README.md`.
4. Add a unit test case in `test/installer.test.ts`.
5. Add a changeset.

## Filing a PR

1. Fork and create a topic branch.
2. Make your change with tests.
3. Run `npm run lint && npm run typecheck && npm run test` locally — CI runs the same on Node 18/20/22.
4. Add a changeset describing the user-facing impact.
5. Open a PR; CI must be green before review.

## Releasing

Releases are automated via [changesets](https://github.com/changesets/changesets). Merging to `main` opens a "Version Packages" PR; merging that PR publishes to npm and tags a GitHub Release.
