/** Approximate lon/lat for PROJECT_COUNTRIES markers (Caribbean-framed map). */
export type CountryCoord = { lon: number; lat: number };

export const COUNTRY_COORDS: Record<string, CountryCoord> = {
  ag: { lon: -61.85, lat: 17.05 },
  bs: { lon: -77.4, lat: 25.03 },
  bb: { lon: -59.55, lat: 13.17 },
  bz: { lon: -88.5, lat: 17.25 },
  cu: { lon: -77.78, lat: 21.52 },
  dm: { lon: -61.37, lat: 15.42 },
  do: { lon: -70.16, lat: 18.74 },
  gd: { lon: -61.68, lat: 12.12 },
  gy: { lon: -58.93, lat: 6.8 },
  ht: { lon: -72.29, lat: 18.97 },
  jm: { lon: -77.3, lat: 18.11 },
  kn: { lon: -62.78, lat: 17.36 },
  lc: { lon: -60.98, lat: 13.91 },
  vc: { lon: -61.2, lat: 13.25 },
  sr: { lon: -56.03, lat: 4.0 },
  tt: { lon: -61.22, lat: 10.69 },
  aw: { lon: -69.97, lat: 12.52 },
  cw: { lon: -68.99, lat: 12.17 },
  sx: { lon: -63.05, lat: 18.04 },
  mq: { lon: -61.02, lat: 14.64 },
  gp: { lon: -61.55, lat: 16.27 },
  ky: { lon: -81.25, lat: 19.31 },
  bm: { lon: -64.78, lat: 32.32 },
  tc: { lon: -71.8, lat: 21.75 },
  vg: { lon: -64.62, lat: 18.42 },
  vi: { lon: -64.9, lat: 18.34 },
  pr: { lon: -66.59, lat: 18.22 },
  us: { lon: -95.71, lat: 37.09 },
  gb: { lon: -3.44, lat: 55.38 },
  ca: { lon: -106.35, lat: 56.13 },
  br: { lon: -51.93, lat: -14.24 },
  co: { lon: -74.3, lat: 4.57 },
  ve: { lon: -66.59, lat: 6.42 },
  xx: { lon: -65.5, lat: 15.2 },
};

/** Caribbean-framed view (Americas + Atlantic partners). */
export const MAP_BOUNDS = {
  west: -110,
  east: 10,
  south: -38,
  north: 62,
} as const;

export const MAP_VIEWBOX = { width: 1000, height: 560 } as const;

export function projectLonLat(
  lon: number,
  lat: number,
  bounds = MAP_BOUNDS,
  view = MAP_VIEWBOX
): { x: number; y: number } {
  const x = ((lon - bounds.west) / (bounds.east - bounds.west)) * view.width;
  const y = ((bounds.north - lat) / (bounds.north - bounds.south)) * view.height;
  return { x, y };
}
