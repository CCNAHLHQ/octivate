export const PROJECT_SECTORS = [
  "Energy",
  "Artificial Intelligence",
  "Infrastructure",
  "Tourism",
  "Finance",
  "Agriculture",
  "Healthcare",
  "Education",
  "Telecommunications",
  "Mining",
  "Logistics",
  "Public Sector",
  "Climate & Environment",
  "Security & Defence",
  "Other",
] as const;

export type ProjectSector = (typeof PROJECT_SECTORS)[number];

export function filterSectors(query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...PROJECT_SECTORS];
  return PROJECT_SECTORS.filter((s) => s.toLowerCase().includes(q));
}

export function normalizeSector(value: string): string {
  const hit = PROJECT_SECTORS.find((s) => s.toLowerCase() === value.trim().toLowerCase());
  return hit || value.trim() || "Other";
}
