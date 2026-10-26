import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

/** Where uploaded images live. Keys are relative paths like `products/<uid>/<id>-sm.webp`. */
export interface MediaStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** Missing keys are ignored. */
  delete(keys: readonly string[]): Promise<void>;
  /** Every key under `prefix` (a folder, ending with "/"). */
  deletePrefix(prefix: string): Promise<void>;
}

/**
 * Files on disk, served by the API under /media. Used in development and
 * tests; an S3 store (R2…) can replace it in production behind this interface.
 */
export class DiskMediaStorage implements MediaStorage {
  readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  async put(key: string, body: Buffer): Promise<void> {
    const file = this.fileFor(key);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, body);
  }

  async delete(keys: readonly string[]): Promise<void> {
    await Promise.all(
      keys.map((key) => rm(this.fileFor(key), { force: true })),
    );
  }

  async deletePrefix(prefix: string): Promise<void> {
    await rm(this.fileFor(prefix), { recursive: true, force: true });
  }

  private fileFor(key: string): string {
    const file = resolve(this.root, key);
    // Keys are built by the API, but never write outside the root
    if (!file.startsWith(this.root + sep))
      throw new Error(`Invalid media key: ${key}`);
    return file;
  }
}
