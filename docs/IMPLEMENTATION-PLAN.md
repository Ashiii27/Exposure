# Exposure — Implementation Plan

Status: v1.2, for review. Written 2026-10-01 after a full inspection of the repo at commit `3bcf14f` ("initialised the repo") and verification of external facts (Cloudflare limits, tracker-list licenses) against current sources. Links inline.

Revision rule: at the end of every phase, spend 30 minutes re-estimating the next phase and updating this doc. A plan that never changes is a plan nobody is reading.

Stopping rule: v1.2 is the last planning-only revision — it fixes a real storage-growth defect (§7) and adds score calibration (§Phase 2). Further changes should come from phase-gate feedback while building, not from more paper passes. Start Phase 0.

Inputs: the project brief (Website X-ray / Exposure), the actual repo contents, and the checks listed in §2.

---

## 1. What the repo actually is today (audit)

Every folder is already scaffolded, but **every source file is a 1–3 line placeholder**. There is no real code, no installable package set, and nothing builds or tests yet. The scaffold is useful: it already encodes the intended module breakdown, and this plan builds on it rather than inventing a new layout.

Repo inventory:

| Area | Files | State |
|---|---|---|
| `docs/` | 11 md files (PRD, ARCHITECTURE, DESIGN, METHODOLOGY, METRICS, PERSONAS, COMPETITORS, LEGAL, THREAT-MODEL) | one-line placeholders |
| `lists/` | `fetch.sh`, `merge-lists.js`, 3 normalizers, `cdn-allowlist.json` (`[]`), `package.json` | placeholders |
| `scanner/` | 16 `src/*.ts` stubs, 5 placeholder tests, `sites.csv` (1 dummy row), minimal `package.json`/`tsconfig.json` | placeholders |
| `scripts/` | `setup.sh`, `deploy.sh`, `seed-d1.sh` | echo placeholders |
| `web/` | Vite skeleton, 6 pages, 12 components, 6 css files, router/api/utils stubs | placeholders |
| `worker/` | routes (scan, result, leaderboard, export, og-image, bot-meta), services (cache, quota, rate-limit, blocklist), middleware, `og/`, 2 migrations, `wrangler.toml` (no bindings) | placeholders |
| Root | `.env.example`, `.eslintrc.json`, `.prettierrc`, `tsconfig.base.json`, `vitest.workspace.ts`, README (title only), MIT LICENSE | minimal |

### Mismatches between the brief and the repo

The brief's top-level description is accurate (folders, files, missing root package.json / .gitignore / .github / data folder / shared package — all confirmed missing). Differences found inside:

1. **Commit count**: brief says 2 commits on main; the repo has 1 (`3bcf14f`). Cosmetic.
2. **The repo is fully scaffolded.** The brief implies the folders were empty/unknown. In reality ~90 placeholder files define a module layout that matches the brief closely (scanner modules, web pages/components, worker routes/services, lists normalizers). The plan below maps onto these files.
3. **`worker/src/middleware/*` uses Express-style `(req, res, next)` signatures.** Wrong model for Cloudflare Workers (fetch handler: `Request` → `Response`, no `next()`). These must be rewritten, not filled in.
4. **`worker/migrations/0001_initial.sql` creates a `jobs` table using `SERIAL`.** D1 is SQLite — `SERIAL` is invalid — and the needed schema is results/cache/quota, not jobs. Replace entirely.
5. **Duplicated logic between scanner and worker**: `fingerprint-wrappers.ts` exists in both, and `classify.ts` (scanner) vs `classify-worker.ts` (worker). This is exactly the drift risk the brief flags; the shared package (§3.3) removes it.
6. **`worker/src/og/template.tsx` uses JSX** but no build config supports it. Decide in Phase 6 (plan: generate OG images in the nightly job with Playwright screenshots; no JSX in the Worker).
7. **`tsconfig.base.json` has no `strict`**, no `moduleResolution`, no `outDir` — inadequate for a security-focused TS project. Fixed in Phase 0.
8. **`.eslintrc.json` uses the deprecated eslintrc format.** Move to flat config (`eslint.config.js`) with TypeScript ESLint in Phase 0.
9. **`vitest.workspace.ts` exports an empty `defineConfig`** — it doesn't actually include the packages. Fixed in Phase 0.
10. **`.env.example` holds `NODE_ENV`/`PORT`** — meaningless for this stack. Replace with real values (wrangler uses `.dev.vars`).
11. **`scanner/sites.csv`** exists with one dummy row — the real top-300–500 source is an open decision (§12).
12. No `package-lock.json`, no deps anywhere — `npm install` at root currently fails (no root `package.json`). Nothing runnable until Phase 0.

---

## 2. Verified external facts (checked 2026-10-01)

Things the brief said to verify before relying on them:

