import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { createAsyncMutex } from "@/lib/parliamentary/atomic-mutex";

export { createAsyncMutex } from "@/lib/parliamentary/atomic-mutex";

const writeLocks = new Map<string, ReturnType<typeof createAsyncMutex>>();

function lockFor(file: string) {
  const key = path.resolve(file);
  let lock = writeLocks.get(key);
  if (!lock) {
    lock = createAsyncMutex();
    writeLocks.set(key, lock);
  }
  return lock;
}

function tmpPath(file: string) {
  return `${file}.${process.pid}.${Date.now()}.${randomBytes(4).toString("hex")}.tmp`;
}

function isRetryableRename(code: string | undefined) {
  return (
    code === "EPERM" ||
    code === "EEXIST" ||
    code === "EACCES" ||
    code === "EBUSY" ||
    code === "ENOENT"
  );
}

/**
 * Windows-safe atomic JSON write: unique temp → rename, with copy+unlink fallback
 * on lock races. Serialized per destination path so concurrent writers cannot
 * collide on the same .tmp name (Date.now collision) or delete each other's temps.
 */
export async function atomicWriteJson(file: string, data: unknown): Promise<void> {
  const withLock = lockFor(file);
  return withLock(async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const payload = JSON.stringify(data, null, 2);

    for (let attempt = 0; attempt < 10; attempt++) {
      const tmp = tmpPath(file);
      try {
        await fs.writeFile(tmp, payload, "utf8");
        try {
          await fs.rename(tmp, file);
          return;
        } catch (err) {
          const code = (err as NodeJS.ErrnoException)?.code;
          if (isRetryableRename(code)) {
            try {
              await fs.copyFile(tmp, file);
              await fs.unlink(tmp).catch(() => undefined);
              return;
            } catch {
              await fs.unlink(tmp).catch(() => undefined);
              await new Promise((r) => setTimeout(r, 35 * (attempt + 1)));
              continue;
            }
          }
          await fs.unlink(tmp).catch(() => undefined);
          throw err;
        }
      } catch (err) {
        const code = (err as NodeJS.ErrnoException)?.code;
        if (isRetryableRename(code) && attempt < 9) {
          await new Promise((r) => setTimeout(r, 35 * (attempt + 1)));
          continue;
        }
        // Last resort — never leave the worker dead on a progress write.
        if (attempt >= 9) {
          await fs.writeFile(file, payload, "utf8");
          return;
        }
        throw err;
      }
    }
  });
}

/** Rename with the same Windows lock retry/copy fallback as atomicWriteJson. */
export async function atomicRename(src: string, dest: string): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      await fs.rename(src, dest);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (isRetryableRename(code)) {
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

/** Remove stale *.tmp sidecars left by crashed writers in a directory. */
export async function pruneStaleTmpFiles(
  dir: string,
  opts?: { maxAgeMs?: number }
): Promise<number> {
  const maxAgeMs = opts?.maxAgeMs ?? 60_000;
  const now = Date.now();
  let removed = 0;
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return 0;
  }
  for (const name of entries) {
    if (!name.endsWith(".tmp")) continue;
    const full = path.join(dir, name);
    try {
      const st = await fs.stat(full);
      if (now - st.mtimeMs < maxAgeMs) continue;
      await fs.unlink(full);
      removed += 1;
    } catch {
      /* ignore */
    }
  }
  return removed;
}
