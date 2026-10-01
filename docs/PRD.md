# Product Requirements

Exposure is a public web tool where a visitor pastes any URL and sees what
that page actually does when it loads. A headless browser loads the page and
records every network request, redirect, cookie, storage entry, third-party
script, and use of fingerprinting APIs. The result is classified, mapped to
owning companies, scored, and shown as an animated, shareable graph.

## Problem

Most people have no idea that opening a single article can contact dozens of
domains. Existing tools (Privacy Badger's mini view, Blacklight, webbkoll)
are either buried in browser extensions, run paid infrastructure, or show a
static table. None make the *experience* of being tracked visceral.

## Users

1. **The curious visitor** — pastes a site they use daily, wants a shareable
   "look at this" artifact. Needs: instant comprehension, one headline stat,
   a link that previews well in WhatsApp/X/LinkedIn.
2. **The privacy-aware user** — wants details: which companies, which
   fingerprinting APIs, cookie lifetimes, what a consent banner actually
   changed.
3. **The security/engineering audience** — wants methodology rigor,
   exportable findings (HAR/JSON), and honest limitations.

## Non-goals

- Not a blocker. Exposure observes and explains; it does not protect.
- Not a general crawler. One page per scan, on demand or nightly.
- No accounts, no personal data collection.

## Success metrics

- A first-time visitor understands the headline ("N companies learned you
  visited this page") within 5 seconds of the result rendering.
- Nightly leaderboard covers 300+ popular sites, refreshed daily, $0 cost.
- Share links render correct OG previews on the three major platforms.
- Live scans stay within free-tier quotas with a friendly fallback.

## Constraints

- Zero deployment and run cost (Cloudflare free tiers + GitHub Actions).
- Free-tier quotas are a design input, not an afterthought: live scans are
  metered in browser-seconds, cached aggressively, and fall back to
  pre-scanned nightly data.
- Engineering quality and security rigor (SSRF-safe URL handling) are
  portfolio-grade requirements, not nice-to-haves.

The full phase plan and acceptance gates: `docs/IMPLEMENTATION-PLAN.md`.
