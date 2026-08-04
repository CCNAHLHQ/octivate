import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data", "local");

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function readCollection<T>(name: string, fallback: T[]): Promise<T[]> {
  await ensureDir();
  const file = path.join(DATA_DIR, `${name}.json`);
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T[];
  } catch {
    await fs.writeFile(file, JSON.stringify(fallback, null, 2), "utf8");
    return fallback;
  }
}

export async function writeCollection<T>(name: string, data: T[]): Promise<void> {
  await ensureDir();
  const file = path.join(DATA_DIR, `${name}.json`);
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

/** Remove one record by `id`. Returns the removed item, or null if missing. */
export async function removeFromCollection<T extends { id: string }>(
  name: string,
  id: string,
  fallback: T[] = []
): Promise<{ removed: T | null; remaining: T[] }> {
  const items = await readCollection<T>(name, fallback);
  const idx = items.findIndex((item) => item.id === id);
  if (idx < 0) return { removed: null, remaining: items };
  const [removed] = items.splice(idx, 1);
  await writeCollection(name, items);
  return { removed, remaining: items };
}

export async function readObject<T>(name: string, fallback: T): Promise<T> {
  await ensureDir();
  const file = path.join(DATA_DIR, `${name}.json`);
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    await fs.writeFile(file, JSON.stringify(fallback, null, 2), "utf8");
    return fallback;
  }
}

export async function writeObject<T>(name: string, data: T): Promise<void> {
  await ensureDir();
  const file = path.join(DATA_DIR, `${name}.json`);
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
