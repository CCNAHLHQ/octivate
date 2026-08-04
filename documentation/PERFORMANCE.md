# Performance notes — Octivate

## Problems found (full pass)

| Issue | Impact | Mitigation applied |
|---|---|---|
| `SiteChrome` was a client boundary wrapping every page | Forced large client JS on all routes | Chrome is now a **Server Component**; only navbar / progress are client |
| Framer Motion loaded with navbar logo | Extra ~30–50KB on every page | `LogoPulse` **dynamic-imported** (`ssr: false`) |
| Recharts pulled into overview eagerly | Slow first paint / hydration risk | Charts **lazy-loaded** via `lazy-charts` + mount gate |
| Dashboard / Operator as monolithic client pages | Slow CTA navigations | Routes use `next/dynamic` + `loading.tsx` skeletons |
| No navigation feedback | Buttons felt “stuck” | Top **progress bar** on link clicks |
| Repeat API fetches on every visit | Lag when bouncing between pages | Client **GET cache + inflight dedupe** (15s TTL) + `Cache-Control` on list APIs |
| Lucide / recharts / framer full imports | Bloated shared chunks | `optimizePackageImports` in `next.config.js` |

## Technologies / patterns introduced

1. **App Router `loading.tsx`** — instant route fallbacks  
2. **`next/dynamic`** — code-split heavy islands (overview, operator, charts, logo)  
3. **In-memory API client cache** — `lib/api-client.ts`  
4. **HTTP `Cache-Control`** via `jsonCached()` for idempotent GETs  
5. **Navigation progress indicator** — perceived performance for CTAs  

## Still recommended (next phase)

- **React Query / SWR** if live polling grows beyond mock file store  
- Split landing into server sections + smaller client islands (hero motion only)  
- Real CDN caching at Cloudflare for static `_next/static`  
- Prefer `Link` over imperative navigation everywhere (already the default)  
- Measure with Lighthouse / Web Vitals on production HTTPS  

## Local note

`next dev` compiles routes on first visit — CTAs feel slower in development than production. Use `npm run build && npm start` to validate real navigation speed.
