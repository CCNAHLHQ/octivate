/**
 * Manually (re)generate self-signed PEMs into certs/<domain>/.
 * serve:prod also does this automatically when PEMs are missing.
 *
 *   npm run certs:selfsigned
 */
import { ensureTls } from "../server/ensure-tls.mjs";

const result = await ensureTls({ force: true });
console.log(`\n[certs:selfsigned] Done → ${result.paths.dir}`);
console.log("serve:prod will pick these up automatically.\n");
