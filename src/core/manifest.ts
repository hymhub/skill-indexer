import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Manifest, ManifestEntry } from '../types.js';
import { ensureDir, readJsonSafe } from '../utils/fs.js';

export const MANIFEST_FILENAME = '.skill-indexer.manifest.json';

export function manifestPath(cwd: string): string {
  return path.join(cwd, MANIFEST_FILENAME);
}

export async function readManifest(cwd: string): Promise<Manifest | undefined> {
  const data = await readJsonSafe<Manifest | LegacyManifest>(manifestPath(cwd));
  if (!data) return undefined;
  if (data.version === 2) return data;
  if (data.version === 1) {
    return {
      version: 2,
      updatedAt: data.updatedAt,
      entries: data.entries,
    };
  }
  return undefined;
}

export async function writeManifest(cwd: string, manifest: Manifest): Promise<void> {
  await ensureDir(cwd);
  const file = manifestPath(cwd);
  await fs.writeFile(file, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

export function emptyManifest(): Manifest {
  return { version: 2, updatedAt: new Date().toISOString(), entries: [] };
}

export function buildManifest(entries: ManifestEntry[]): Manifest {
  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    entries,
  };
}

interface LegacyManifest {
  version: 1;
  updatedAt: string;
  entries: ManifestEntry[];
}
