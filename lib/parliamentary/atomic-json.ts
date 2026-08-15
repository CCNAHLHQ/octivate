import { promises as fs } from "fs";
import path from "path";

/**
 * Windows-safe atomic JSON write: temp file → rename, with copy+unlink fallback
 * on EPERM/EEXIST/EACCES (AV / indexer locks).
 */
export async function atomicWriteJson(file: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const payload = JSON.stringify(data, null, 2);
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, payload, "utf8");
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      await fs.rename(tmp, file);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === "EPERM" || code === "EEXIST" || code === "EACCES") {
        try {
          await fs.copyFile(tmp, file);
          await fs.unlink(tmp).catch(() => undefined);
          return;
        } catch {
          await new Promise((r) => setTimeout(r, 40 * (attempt + 1)));
          continue;
        }
      }
      await fs.unlink(tmp).catch(() => undefined);
      throw err;
    }
  }
  await fs.writeFile(file, payload, "utf8");
  await fs.unlink(tmp).catch(() => undefined);
}

/** Rename with the same Windows lock retry/copy fallback as atomicWriteJson. */
export async function atomicRename(src: string, dest: string): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      await fs.rename(src, dest);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === "EPERM" || code === "EEXIST" || code === "EACCES" || code === "EBUSY") {
        try {
          await fs.copyFile(src, dest);
          await fs.unlink(src).catch(() => undefined);
          return;
        } catch {
          await new Promise((r) => setTimeout(r, 40 * (attempt + 1)));
          continue;
        }
      }
      throw err;
    }
  }
  await fs.copyFile(src, dest);
  await fs.unlink(src).catch(() => undefined);
}

/** Simple async mutex for serializing job-store RMW. */
export function createAsyncMutex() {
  let chain: Promise<void> = Promise.resolve();
  return function withLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = chain.then(fn, fn);
    chain = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  };
}
