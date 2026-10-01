# Architecture

All free tier. Frontend: static SPA on Cloudflare Pages. Live scans: Worker
with the Browser Run binding (`@cloudflare/playwright`). Bulk scans: nightly
GitHub Actions cron over ~300 popular sites. Storage: D1 (results, quota,
rate limits), R2 (full nightly results with retention, OG images). A `data`
branch holds only compact aggregates.

## Data flows

Nightly (quota-proof, the public launch):

```
GitHub Actions cron 03:00 UTC
  → npm ci + lists/fetch.sh → merged trackers index
  → scanner batch (~300 sites, Playwright Chromium, concurrency 3–4)
  → per-site JSON + leaderboard + trends
  → R2: results/latest/<host>.json (overwritten) + results/<date>/ (30-day retention)
  → data branch: leaderboard.json + trends.csv only
  → D1 seed of top-500 results (authenticated ingest route)
  → web build with aggregates → wrangler pages deploy
```

Live (scarce, cached hard):

```
POST /api/scan
  → validateUrlSyntax (shared SSRF rules) → 400 on violation
  → D1 exact-URL cache (24h) → hit: return
  → registrable-domain fallback ("sampled from <url>") → hit: return
  → browser-seconds quota check (UTC-day row) → over: friendly fallback page
  → Browser Run scan via @cloudflare/playwright + shared capture modules
    (each redirect re-validated; ≤40s budget)
  → classify + score (shared) → schema-validate → store in D1 → return
```

## Why a shared package

The nightly scanner and the live worker must produce byte-compatible
results. Everything both need lives in `packages/shared`:

| Module | Contents |
|---|---|
| `schema.ts` | zod `ScanResult` contract, `SCHEMA_VERSION`, URL redaction |
| `classify.ts` | domain → categories + company, against the merged index |
| `score.ts` | explainable score: components + one-sentence explanation |
| `url-validator.ts` | SSRF rules: static checks + resolved-address checks + DoH |
| `fingerprint/init-script.ts` | the injected script — one string, both runtimes |
| `constants.ts` | taxonomy, colours, score weights, free-tier budgets |

Scanner, worker and web import `@exposure/shared`; nothing is copied.

## Runtimes

- **scanner**: Node 20+ (GitHub Actions ubuntu runners), Playwright Chromium,
  run via tsx. Trusted site list — static URL checks only.
- **worker**: Cloudflare Workers (ESM). Browser Run via the
  `@cloudflare/playwright` fork. Untrusted input — full SSRF validation,
  DoH resolution, per-redirect re-checks. Phase 1 includes a parity spike
  proving the fork matches local Playwright for the APIs we use
  (request/response events, addInitScript, interception).
- **web**: Vite static SPA. Fetches result JSON from the worker API and
  bundled nightly aggregates; renders with d3-force + canvas.

## Free-tier budgets (constants in shared, verified 2026-10-01)

| Resource | Limit | Design |
|---|---|---|
| Browser Run time | 10 min/day | 600 s budget, live capped at 450 s, metered in seconds |
| New browsers | 1 / 20 s, 3 concurrent | kept-alive session, tab per scan, serialized |
| Browser timeout | 60 s | 40 s scan budget |
| D1 | ~5M reads/day | URL cache 24h; results by short id; pruned at 90d |
| R2 | 10 GB | latest/ overwritten; dated/ pruned at 30d; OG images latest only |
| Pages | unlimited bandwidth | nightly Direct Upload deploys |

## Data retention (plan §7)

Bulky full results live in R2 with retention; the git `data` branch holds
only compact aggregates (a few MB per year); D1 live results pruned after 90
days unless viewed. Nothing scan-related is committed to `main`.

## Reproduce locally

```
npm run setup     # deps + tracker lists + toolchain verification
npm test          # hermetic: list-dependent code tested via fixtures
npm run typecheck
```
