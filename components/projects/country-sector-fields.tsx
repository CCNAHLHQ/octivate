"use client";

import { useMemo } from "react";
import {
  SearchableSelect,
  type SearchableOption,
} from "@/components/ui/searchable-select";
import {
  PROJECT_COUNTRIES,
  countryFlagUrl,
  resolveCountryOption,
} from "@/lib/geo/countries";
import { PROJECT_SECTORS, normalizeSector } from "@/lib/geo/sectors";

export function CountrySelect({
  value,
  onChange,
  required,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
  disabled?: boolean;
}) {
  const options: SearchableOption[] = useMemo(
    () =>
      PROJECT_COUNTRIES.map((c) => {
        const flag = countryFlagUrl(c.code, 20);
        return {
          value: c.name,
          label: c.name,
          keywords: [c.code, ...(c.aliases || [])],
          leading: flag ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={flag}
              alt=""
              width={16}
              height={12}
              className="ws-country-flag"
              loading="lazy"
            />
          ) : (
            <span className="ws-country-flag is-regional" aria-hidden>
              ◈
            </span>
          ),
        };
      }),
    []
  );

  // Accept legacy aliases (e.g. "Trinidad & Tobago") by normalizing display value.
  const resolved = resolveCountryOption(value)?.name || value;

  return (
    <SearchableSelect
      value={resolved}
      onChange={onChange}
      options={options}
      placeholder="Country"
      searchPlaceholder="Search countries…"
      required={required}
      disabled={disabled}
    />
  );
}

export function SectorSelect({
  value,
  onChange,
  required,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
  disabled?: boolean;
}) {
  const options: SearchableOption[] = useMemo(
    () => PROJECT_SECTORS.map((s) => ({ value: s, label: s })),
    []
  );
  const normalized = normalizeSector(value);

  return (
    <SearchableSelect
      value={PROJECT_SECTORS.includes(normalized as (typeof PROJECT_SECTORS)[number]) ? normalized : value}
      onChange={onChange}
      options={options}
      placeholder="Sector"
      searchPlaceholder="Search sectors…"
      required={required}
      disabled={disabled}
    />
  );
}
