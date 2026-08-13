import { pathToFileURL } from "node:url";
import path from "node:path";

const mod = await import(
  pathToFileURL(path.join(process.cwd(), "lib/parliamentary/detect.ts")).href
);
const fails = mod.runDetectSelfTest();
if (fails.length) {
  console.error("FAIL", fails);
  process.exit(1);
}
console.log("parl detect self-test OK");
