import { createHash } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

export interface StorageAdapter {
  put(key: string, data: Buffer): Promise<void>;
  read(key: string): Promise<Buffer | null>;
  remove(key: string): Promise<void>;
  health(): Promise<boolean>;
}

export class LocalFileStorage implements StorageAdapter {
  public constructor(private readonly root: string) {}

  private safePath(key: string): string {
    const normalized = path.normalize(key);
    if (
      normalized.startsWith('..') ||
      path.isAbsolute(normalized) ||
      normalized.includes(`${path.sep}..${path.sep}`)
    ) {
      throw Object.assign(new Error('Invalid storage key.'), {
        statusCode: 400,
        code: 'INVALID_STORAGE_KEY',
      });
    }
    return path.join(this.root, normalized);
  }

  public async put(key: string, data: Buffer): Promise<void> {
    const target = this.safePath(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data, { flag: 'wx' });
  }

  public async read(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.safePath(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  public async remove(key: string): Promise<void> {
    try {
      await unlink(this.safePath(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  public async health(): Promise<boolean> {
    try {
      await mkdir(this.root, { recursive: true });
      await access(this.root);
      return true;
    } catch {
      return false;
    }
  }
}

export function sha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

export function contentLooksValid(mediaType: string, data: Buffer): boolean {
  if (mediaType === 'application/pdf') return data.subarray(0, 5).toString() === '%PDF-';
  if (mediaType === 'application/json') {
    try {
      JSON.parse(data.toString('utf8'));
      return true;
    } catch {
      return false;
    }
  }
  if (mediaType === 'text/csv' || mediaType === 'text/plain')
    return data.length > 0 && !data.includes(0);
  return mediaType.startsWith('image/') ? data.length > 0 : false;
}
