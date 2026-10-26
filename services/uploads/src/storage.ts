import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Stockage des fichiers binaires. Le pilote local suffit en développement ; un
 * pilote S3-compatible se substitue sans toucher au service (voir
 * `docs/domain/uploads.md`, décision de fournisseur à prendre avant production).
 */
export interface StorageDriver {
  write(key: string, bytes: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export class LocalDiskStorage implements StorageDriver {
  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    if (!/^[0-9a-f-]{36}$/.test(key)) {
      throw new Error(`Clé de stockage invalide : ${key}`);
    }
    return path.join(this.root, key.slice(0, 2), key);
  }

  async write(key: string, bytes: Buffer): Promise<void> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes, { mode: 0o600 });
  }

  read(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async remove(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }
}
