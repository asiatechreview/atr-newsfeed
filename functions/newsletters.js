import { readSiteContent } from "./_lib/site-content.js";

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

export function renderNewsletterArchive(editions = []) {
  const entries = editions.map((edition) => {
    const url = escapeHtml(edition.url);
    const title = escapeHtml(edition.title);
    const subhead = escapeHtml(edition.subhead || edition.blurb || "");
    const image = edition.image ? escapeHtml(encodeURIComponent(edition.image)) : "";
    const media = image
      ? `<a class="archive-image" href="${url}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true"><img src="/api/newsletter-image?src=${image}" alt="" width="960" height="540" loading="lazy" decoding="async"></a>`
      : "";
    return `<article class="archive-entry">
        ${media}
        <div class="archive-copy">
          <h3><a href="${url}" target="_blank" rel="noopener">${title}</a></h3>
          ${subhead ? `<p>${subhead}</p>` : ""}
          <a class="archive-read" href="${url}" target="_blank" rel="noopener">Read now →</a>
        </div>
      </article>`;
  }).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Newsletter archive — Asia Tech Review</title>
  <meta name="description" content="Every Asia Tech Review newsletter, newest first.">
  <link rel="icon" href="/atr-bulletin-20260905-v2.png" type="image/png">
  <link rel="alternate" type="application/rss+xml" title="Asia Tech Review Bulletin RSS" href="/rss.xml">
  <link rel="stylesheet" href="/styles.css">
  <script>
    try {
      var saved = localStorage.getItem("atr-bulletin-theme");
      if (saved) document.documentElement.dataset.theme = saved;
    } catch (e) {}
  </script>
  <style>
    .archive-shell {
      width: 100%;
      min-height: 100vh;
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-body);
    }
    .archive-main {
      width: min(100%, 884px);
      margin: 0 auto;
      padding: 22px;
    }
    .archive-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 16px;
      margin: 4px 0 18px;
    }
    .archive-head .section-title {
      margin: 0;
    }
    .archive-back {
      font: 600 11px/1 var(--font-meta);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--link);
      text-decoration: none;
      border-bottom: 1px solid var(--link);
      padding-bottom: 2px;
      white-space: nowrap;
    }
    .archive-entry {
      display: grid;
      grid-template-columns: 240px minmax(0, 1fr);
      gap: 18px;
      align-items: start;
      padding: 18px 0;
      border-bottom: 1px solid var(--border);
    }
    .archive-entry:last-child {
      border-bottom: 0;
    }
    .archive-image {
      display: block;
      aspect-ratio: 16 / 9;
      overflow: hidden;
      border: 1px solid var(--newsletter-border);
      border-radius: var(--radius);
      background: var(--panel);
    }
    .archive-image img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .archive-copy h3 {
      margin: 0 0 7px;
      font: 600 18px/1.25 var(--font-body);
    }
    .archive-copy h3 a {
      color: var(--text);
      text-decoration: none;
    }
    .archive-copy h3 a:hover {
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    .archive-copy p {
      margin: 0 0 10px;
      color: var(--dek);
      font: 400 14px/1.5 var(--font-body);
    }
    .archive-read {
      display: inline-flex;
      align-items: center;
      padding: 9px 16px;
      border: 1px solid var(--accent);
      border-radius: var(--radius);
      color: var(--newsletter-accent);
      font: 600 12px/1 var(--font-meta);
      text-decoration: none;
    }
    .archive-read:hover {
      background: rgba(255, 255, 255, 0.06);
    }
    .archive-empty {
      color: var(--muted);
      padding: 24px 0;
    }
    @media (max-width: 640px) {
      .archive-main {
        padding: 18px 16px;
      }
      .archive-entry {
        grid-template-columns: 1fr;
      }
      .archive-head {
        align-items: center;
      }
    }
  </style>
</head>
<body>
  <div class="archive-shell">
    <header class="site-masthead">
      <h1><a href="/" aria-label="Asia Tech Review homepage">Asia Tech Review</a></h1>
      <p class="masthead-sub">Bulletin</p>
    </header>
    <main class="archive-main">
      <div class="archive-head">
        <h2 class="section-title">All newsletters</h2>
        <a class="archive-back" href="/">← Back to the Bulletin</a>
      </div>
      ${entries || '<p class="archive-empty">No newsletters yet.</p>'}
    </main>
  </div>
</body>
</html>`;
}

export async function onRequestGet({ env }) {
  let editions = [];
  try {
    const content = await readSiteContent(env);
    editions = Array.isArray(content.newsletterEditions) ? content.newsletterEditions : [];
  } catch {
    editions = [];
  }
  return new Response(renderNewsletterArchive(editions), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=60"
    }
  });
}
