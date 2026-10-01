# Exposure

**See what a web page really does behind the scenes.**

Paste a URL, and Exposure X-rays the page: every network request, redirect,
cookie, storage entry, third-party script and use of browser-fingerprinting
APIs. Domains are classified (advertising, analytics, social,
fingerprinting, first-party), mapped to the companies that own them, scored,
and drawn as an animated force-directed graph you can share by link.

Opening a news article can quietly contact dozens of companies. Exposure
makes that visible.

## Status

Phase 0 (foundation) is complete. The roadmap — scanner, classification,
graph frontend, nightly bulk scans, live scans, shareability — lives in
[`docs/IMPLEMENTATION-PLAN.md`](docs/IMPLEMENTATION-PLAN.md).

## Architecture (short version)

```
                    ┌────────────────────┐
   nightly cron ───▶│ scanner (Playwright)│── results ──▶ R2 + data branch ─▶ Cloudflare Pages
   (GitHub Actions) └────────────────────┘                       ▲
                                                                   │ embeds aggregates
   visitor ────────▶ Pages SPA ── POST /api/scan ──▶ Worker ──────┘
                                                    (Browser Run, D1, R2)
```

- `packages/shared` — the contract: result schema, classification, scoring,
  SSRF-safe URL validation. Used by scanner, worker and web so output can
  never drift between the nightly and live paths.
- `lists/` — downloads and normalizes Disconnect, DuckDuckGo Tracker Radar
  and EasyPrivacy into one merged index (never committed — licences).
- `scanner/` — Playwright scanner, runs nightly on GitHub Actions.
- `web/` — static SPA (Vite, TypeScript, d3-force graph), Cloudflare Pages.
- `worker/` — live-scan API (Cloudflare Worker + Browser Run).

## Develop

Requires Node >= 20 (a `.nvmrc` is provided) and curl.

```bash
npm run setup        # install deps, fetch tracker lists, verify toolchain
npm run lint         # eslint (flat config, typescript-eslint)
npm run typecheck    # tsc --noEmit across every package
npm test             # vitest across every package
npm run build        # build the web app
npm run dev --workspace web   # vite dev server
```

Tracker lists are **not** required to run tests — list-dependent code is
tested against fixtures, so CI stays hermetic.

## Licensing notes

Exposure's own code is MIT. The tracker data it classifies with is not:
Disconnect (CC BY-NC-SA 4.0), DuckDuckGo Tracker Radar (CC BY-NC-SA 4.0) and
EasyPrivacy (GPLv3 / CC BY-SA 3.0) are downloaded at build time into
`lists/build/` and never committed. See `docs/LEGAL.md`.

## Privacy notes

Exposure never stores cookie or storage *values* — only names, attributes
and lengths. Sensitive query parameters are redacted from recorded URLs.
The tool scans only public pages it is explicitly asked to scan.
