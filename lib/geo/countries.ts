export type CountryOption = {
  code: string;
  name: string;
  aliases?: string[];
};

/** Caribbean + regional partners used across Octivate theatres. */
export const PROJECT_COUNTRIES: CountryOption[] = [
  { code: "ag", name: "Antigua and Barbuda" },
  { code: "bs", name: "Bahamas" },
  { code: "bb", name: "Barbados" },
  { code: "bz", name: "Belize" },
  { code: "cu", name: "Cuba" },
  { code: "dm", name: "Dominica" },
  { code: "do", name: "Dominican Republic" },
  { code: "gd", name: "Grenada" },
  { code: "gy", name: "Guyana" },
  { code: "ht", name: "Haiti" },
  { code: "jm", name: "Jamaica" },
  { code: "kn", name: "Saint Kitts and Nevis" },
  { code: "lc", name: "Saint Lucia" },
  { code: "vc", name: "Saint Vincent and the Grenadines" },
  { code: "sr", name: "Suriname" },
  {
    code: "tt",
    name: "Trinidad and Tobago",
    aliases: ["Trinidad & Tobago", "T&T", "Trinidad"],
  },
  { code: "aw", name: "Aruba" },
  { code: "cw", name: "Curaçao" },
  { code: "sx", name: "Sint Maarten" },
  { code: "mq", name: "Martinique" },
  { code: "gp", name: "Guadeloupe" },
  { code: "ky", name: "Cayman Islands" },
  { code: "bm", name: "Bermuda" },
  { code: "tc", name: "Turks and Caicos Islands" },
  { code: "vg", name: "British Virgin Islands" },
  { code: "vi", name: "U.S. Virgin Islands" },
  { code: "pr", name: "Puerto Rico" },
  { code: "us", name: "United States", aliases: ["USA", "US"] },
  { code: "gb", name: "United Kingdom", aliases: ["UK", "Britain"] },
  { code: "ca", name: "Canada" },
  { code: "br", name: "Brazil" },
  { code: "co", name: "Colombia" },
  { code: "ve", name: "Venezuela" },
  {
    code: "xx",
    name: "CARICOM / Regional",
    aliases: [
      "CARICOM",
      "Regional",
      "CARICOM-wide",
      "CARICOM / Regional",
      "Caribbean",
      "Region",
    ],
  },
];

/** Best-effort flag resolution for source registry country labels. */
export function resolveSourceCountry(value?: string | null): CountryOption | undefined {
  if (!value?.trim()) return undefined;
  return (
    resolveCountryOption(value) ||
    PROJECT_COUNTRIES.find((c) =>
      value.toLowerCase().includes(c.name.toLowerCase())
    )
  );
}

export function countryFlagUrl(code: string, width = 20): string {
  if (!code || code === "xx") return "";
  return `https://flagcdn.com/w${width}/${code.toLowerCase()}.png`;
}

export function resolveCountryOption(value: string): CountryOption | undefined {
  const q = value.trim().toLowerCase();
  if (!q) return undefined;
  return PROJECT_COUNTRIES.find(
    (c) =>
      c.name.toLowerCase() === q ||
      c.code === q ||
      c.aliases?.some((a) => a.toLowerCase() === q)
  );
}

export function filterCountries(query: string): CountryOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return PROJECT_COUNTRIES;
  return PROJECT_COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.code.includes(q) ||
      c.aliases?.some((a) => a.toLowerCase().includes(q))
  );
}
