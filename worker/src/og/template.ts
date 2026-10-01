/**
 * OG (Open Graph) HTML template — string-based on purpose: no JSX, no React,
 * so the worker stays a plain ES module and the same template can be served
 * by the Pages bot-meta route (Phase 6).
 */
export interface OgTemplateInput {
  title: string;
  description: string;
  siteName: string;
  url: string;
  imageUrl: string | null;
}

export function renderOgHtml(input: OgTemplateInput): string {
  const imageTag = input.imageUrl
    ? `<meta property="og:image" content="${escapeAttr(input.imageUrl)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${escapeAttr(input.imageUrl)}" />`
    : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta property="og:title" content="${escapeAttr(input.title)}" />
    <meta property="og:description" content="${escapeAttr(input.description)}" />
    <meta property="og:site_name" content="${escapeAttr(input.siteName)}" />
    <meta property="og:url" content="${escapeAttr(input.url)}" />
    ${imageTag}
    <title>${escapeText(input.title)}</title>
  </head>
  <body>${escapeText(input.description)}</body>
</html>`;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}
