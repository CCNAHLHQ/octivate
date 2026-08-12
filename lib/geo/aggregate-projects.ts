import {
  PROJECT_COUNTRIES,
  resolveCountryOption,
  type CountryOption,
} from "@/lib/geo/countries";
import { COUNTRY_COORDS } from "@/lib/geo/country-coords";
import type { Project } from "@/lib/types";

export type CountryProjectRef = {
  id: string;
  name: string;
  status: Project["status"];
  sector: string;
};

export type CountryProjectBucket = {
  code: string;
  name: string;
  count: number;
  active: number;
  archived: number;
  projects: CountryProjectRef[];
  lon: number;
  lat: number;
};

export function aggregateProjectsByCountry(projects: Project[]): CountryProjectBucket[] {
  const byCode = new Map<string, CountryProjectBucket>();

  for (const option of PROJECT_COUNTRIES) {
    const coord = COUNTRY_COORDS[option.code];
    if (!coord) continue;
    byCode.set(option.code, {
      code: option.code,
      name: option.name,
      count: 0,
      active: 0,
      archived: 0,
      projects: [],
      lon: coord.lon,
      lat: coord.lat,
    });
  }

  for (const project of projects) {
    const option: CountryOption | undefined = resolveCountryOption(project.country);
    const code = option?.code || "xx";
    const name = option?.name || project.country || "Regional";
    let bucket = byCode.get(code);
    if (!bucket) {
      const coord = COUNTRY_COORDS[code] || COUNTRY_COORDS.xx;
      bucket = {
        code,
        name,
        count: 0,
        active: 0,
        archived: 0,
        projects: [],
        lon: coord.lon,
        lat: coord.lat,
      };
      byCode.set(code, bucket);
    }
    bucket.count += 1;
    if (project.status === "archived") bucket.archived += 1;
    else bucket.active += 1;
    bucket.projects.push({
      id: project.id,
      name: project.name,
      status: project.status,
      sector: project.sector,
    });
  }

  for (const bucket of byCode.values()) {
    bucket.projects.sort((a, b) => a.name.localeCompare(b.name));
  }

  return [...byCode.values()]
    .filter((b) => b.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
