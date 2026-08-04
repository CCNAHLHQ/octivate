const JURISDICTIONS = [
  "GUYANA",
  "TRINIDAD & TOBAGO",
  "JAMAICA",
  "BARBADOS",
  "OECS",
  "SURINAME",
  "DOMINICAN REPUBLIC",
  "BAHAMAS",
  "BELIZE",
  "HAITI",
  "CURAÇAO",
  "ST LUCIA",
  "GRENADA",
  "ANTIGUA & BARBUDA",
  "DOMINICA",
  "ST VINCENT",
  "ST KITTS & NEVIS",
  "ARUBA",
  "MARTINIQUE",
  "GUADELOUPE",
  "CAYMAN ISLANDS",
] as const;

/** Animated Caribbean jurisdictions marquee — restored from the original landing footer. */
export function JurisdictionTicker() {
  const sequence = (
    <span>
      {JURISDICTIONS.map((name, i) => (
        <span key={`${name}-${i}`} className="jur-item">
          {name}
          <i aria-hidden="true" />
        </span>
      ))}
    </span>
  );

  return (
    <div className="jur-ticker" aria-hidden="true">
      <div className="jur-track">
        {sequence}
        {sequence}
      </div>
    </div>
  );
}
