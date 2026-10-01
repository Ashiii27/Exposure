import { describe, expect, it } from 'vitest';
import { validateUrlSyntax } from '../src/utils/url-validator.js';
import { FINGERPRINT_INIT_SCRIPT } from '../src/scanner/fingerprint-wrappers.js';
import { ogDescription } from '../src/og/generate.js';
import { renderOgHtml } from '../src/og/template.js';

describe('worker ↔ shared contract', () => {
  it('validates URLs through the shared SSRF rules', () => {
    expect(validateUrlSyntax('https://example.com/').ok).toBe(true);
    expect(validateUrlSyntax('http://169.254.169.254/latest/meta-data/').ok).toBe(false);
    expect(validateUrlSyntax('http://metadata.google.internal/').ok).toBe(false);
  });

  it('injects the same init script as the nightly scanner', () => {
    expect(FINGERPRINT_INIT_SCRIPT).toContain('canvas.toDataURL');
  });

  it('renders OG metadata with the headline stat', () => {
    expect(
      ogDescription({ companiesLearned: 8, distinctTrackerDomains: 14 })
    ).toBe('8 companies learned you visited this page — 14 tracker domains. See the full X-ray on Exposure.');

    const html = renderOgHtml({
      title: 'example.com on Exposure',
      description: 'test',
      siteName: 'Exposure',
      url: 'https://exposure.pages.dev/r/abc123',
      imageUrl: null
    });
    expect(html).toContain('og:title');
    expect(html).not.toContain('og:image');
  });

  it('escapes HTML in OG values', () => {
    const html = renderOgHtml({
      title: '"><script>',
      description: 'x',
      siteName: 'Exposure',
      url: 'https://exposure.pages.dev/',
      imageUrl: null
    });
    expect(html).not.toContain('<script>');
  });
});
