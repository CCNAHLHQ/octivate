/**
 * Durable parliamentary media worker: discover → download → faster-whisper ASR.
 *
 *   npm run parl:worker
 *   node --env-file=.env --experimental-strip-types --import ./server/parl-ts-register.mjs server/parl-media-worker.mjs
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

const pipelineUrl = pathToFileURL(
  path.join(root, "lib", "parliamentary", "pipeline.ts")
).href;
const logUrl = pathToFileURL(path.join(root, "lib", "parliamentary", "log.ts")).href;
const configUrl = pathToFileURL(
  path.join(root, "lib", "parliamentary", "config.ts")
).href;

const { runPipelineLoop } = await import(pipelineUrl);
const { parlLog } = await import(logUrl);
const { parlDryRun, asrConcurrency } = await import(configUrl);

parlLog("info", "parl-media worker starting", {
  pid: process.pid,
  cwd: process.cwd(),
  dryRun: parlDryRun(),
  dryRunEnv: process.env.PARL_MEDIA_DRY_RUN ?? "(unset)",
  asrConcurrency: asrConcurrency(),
  python: process.env.PARL_PYTHON || "(default)",
  ytdlp: process.env.YT_DLP_PATH || "(PATH)",
  ffmpeg: process.env.FFMPEG_PATH || "(PATH)",
});

let stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  parlLog("info", `parl-media worker stopping (${signal})`);
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await runPipelineLoop({ pollMs: 2000 });
} catch (err) {
  parlLog("error", "parl-media worker crashed", {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
}
