# Future Caribbean Logbook — octivate.io evidence pack

Team **Shemuel** · Open Track · product **Octivate** (CENSII).

Screenshots in `screenshots/` are **live captures from https://octivate.io** (marketing + signed-in workspace/operator surfaces). Each Future Caribbean logbook day links to its matching evidence file on GitHub.

| File | Source |
|---|---|
| `00-landing.png` | octivate.io marketing landing |
| `00-dashboard.png` | Signed-in workspace overview |
| `{Dow}_{MM}_{DD}.png` | Day-mapped octivate.io surface |
| `99-final.png` | Operator → Operations (publisher card) |

Publishing destination: **https://os.futurecaribbean.com/builder/logbook** (text only — **never** used as evidence screenshot source)  
Operator control: **Operator → Operations → Publish to Future Caribbean**

Detect missing days / capture only gaps:

```bash
node scripts/capture-octivate-evidence.mjs --only-missing
```

Full refresh (rewrites day PNGs from octivate.io):

```bash
node scripts/capture-octivate-evidence.mjs
```
