import type { Monitor, Project } from "@/lib/types";

export type ProjectSort = "updated" | "name" | "country";
export type MonitorSort = "alerts" | "updated" | "name" | "country";

export function sortProjects(items: Project[], sort: ProjectSort): Project[] {
  const copy = [...items];
  switch (sort) {
    case "name":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case "country":
      return copy.sort((a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name));
    case "updated":
    default:
      return copy.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }
}

function alertTime(iso?: string) {
  return iso ? Date.parse(iso) : 0;
}

export function sortMonitors(items: Monitor[], sort: MonitorSort): Monitor[] {
  const copy = [...items];
  switch (sort) {
    case "alerts":
      return copy.sort(
        (a, b) => b.alertCount - a.alertCount || alertTime(b.lastAlertAt) - alertTime(a.lastAlertAt)
      );
    case "name":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case "country":
      return copy.sort(
        (a, b) => (a.countries[0] ?? "").localeCompare(b.countries[0] ?? "") || a.name.localeCompare(b.name)
      );
    case "updated":
    default:
      return copy.sort(
        (a, b) => alertTime(b.lastAlertAt) - alertTime(a.lastAlertAt) || a.name.localeCompare(b.name)
      );
  }
}
