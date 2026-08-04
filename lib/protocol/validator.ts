import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import fs from "fs";
import path from "path";
import { SCHEMAS_DIR, SCHEMA_BASE_URI } from "./paths";

let ajvInstance: Ajv2020 | null = null;

function getAjv(): Ajv2020 {
  if (ajvInstance) return ajvInstance;

  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
    validateSchema: false,
  });
  addFormats(ajv);

  const schemaFiles = fs.readdirSync(SCHEMAS_DIR).filter((f) => f.endsWith(".schema.json"));
  for (const file of schemaFiles) {
    const raw = fs.readFileSync(path.join(SCHEMAS_DIR, file), "utf8");
    const schema = JSON.parse(raw) as Record<string, unknown>;
    const id = (schema.$id as string) || `${SCHEMA_BASE_URI}${file}`;
    ajv.addSchema({ ...schema, $id: id });
  }

  ajvInstance = ajv;
  return ajv;
}

export function validateAgainstSchema(
  schemaFile: string,
  data: unknown
): { valid: true } | { valid: false; errors: string[] } {
  const ajv = getAjv();
  const schemaId = `${SCHEMA_BASE_URI}${schemaFile}`;
  const validate = ajv.getSchema(schemaId);
  if (!validate) {
    return { valid: false, errors: [`Schema not found: ${schemaFile}`] };
  }
  const valid = validate(data);
  if (valid) return { valid: true };
  const errors = (validate.errors || []).map(
    (e) => `${e.instancePath || "/"} ${e.message || "invalid"}`.trim()
  );
  return { valid: false, errors };
}

export function listSchemaFiles(): string[] {
  return fs.readdirSync(SCHEMAS_DIR).filter((f) => f.endsWith(".schema.json"));
}
