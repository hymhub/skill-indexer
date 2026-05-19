import { promises as fs } from 'node:fs';
import path from 'node:path';

export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function isDirectory(p: string): Promise<boolean> {
  try {
    const stat = await fs.stat(p);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

export async function isFile(p: string): Promise<boolean> {
  try {
    const stat = await fs.stat(p);
    return stat.isFile();
  } catch {
    return false;
  }
}

export async function readJsonSafe<T = unknown>(p: string): Promise<T | undefined> {
  try {
    const raw = await fs.readFile(p, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Recursively copy `src` directory to `dest`. Symlinks are dereferenced
 * (we want skills to be standalone files inside the consumer project,
 * not pointers back into node_modules that may be cleaned).
 */
export async function copyDir(src: string, dest: string): Promise<void> {
  await ensureDir(dest);
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else if (entry.isSymbolicLink()) {
      const real = await fs.realpath(srcPath);
      const stat = await fs.stat(real);
      if (stat.isDirectory()) {
        await copyDir(real, destPath);
      } else {
        await fs.copyFile(real, destPath);
      }
    } else if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

export async function removeDir(p: string): Promise<void> {
  await fs.rm(p, { recursive: true, force: true });
}

export async function countLines(p: string): Promise<number> {
  try {
    const raw = await fs.readFile(p, 'utf8');
    if (!raw) return 0;
    let n = 1;
    for (let i = 0; i < raw.length; i++) {
      if (raw.charCodeAt(i) === 10) n++;
    }
    return n;
  } catch {
    return 0;
  }
}
