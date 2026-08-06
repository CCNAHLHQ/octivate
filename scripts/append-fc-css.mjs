import fs from "fs";

const p = "app/operator/operator.css";
let css = fs.readFileSync(p, "utf8");
if (css.includes("op-fc-panel")) {
  console.log("already present");
  process.exit(0);
}
css += `
/* Future Caribbean Logbook publisher (Operations) */
.op-fc-panel { display: grid; gap: 0.85rem; }
.op-fc-target {
  display: flex; gap: 0.65rem; align-items: flex-start;
  padding: 0.75rem 0.85rem; border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--tide) 28%, var(--line-strong));
  background: linear-gradient(135deg, color-mix(in srgb, var(--tide) 10%, transparent), transparent 55%), color-mix(in srgb, var(--ink) 88%, #041016);
}
.op-fc-target-label { margin: 0; font-family: var(--f-mono); font-size: 0.62rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--tide); }
.op-fc-target-link { display: inline-flex; align-items: center; gap: 0.35rem; margin-top: 0.15rem; color: var(--foam); font-weight: 650; font-size: 0.92rem; text-decoration: none; }
.op-fc-target-link:hover { color: var(--tide); }
.op-fc-target-url { margin: 0.2rem 0 0; font-size: 0.72rem; color: var(--mist); word-break: break-all; }
.op-fc-stats { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.op-src-pulse-chip.is-coral { color: #FFA79C; border-color: color-mix(in srgb, var(--coral) 35%, var(--line)); background: color-mix(in srgb, var(--coral) 12%, transparent); }
.op-fc-progress { display: grid; gap: 0.4rem; }
.op-fc-progress-meta { display: flex; justify-content: space-between; gap: 0.75rem; font-size: 0.78rem; color: var(--mist); }
.op-fc-steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.45rem; }
.op-fc-step { display: grid; grid-template-columns: auto 1fr; gap: 0.65rem; padding: 0.55rem 0.65rem; border-radius: 10px; border: 1px solid var(--line); background: color-mix(in srgb, var(--ink) 92%, #0a0e18); }
.op-fc-step-idx { width: 1.35rem; height: 1.35rem; border-radius: 999px; display: grid; place-items: center; font-family: var(--f-mono); font-size: 0.65rem; color: var(--foam); background: color-mix(in srgb, var(--violet) 22%, transparent); border: 1px solid color-mix(in srgb, var(--violet) 35%, var(--line)); }
.op-fc-step.is-done .op-fc-step-idx { background: color-mix(in srgb, var(--tide) 22%, transparent); border-color: color-mix(in srgb, var(--tide) 40%, var(--line)); }
.op-fc-step.is-running .op-fc-step-idx { background: color-mix(in srgb, var(--info, #6ea8fe) 22%, transparent); }
.op-fc-step.is-error .op-fc-step-idx { background: color-mix(in srgb, var(--coral) 22%, transparent); }
.op-fc-step-top { display: flex; justify-content: space-between; gap: 0.75rem; align-items: center; }
.op-fc-step-top p { margin: 0; font-size: 0.84rem; color: var(--foam); }
.op-fc-step-detail { margin: 0.25rem 0 0; font-size: 0.74rem; color: var(--mist); }
.op-fc-error { margin: 0; color: #FFA79C; font-size: 0.8rem; }
.op-fc-days { border: 1px solid var(--line); border-radius: 10px; padding: 0.55rem 0.75rem; background: color-mix(in srgb, var(--ink) 94%, #0a0e18); }
.op-fc-days summary { cursor: pointer; font-size: 0.78rem; color: var(--mist); }
.op-fc-days ul { margin: 0.55rem 0 0; padding: 0; list-style: none; display: grid; gap: 0.35rem; }
.op-fc-days li { display: flex; justify-content: space-between; gap: 0.75rem; font-size: 0.74rem; color: var(--foam); }
.op-fc-days a { color: var(--tide); text-decoration: none; white-space: nowrap; }
.op-fc-days a:hover { text-decoration: underline; }
`;
fs.writeFileSync(p, css, "utf8");
console.log("appended", Buffer.byteLength(css, "utf8"));