1. **Cloudflare Browser Rendering is now called "Browser Run"** (docs live at `developers.cloudflare.com/browser-run/`). Free plan limits confirmed: **10 minutes browser time/day, 3 concurrent browsers, 1 new browser instance per 20 seconds, 60s browser timeout**, 429 once the daily cap is hit; `/crawl` endpoint 5 jobs/day. ([Cloudflare docs — Limits](https://developers.cloudflare.com/browser-run/limits/), [FAQ](https://developers.cloudflare.com/browser-run/faq/))
2. **Playwright IS supported on Browser Run**, since April 2025, via Cloudflare's fork `@cloudflare/playwright` (Puppeteer via `@cloudflare/puppeteer` also works). So the same Playwright-based capture code can run in the nightly GitHub Actions job and in the Worker — this is the key decision the brief left open, and it goes to Playwright. ([summary](https://agentpedia.codes/agent-skills/ai-tools/cloudflare-browser-rendering) — re-verify against Cloudflare docs at Phase 5 kickoff.)
3. **Tracker-list licenses** (matters — Exposure's code is MIT, none of these are):
   - Disconnect Tracker Protection list (services.json, includes entity ownership): **CC BY-NC-SA 4.0** ([repo](https://github.com/disconnectme/disconnect-tracking-protection)).
   - DuckDuckGo Tracker Radar dataset: **CC BY-NC-SA 4.0** ([repo](https://github.com/duckduckgo/tracker-radar)); DDG's newer tracker-blocklists are also CC BY-NC-SA 4.0 ([repo](https://github.com/duckduckgo/tracker-blocklists)).
   - EasyList/EasyPrivacy: **dual GPLv3 / CC BY-SA 3.0** ([licence page](https://easylist.to/pages/licence.html)).
   - Consequence (§8): do not commit these lists or a merged derivative into the MIT-licensed repo. Fetch at build/scan time (`lists/fetch.sh`), generate the merged index as a build artifact, attribute sources on the methodology page.
4. GitHub Actions standard runners are free for public repos (long-standing policy; recheck at Phase 4). Headless Chromium on `ubuntu-latest` works with Playwright out of the box.

Approximate free-tier budget (verify in dashboard at deploy time): Workers 100k req/day; D1 ~5M row reads/day, 100k writes/day, 5 GB storage; R2 10 GB storage; Pages unlimited bandwidth, 500 builds/month (Direct Upload builds don't consume Git builds); KV 100k reads/day.

---

## 3. Target architecture

### 3.1 Final repo layout

```
Exposure/
├─ package.json                  # workspaces: packages/shared, lists, scanner, web, worker
├─ .gitignore  .nvmrc  eslint.config.js  .prettierrc  tsconfig.base.json  vitest.workspace.ts
├─ packages/shared/              # THE contract: schema, classification, scoring, url validation,
│  └─ src/                       #   fingerprint init-script, constants (colors, categories, weights)
├─ lists/                        # fetch.sh + TS normalizers → build/trackers-index.json (gitignored)
├─ scanner/                      # Playwright scanner for GitHub Actions (nightly, bulk)
├─ web/                          # Vite static SPA → Cloudflare Pages (+ _worker.js for bot meta)
├─ worker/                       # Browser Run live-scan API (exposure-api.<domain>)
├─ scripts/                      # setup.sh, deploy.sh, seed-d1.sh
├─ .github/workflows/            # ci.yml (Phase 0), nightly-scan.yml (Phase 4)
├─ docs/                         # filled phase by phase (see §9)
└─ (branch: data)                # nightly results + leaderboard history, never merged to main
```

### 3.2 Deployables and data flows (all free tier)

**Nightly path (bulk, quota-proof, the public launch):**
```
GitHub Actions cron (03:00 UTC)
  → npm ci, lists/fetch.sh, build trackers-index
  → scanner batch over ~300 sites (Playwright Chromium, concurrency 3–4)
  → aggregate → per-site JSON + leaderboard + trends
  → upload full results to R2: results/latest/<host>.json (overwritten nightly) + results/<date>/ (30-day retention)
  → generate OG preview PNGs (screenshot of a local template page) → R2, latest set only
  → push compact aggregates to `data` branch (leaderboard.json + trends.csv — a few MB per *year*)
  → seed top-500 results into D1 via an authenticated ingest route on the Worker
    (popular URLs become cache hits that cost zero browser time)
  → build web with the aggregates from the same workflow run → `wrangler pages deploy` (Direct Upload)
```

**Live path (scarce, cached hard):**
```
Visitor submits URL (web)
  → POST /api/scan (Worker)
  → validate URL (shared SSRF rules, DoH re-resolve) → 400 on any violation
  → D1 cache lookup by canonical URL (24h TTL) → hit: return existing result
  → registrable-domain fallback: recent scan of the same site exists
    → return it, labeled "sampled from <url>" (no browser time spent)
  → D1 quota check+increment (browser-seconds, UTC-day row) → over budget:
    friendly 429 page, point to pre-scanned sites
  → Browser Run scan via @cloudflare/playwright, same shared capture modules (≤40s budget)
  → classify + score (shared) → validate against schema → store in D1 under short ID
  → return ScanResult → web renders graph
```

**Share path:**
```
/r/<id> shared on WhatsApp/X/LinkedIn
  → Pages Function (_worker.js): if bot UA → serve minimal HTML with OG tags
    (score, "N companies learned you visited this page", og:image from R2)
  → humans → SPA result page
```

### 3.3 The shared package (new, brief recommendation #1 — approved direction)

`packages/shared` owns everything that must not drift between the nightly scanner and the Worker:

- `schema.ts` — zod schemas + inferred TS types for `ScanResult`; `SCHEMA_VERSION`
- `classify.ts` — domain → categories + company, using the merged trackers index
- `score.ts` — explainable score (§5.3)
- `url-validator.ts` — the SSRF rules (§6), plus IP-range tables
- `fingerprint/init-script.ts` — the injected JS as a **self-contained string** (no imports), consumed verbatim by both `page.addInitScript()` (Playwright) and the Cloudflare fork; plus the TS types of the events it logs
- `constants.ts` — category taxonomy, colors, score weights
- `har.ts` — build a HAR 1.2 export from captured data (manual, so it works in both runtimes — do not rely on Playwright's `recordHar`, which may differ on the Cloudflare fork)

Rule: scanner, worker and web import from `@exposure/shared` only; no copied types. The scaffold's duplicate `worker/src/scanner/fingerprint-wrappers.ts` and `classify-worker.ts` become thin re-exports or are deleted.

---

## 4. The result schema (the contract — decide once, keep stable)

Top-level `ScanResult` (zod-validated everywhere; `schemaVersion: 1`):

```jsonc
{
  "schemaVersion": 1,
  "scannerVersion": "1.0.0",
  "source": "nightly" | "live",
  "requestedUrl": "https://example.com/",
  "finalUrl": "https://www.example.com/",
  "timestamp": "2026-10-01T03:12:44Z",
  "scanDurationMs": 14200,
  "redirects": [ { "url": "...", "status": 301, "location": "...", "atMs": 90 } ],
  "requests": [ {
      "id": 1, "url": "...", "domain": "doubleclick.net",
      "isThirdParty": true, "resourceType": "script", "method": "GET",
      "status": 200, "sizeBytes": 12345, "startMs": 120, "endMs": 340,
      "initiatorDomain": "example.com"
  } ],
  "cookies": [ {
      "name": "_gid", "domain": ".example.com", "valueLength": 26,
      "secure": true, "httpOnly": false, "sameSite": "Lax",
      "expiresAt": null, "lifetimeDays": 1, "isThirdParty": false
  } ],
  "storage": [ { "type": "localStorage", "domain": "example.com", "key": "...", "valueLength": 40 } ],
  "fingerprinting": [ {
      "api": "canvas.toDataURL", "domain": "tracker.example",
      "scriptUrl": "https://tracker.example/fp.js", "count": 3, "firstSeenMs": 500
  } ],
  "domains": [ {
      "domain": "doubleclick.net", "requestCount": 12,
      "categories": ["advertising"], "company": "Google LLC",
      "isFirstParty": false, "sources": ["disconnect", "ddg"]
  } ],
  "score": { "value": 42, "grade": "D", "components": { /* per-rule deductions */ },
             "explanation": "…one sentence…" },
  "summary": {
      "totalRequests": 87, "thirdPartyRequests": 61, "distinctDomains": 34,
      "distinctTrackerDomains": 14, "companiesLearned": 8,
      "cookieCount": 21, "longLivedCookieCount": 9,
      "fingerprintApis": ["canvas", "webgl"],
      "companies": ["Google LLC", "Meta", "..."]
  }
}
```

Privacy rules baked into the schema (good security talking points):

- **Never store cookie or storage values** — names, attributes, lengths only. The scan is synthetic, but published results must not leak session material.
- Request URLs are kept in full (they are the interesting evidence) but a sanitizer drops obviously sensitive query params (`token`, `session`, `key`, `sid`, …) before storage.
- `companiesLearned` = distinct non-first-party companies = the headline shareable stat.

---

## 5. Classification, companies, score

### 5.1 Sources and merge order

Build a single index at scan time: `domain → { categories[], company?, sources[] }`.

1. **Disconnect services.json** — primary for entity→company mapping and category (Advertising/Analytics/Social/Fingerprinting/Content).
2. **DDG Tracker Radar** — supplements company + category, adds prevalence/fingerprinting evidence.
3. **EasyPrivacy** — hostname coverage only (parse the `||domain^` subset and `@@||domain^` exceptions; skip cosmetic/regex rules; document the subset in METHODOLOGY.md).
4. **`lists/cdn-allowlist.json`** — hand-curated (jsDelivr, unpkg, cdnjs, fonts.gstatic, …) so neutral CDNs aren't flagged as trackers.

First-party = same registrable domain as `finalUrl` (via `tldts`, MIT). Unmatched third-party domains = `uncategorized` (shown, never scored as trackers). Classification inputs are normalized by the `lists/` scripts into the merged index; the classifier itself lives in shared and is pure + unit-tested against fixture domains.

### 5.2 Category taxonomy (fixed)

`first-party`, `advertising`, `analytics`, `social`, `fingerprinting`, `cdn`, `uncategorized`. A domain can carry multiple categories; worst wins for coloring.

### 5.3 Score (explainable in one sentence)

Start at 100, deduct, floor 0. All weights in `shared/constants.ts`, tuned in Phase 2:

| Rule | Deduction (max) |
|---|---|
| Distinct tracker domains: 1–3 → 10 · 4–9 → 20 · 10–19 → 30 · 20+ → 40 | 40 |
| Company spread: 1 → 3 · 2–3 → 7 · 4–6 → 11 · 7+ → 15 | 15 |
| Fingerprinting API families used (canvas/WebGL/audio/fonts): 5 each | 25 |
| Worst cookie lifetime: ≥90d → 8 · ≥1y → 15 · ≥2y or sessionless (no expiry) → 20 | 20 |

Grades: A ≥ 85, B ≥ 70, C ≥ 55, D ≥ 40, F < 40.

Generated explanation, one sentence: *"8 companies learned you visited this page — 14 tracker domains, 3 fingerprinting APIs and 9 cookies that outlive a year cost you 58 of 100 points."*

---

## 6. Security design (SSRF territory — the security-portfolio centerpiece)

Visitors can make the Worker's browser fetch arbitrary URLs. Rules (all in `shared/url-validator.ts`, one implementation, heavily unit-tested; the full IPv4+IPv6 matrix is a named test file):

1. `new URL()` parse; only `http`/`https`.
2. Reject userinfo (`user:pass@host`), non-standard ports (only 80/443 allowed), URLs > 2048 chars.
3. Hostname must be a DNS name: reject raw IPv4/IPv6, `localhost`, `*.local`, `*.internal`, dotless names.
4. **Resolve DNS yourself** from the Worker via DoH (`https://cloudflare-dns.com/dns-query`, `Accept: application/dns-json`) for A/AAAA; reject if any address is: loopback (127/8, ::1), private (10/8, 172.16/12, 192.168/16), link-local + cloud metadata (169.254/16 incl. 169.254.169.254, fe80::/10), CGNAT (100.64/10), multicast/reserved/broadcast ranges.
5. **Re-check after every redirect**: enable request interception in the scan session; each navigation request is re-validated (URL + fresh DoH resolution) before it is allowed to proceed; abort the scan on violation.
6. Timeouts: 40s total scan budget (platform hard limit 60s), 15s per navigation; abort responses > 20 MB.
7. Rate limiting: per-IP (5 live scans/hour via `CF-Connecting-IP`, D1 counters) + global daily quota (§7) + single-flight dedupe per URL so concurrent duplicates don't burn browser time.
8. The browser runs in Cloudflare's Browser Run sandbox, so the author's own infrastructure is never the fetcher — but validation is implemented anyway (it's the interview story).

THREAT-MODEL.md gets filled from this section in Phase 5 (assets, actors, trust boundaries, the validation rules, residual risks: Cloudflare-IP blocking by sites, malicious page attacking the sandbox, quota abuse).

---

## 7. Free-tier budget and quota design

| Resource | Free limit | Design consequence |
|---|---|---|
| Browser Run time | 10 min/day | **Meter the quota in browser-seconds**, not scan count: 600 s/day budget, live scans capped at 450 s/day (≈30 × 15 s) to keep headroom; a slow 25 s scan can't silently eat three fast ones' budget |
| New browser instances | 1 / 20s, 3 concurrent | One kept-alive browser session, scan via new tabs; serialize live scans |
| Browser timeout | 60s | 40s scan budget, abort early on idle |
| Workers | 100k req/day | Trivial; fine |
| D1 | ~5M reads/day | Cache by URL 24h; results kept forever by short ID; indexes on (url), (host), (scanned_at) |
| R2 | 10 GB | OG PNGs only (~80 KB each); no screenshots in v1 |
| Pages | unlimited bandwidth, 500 Git builds | Nightly deploys via Direct Upload (`wrangler pages deploy`), which doesn't burn Git builds |
| Actions | free for public repos | ~2h/night for 300 sites; reject-cookies double-scan ≈ 4h (Phase 7) — still fine |

Quota-exhausted UX: clear message, "come back tomorrow or browse tonight's pre-scanned results", link to leaderboard.

Three choices stretch the 10 minutes much further than "30 scans/day" suggests:

1. **Nightly seed into D1.** The nightly job pushes its top-500 results into D1 through an authenticated ingest route on the Worker (`POST /api/ingest`, shared-secret header). Binding inserts handle large JSON; `wrangler d1 execute --file` won't (statement-size limit). Popular URLs then cost zero browser time — live quota is spent only on novel URLs, which is exactly what it should be spent on.
2. **Domain-level cache fallback.** Exact-URL cache (24h TTL) → registrable-domain cache (recent scan of the same site, returned with a visible "sampled from \<url\>" label) → live scan. Most visitors type famous homepages; they should almost never touch the browser.
3. **Browser-seconds metering** (table above) plus single-flight dedupe per URL (§6.7), so concurrent requests for the same URL share one scan.

**Data growth and retention (v1.2 fix — v1.1 would have bloated):** 300 sites at ~60 KB per result is ~18 MB of new data every night. Committed to a git `data` branch, that is 2–3 GB of git history within a year — every checkout drags it along, for history nothing needs. And 300 OG PNGs kept forever would eat the 10 GB R2 free tier in about a year. Revised split:

- **R2** holds everything bulky: `results/latest/<host>.json` (overwritten in place, ~20–30 MB total, stable) and `results/<date>/` (deleted after 30 days by the nightly job — trends only need aggregates, not full history). OG images: latest night's set only; old shared links fall back to a static branded card (WhatsApp/X cache OG images aggressively anyway).
- **`data` branch** holds only compact aggregates: `leaderboard.json` + `trends.csv` (one ~200-byte line per site per night → a few MB per *year*) + the sites index. Public transparency of history without the bulk.
- **D1** keeps live-scan results for 90 days unless viewed (pruned during nightly ingest); the seeded top-500 rows are refreshed in place, never accumulated.
- **Web** embeds only the compact aggregates at build time (same workflow run produces them); the full per-site JSON is fetched client-side from a public read route on the Worker (`GET /api/results/<host>` → R2), so the bundle stays small.
- Numbers re-checked at Phase 4 gate; all fits free tier with years of headroom.

---

## 8. Legal and licensing (fill `docs/LEGAL.md` in Phase 2)

- All three tracker sources are copyleft/NC (CC BY-NC-SA 4.0 ×2, GPLv3/CC BY-SA 3.0). Exposure is non-commercial, so **use** is fine; **committing lists into the MIT repo is not**.
- Therefore: `lists/fetch.sh` downloads at build/scan time; `lists/build/` is gitignored; nightly CI and local scripts regenerate it. The generated index is a derivative — keep it inside artifacts (Actions / data branch) with an attribution block, not in main.
- Methodology page lists every source, its license, last-refresh date, and a link.
- Phase 7 extras: verify abuse.ch URLhaus and OpenPhish terms before shipping the abuse-feed check; DB-IP Lite is CC BY 4.0 (attribution required) — fine for the data journey map.
- The tool only scans public pages it is asked to scan; stores no personal data; cookie/storage values never persisted (§4). Write this down in LEGAL.md.

---

## 9. Phase plan

Phases, order and effort follow the brief. Each phase lists the scaffold files it fills. "Done when" is the acceptance gate.

### Phase 0 — Foundation (0.5 day) — ✅ COMPLETE (2026-10-01)
**Done-when satisfied:** `npm ci && npm run build && npm test` green locally and in CI; shared imports proven from scanner, web and worker (dedicated contract tests in each). 98 tests, 13 files, 5 packages.

*Implementation notes and deviations:*
- `vitest.workspace.ts` → `vitest.config.ts` with `projects` (the workspace-file format is legacy in Vitest 3; projects is the current mechanism).
- More than stubs landed where the work was pure and contract-shaped: the full zod `ScanResult` schema, the full score formula, the full SSRF validator (static + resolved-address + DoH helper), and format-verified Disconnect/EasyPrivacy normalizers + merge. DDG subset selection stays in Phase 2 as planned.
- Worker middleware was rewritten Workers-native now (the Express-shaped stubs were unfillable); `og/template.tsx` (JSX) became a string-based `template.ts` — both per the plan's Phase 5/6 direction, pulled early for a green typecheck.
- Versions pinned to a verified-compatible set: TS 5.9.3, ESLint 9.39.5, typescript-eslint 8.71, Vitest 3.2.7, Vite 8.3.1, zod 4.6.5, ipaddr.js 2.5.0. (ESLint 10 / TS 7 exist; tseslint compatibility isn't there yet. Re-check at Phase 4.)
- The URL-validator test matrix caught a real bypass (`localhost.localdomain` passed the loopback rule) — fixed by rejecting any `localhost` label. Tests earning their keep on day one.
- `scanner/sites.csv` still holds the placeholder row (Phase 1 fills the 10 test sites); worker migrations still placeholder SQL (Phase 5).

**Goal: installable, type-checked, linted, tested monorepo with the shared package and CI.**
- Root `package.json` (npm workspaces: `packages/shared`, `lists`, `scanner`, `web`, `worker`), `.gitignore` (node_modules, dist, `.wrangler`, `.env`, `.dev.vars`, `lists/build`, `data`, `*.har`, coverage), `.nvmrc` (22).
- `tsconfig.base.json`: `strict: true`, `moduleResolution: bundler`, `noUncheckedIndexedAccess`, `forceConsistentCasingInFileNames`.
- `eslint.config.js` (flat config + typescript-eslint), fix `vitest.workspace.ts` to actually include the packages.
- Create `packages/shared` (schema/classify/score/url-validator/fingerprint init-script/constants stubs with real types), `.env.example` rewritten (worker `.dev.vars.example`), `scripts/setup.sh` (installs deps, playwright chromium, fetches lists).
- `lists/fetch.sh` real (curl the three sources + license headers → `lists/build/`), normalizers converted to TS.
- Pin exact versions (no `^`) for `playwright` and `@cloudflare/playwright`, commit the lockfile — parity verified in the Phase 1 spike must stay verified through upgrades.
- `docs/`: fill PRD.md + ARCHITECTURE.md from §3–§5 of this plan; real README (what/why/how-to-run); set the GitHub repo description. Docs scope is deliberately cut: PERSONAS.md and COMPETITORS.md get at most one paragraph each at launch — portfolio time goes to METHODOLOGY and THREAT-MODEL, which are the pages security-role interviewers actually read.
- `.github/workflows/ci.yml`: install, lint, typecheck, `vitest run`, web build — on PRs to main. (Nightly workflow arrives in Phase 4; CI early is cheap and protects everything after.)

**Done when:** `npm ci && npm run build && npm test` passes in CI on a clean runner; a trivial shared import works from scanner, web and worker.

### Phase 1 — Scanner core (≈1 week)
**Goal: `scan(url) → ScanResult` via Playwright, all captures from the brief.**
- Fill: `browser.ts` (launch, context, stealth-lite UA), `network-capture.ts` (`page.on('request'/'response')`, domain/timing/size/initiator; manual capture, no CDP, no `recordHar`), `fingerprint-wrappers.ts` (moves to shared init-script; wraps canvas `toDataURL`/`getImageData`, `WebGLRenderingContext.getParameter`/`readPixels`, `AudioContext` (`createOscillator`/`getChannelData`/`createAnalyser`), font enumeration (`document.fonts`, `offsetWidth` probes); logs domain + script URL + count), `cookie-extractor.ts` (incl. lifetime computation), `storage-extractor.ts` (localStorage/sessionStorage/IndexedDB names+lengths), `scroll-simulator.ts` (2–3 scroll passes to trigger lazy content), `scan.ts` (orchestration: navigate → settle (network idle-ish, capped) → scroll → extract), `url-validator.ts` (shared), `har-export.ts` (HAR 1.2 from captured data), `schema.ts` (re-export shared), `types.ts` (re-export shared).
- `sites.csv` → 10 diverse test sites (news, sports, recipe, gov, tech).
- Fingerprint init-script is a **string in shared**, consumed by `addInitScript(script)` — identical bytes in scanner and later the Worker.
- **Browser Run parity spike (first 2–3 hours of the phase, not Phase 5):** stand up a scratch Worker with the Browser Run binding and run the same shared capture modules under `@cloudflare/playwright` against one URL. Confirms `request`/`response` events, `addInitScript` and interception behave identically to local Playwright before a week of work is built on that assumption. If the fork has gaps, choose the mitigation now (Puppeteer fork, or a thin capture shim in shared) — discovering this in Phase 5 would trash the whole live-scan design. Costs a few minutes of the daily browser budget; worth it.

**Done when:** 10 different sites produce clean schema-valid JSON (requests, redirects, cookies, storage, fingerprint events all populated); flakes documented (retry ×2, timeout budget enforced).

### Phase 2 — Classification + score (3–4 days)
**Goal: domains classified, companies mapped, score computed — all in shared.**
- Fill `lists/merge-lists.js` + normalizers (TS): merged index per §5.1; `scanner/src/classify.ts` + `scorer.ts` become shared imports; `aggregate.ts` (per-domain rollups, summary counts).
- Tests: known domains (doubleclick → advertising/Google; facebook → social/Meta; unmatched → uncategorized), scorer golden cases, EasyPrivacy subset parser fixtures.
- **Calibrate the score** against ~20 diverse scanned sites: clean sites must land A/B, tracker-heavy must land F. Uncalibrated weights reliably put every site in the same grade, which kills the headline stat. Adjust weights once, record the rationale in METRICS.md.
- Fill `docs/LEGAL.md`, `docs/METRICS.md`.

**Done when:** output JSON contains `domains[].categories/company`, `score` with components + one-sentence explanation, `summary.companiesLearned`; all lists refreshed by one script.

### Phase 3 — Graph frontend (≈1 week)
**Goal: the showcase. Static SPA rendering a result JSON beautifully.**
- Fill `web/`: `vite.config.ts` (build + `pages` config), design system in `styles/` (dark theme, category colors from shared constants), `router.ts` (History API, `/`, `/r/:id`, `/site/:host`, `/leaderboard`, `/methodology`), pages, `ForceGraph.ts` (**d3-force + custom canvas renderer**: center node = site, edges sized by request count, node color by category, zoom/pan/hover/click), `ReplaySlider.ts` (animate growth in request order from `startMs` — play/pause/scrub — the hero feature), panel tabs (overview, trackers, cookies, timeline), `ScoreBadge`, `ShareButtons`, `api.ts` (loads fixture JSON now, worker later).
- Pages Functions prep: `_worker.js` route skeleton for bot meta.
- Fill `docs/DESIGN.md`.

**Done when:** a fixture result renders as a polished animated graph with working replay slider and full side panel; Lighthouse ≥ 90 perf/a11y; usable on mobile.

### Phase 4 — Nightly bulk scans + launch (3–4 days)
**Goal: first public launch — leaderboard fed by real nightly data, $0.**
- `.github/workflows/nightly-scan.yml`: cron `0 3 * * *` + `workflow_dispatch`; Playwright browser cached; batch over ~300 sites (`scanner/src/batch.ts`: concurrency 3–4, retries, per-site timeout, failure isolation), aggregate; upload full results to R2 (`latest/` overwritten, dated copies kept 30 days); push only compact aggregates (`leaderboard.json` + `trends.csv`) to the `data` branch; build web with those aggregates; `wrangler pages deploy` (secrets via Actions secrets).
- `sites.csv` ← real list (Tranco top-N intersected with a hand-pruned set; see §12), `aggregate.ts` leaderboard stats, `web` leaderboard page with 7/30-day deltas, loading/error pages for scan failures, methodology page (limits, sources, licenses, what "companies learned" means).
- Fill `docs/METHODOLOGY.md`.

**Done when:** nightly run green on 3 consecutive days, leaderboard live at pages.dev, history growing, no scan JSON ever on main.

### Phase 5 — Live scans (≈1 week)
**Goal: visitors scan any URL, quota-safe and SSRF-hardened.**
- Worker: fill `url-validator` (shared SSRF rules), `scan.ts` route (validate → D1 cache → domain fallback → browser-seconds quota → Browser Run scan via `@cloudflare/playwright` + shared capture modules → classify/score → store), `browser-scan.ts` (kept-alive session, tab-per-scan, redirect re-validation via interception), `cache.ts`/`quota.ts`/`rate-limit.ts` (D1), `id.ts` (8-char base62 + collision retry), migrations (results + quota tables per §3.2, real SQLite DDL), `wrangler.toml` bindings (browser, D1, R2, vars), middleware rewritten Workers-style, `seed-d1.sh`, `deploy.sh`.
- **Storage spike (first hour):** verify D1 handles 100–300 KB result rows via binding inserts and reads at an acceptable latency; if it's awkward, D1 holds metadata + ids and result bodies go to R2, with the same interface so nothing else changes.
- Wire the nightly → D1 seeding (`routes/ingest.ts`, shared-secret auth) so popular URLs stop costing browser time from day one of Phase 5.
- Web: wire `api.ts` to the worker (`https://api.<domain>`), loading states, quota-exhausted + blocked-site UX.
- Fill `docs/THREAT-MODEL.md` from §6.

**Done when:** live scan of a novel URL returns a rendered graph end-to-end; SSRF test suite (localhost, private IPs, metadata IP, redirect-to-internal, DNS-rebinding-style re-resolution, raw IP host) all rejected with 400; quota returns the friendly fallback at 30/day.

### Phase 6 — Shareability (3–4 days)
**Goal: links look great everywhere.**
- OG image generation **in the nightly job** (Playwright screenshot of a 1200×630 template page built from each result: score, "N companies learned you visited this page", mini graph snapshot) → R2. Live-scan results use a branded static OG card in v1 (generating per-live-scan would burn browser time; revisit later).
- Fill worker `routes/og-image.ts` (serve from R2), `routes/bot-meta.ts` + Pages `_worker.js` (bot UA → OG-tagged HTML), `utils/bot-detect.ts`, delete/replace the `og/*.tsx` JSX approach.
- Headline line + share buttons (X, LinkedIn, WhatsApp, copy link) on the result page.

**Done when:** a shared link shows title/description/image previews in WhatsApp/X/LinkedIn debuggers; nightly pipeline publishes images to R2.

### Phase 7 — Standout features (2–3 weeks, in this order)
1. **Reject-cookies test** (nightly only): scan each site twice; second pass clicks reject on known consent platforms (OneTrust `#onetrust-reject-all-handler`, Cookiebot `#CybotCookiebotDialogBodyButtonDecline`, Didomi, TCF `__tcfapi` posts), plus a fallback scan of known reject-button selectors; report delta ("rejecting removed only 3 of 41 trackers"). Doubles Actions time — fine, never in live scans.
2. **Abuse-feed check**: flag contacted domains present in abuse.ch URLhaus / OpenPhish feeds (verify terms first); `routes/export.ts` ships JSON + HAR export of findings — the SOC-portfolio hook.
3. **Data journey map**: nightly job resolves contacted-domain IPs, geolocates with DB-IP Lite (CC BY 4.0, attributed), draws arcs on a world map (canvas; globe optional). Bulk job first; live only if quota allows (it won't, initially).

**Done when:** each feature ships on the nightly data with a clear UI surface and is linked from the methodology page.

### Phase 8 — Polish + launch (≈1 week)
- README: architecture diagram, screenshots, 60–90s demo video, methodology summary, "run it yourself".
- Final pass: error states, empty states, Lighthouse, mobile, analytics (privacy-friendly; Cloudflare Web Analytics is free), favicon/OG defaults.
- Posts: Reddit r/privacy + webdev communities, Show HN, LinkedIn write-up (lean on the security rigor: SSRF rules, test matrix, licensing discipline).

---

## 10. Testing and CI

- **Vitest everywhere**, one `npm test` at root via the workspace file. Per area:
  - `shared`: url-validator IPv4/IPv6/redirect matrix (the showpiece suite), classifier fixtures, scorer golden cases, schema round-trip + version guard, fingerprint init-script parses and self-tests.
  - `scanner`: capture logic against a local fixture server (a test page that sets cookies, calls canvas/audio APIs, loads a fake third-party script) — deterministic, no network.
  - `worker`: route handlers via Miniflare/wrangler dev with D1 local; quota/rate-limit edge cases; id generation.
  - `web`: graph-data transforms and replay-slider sequencing (pure functions kept separate from rendering); smoke-render pages in happy-dom.
- **CI (`.github/workflows/ci.yml`, Phase 0):** install → lint → typecheck → test → build web + tsc worker. Blocks PRs.
- **Nightly (Phase 4):** the batch job is itself an integration test; failures per site are isolated and logged, never fail the whole run.
- Schema anti-drift: a CI test imports the scanner's golden fixture JSON and validates it against `shared/schema.ts`; the worker re-validates every result before storing.

## 11. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Sites block headless/Cloudflare IPs (bot detection) | Document as a known limitation; retry with realistic UA; nightly data covers popular sites even when live fails; error page says why |
| Playwright fork drift between local scanner and Browser Run | Shared capture modules target the Playwright public API only (no CDP, no `recordHar`); smoke-test the worker path in Phase 5 and on deploy |
| Scanner flakiness across 300 sites | Retries, per-site timeouts, failure isolation, nightly health summary in the data branch |
| Quota exhaustion on day 1 (curiosity spike) | 24h URL cache, per-IP rate limit, single-flight dedupe, friendly fallback to pre-scanned results |
| License drift (lists change terms) | Sources + licenses + refresh date recorded on methodology page; each source is swappable behind the merged-index interface |
| Cloudflare limit changes | Limits are constants in shared + one table on the methodology page; re-verify quarterly |

## 12. Assumptions (stated, proceeding) and open questions

Assumptions unless corrected:
1. `packages/shared` is added per brief recommendation #1 (it deletes the scaffold's scanner/worker duplication).
2. Playwright everywhere (regular in Actions, `@cloudflare/playwright` in the Worker), per §2.2.
3. Nightly results: full JSON in R2, compact aggregates on the `data` branch, none of it on main (per §7 retention).
4. OG images generated in the nightly job, not in the Worker.
5. Tracker lists are fetched at build time, never committed.
6. Web stays framework-less TS + Vite + d3-force (matches the scaffold; keeps the bundle tiny; shows engineering craft).

Open questions (answer anytime; none block Phase 0–3):
1. Site list source for the nightly batch: Tranco top-N pruned by hand (assumed), CrUX, or fully hand-curated?
2. Domain: `exposure.pages.dev` + `api.exposure.pages.dev`-style worker name for now, or buy a custom domain later (~$10/yr, the only conceivable cost)?
3. Worker as a separate deployable vs consolidating into Pages Functions — assumed separate (simpler Browser Run binding story); revisit if ops get annoying.
4. Public leaderboard of "worst sites": keep to neutral, factual presentation (assumed) to avoid legal heat from named companies.
ual presentation (assumed) to avoid legal heat from named companies.
