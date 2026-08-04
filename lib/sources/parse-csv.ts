/** Minimal RFC4180-ish CSV parser (quoted fields, escaped quotes). */

export type CsvParseOptions = {
  /** Explicit delimiter; when omitted, auto-detect from the header line. */
  delimiter?: "," | ";" | "\t";
};

function detectDelimiter(headerLine: string): "," | ";" | "\t" {
  let inQuotes = false;
  let commas = 0;
  let semis = 0;
  let tabs = 0;
  for (let i = 0; i < headerLine.length; i++) {
    const c = headerLine[i];
    if (c === '"') {
      if (inQuotes && headerLine[i + 1] === '"') {
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;
    if (c === ",") commas += 1;
    else if (c === ";") semis += 1;
    else if (c === "\t") tabs += 1;
  }
  if (tabs > commas && tabs > semis) return "\t";
  if (semis > commas) return ";";
  return ",";
}

export function parseCsv(text: string, opts: CsvParseOptions = {}): string[][] {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const firstLine = normalized.split("\n").find((l) => l.trim().length > 0) || "";
  const delimiter = opts.delimiter || detectDelimiter(firstLine);

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let quoted = false;

  const pushCell = () => {
    row.push(cell);
    cell = "";
  };
  const pushRow = () => {
    pushCell();
    if (row.some((c) => c.trim().length > 0)) rows.push(row);
    row = [];
  };

  while (i < normalized.length) {
    const c = normalized[i];
    if (quoted) {
      if (c === '"') {
        if (normalized[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      cell += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      quoted = true;
      i += 1;
      continue;
    }
    if (c === delimiter) {
      pushCell();
      i += 1;
      continue;
    }
    if (c === "\n") {
      pushRow();
      i += 1;
      continue;
    }
    cell += c;
    i += 1;
  }
  if (cell.length > 0 || row.length > 0) pushRow();
  return rows;
}

export function csvToObjects(text: string, opts?: CsvParseOptions): Record<string, string>[] {
  const rows = parseCsv(text, opts);
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim().replace(/^\uFEFF/, ""));
  return rows.slice(1).map((cells) => {
    const obj: Record<string, string> = {};
    for (let i = 0; i < headers.length; i += 1) {
      const key = headers[i];
      if (!key) continue;
      obj[key] = (cells[i] ?? "").trim();
    }
    return obj;
  });
}
