import path from "path";

export const PROTOCOL_ROOT = path.join(/* turbopackIgnore: true */ process.cwd(), "protocol", "v0.2");
export const SCHEMAS_DIR = path.join(PROTOCOL_ROOT, "schemas");
export const AGENTS_DIR = path.join(PROTOCOL_ROOT, "agents");
export const CONFIG_DIR = path.join(PROTOCOL_ROOT, "config");
export const SCHEMA_BASE_URI = "https://censii.co/octivate/schemas/";
