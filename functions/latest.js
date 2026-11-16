import { loadFeedItems } from "./api/items.js";

// Human- and agent-readable "latest stories" page. ChatGPT's fetcher handles
// HTML reliably where it often fails on raw JSON/XML content types, so this
// gives assistants a page they can read and summarise.

const SITE_URL = "https://bulletin.asiatechreview.com";

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

function bulletinLink(item) {
  const key = item.link_key || item.id;
  return key ? `${SITE_URL}/?item=${encodeURIComponent(key)}` : SITE_URL;
}

function clean(value) {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 25, 1), 100);
  const format = (url.searchParams.get("format") || "").toLowerCase();
  const { items } = await loadFeedItems({ env, limit });

  if (format === "text") {
    const lines = [
      `Asia Tech Review Bulletin — latest ${items.length} stories`,
      SITE_URL,
      ""
    ];
    for (const item of items) {
      lines.push(
        `${clean(item.published_at)} | ${clean(item.category) || "News"}${item.country ? ` · ${clean(item.country)}` : ""}`,
        clean(item.headline || item.title) || "(untitled)",
        clean(item.blurb),
        `Source: ${clean(item.source_name) || "Source"} — ${clean(item.source_url)}`,
        `Bulletin: ${bulletinLink(item)}`,
        "---"
      );
    }
    return new Response(lines.join("\n"), {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=300"
      }
    });
  }

  const articles = items.map((item) => {
    const title = escapeHtml(clean(item.headline || item.title) || "(untitled)");
    const blurb = escapeHtml(clean(item.blurb));
    const source = escapeHtml(clean(item.source_name) || "Source");
    const sourceUrl = escapeHtml(clean(item.source_url));
    const meta = [clean(item.category), clean(item.country)].filter(Boolean).map(escapeHtml).join(" · ");
    const published = escapeHtml(clean(item.published_at));
    return `<article>
      <h2><a href="${sourceUrl}" rel="noopener">${title}</a></h2>
      <p>${blurb}</p>
      <p class="meta">${source} · ${published}${meta ? ` · ${meta}` : ""} · <a href="${escapeHtml(bulletinLink(item))}">Bulletin</a></p>
    </article>`;
  }).join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Latest stories — Asia Tech Review Bulletin</title>
  <meta name="description" content="Latest Asia tech stories from ATR Bulletin. Machine-readable page for assistants: append ?format=text for plain text.">
  <link rel="alternate" type="application/feed+json" href="/feed.json">
  <link rel="alternate" type="application/rss+xml" href="/rss.xml">
  <style>
    body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; max-width: 760px; margin: 0 auto; padding: 24px; line-height: 1.55; }
    article { border-bottom: 1px solid #ddd; padding: 16px 0; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    h2 { font-size: 17px; margin: 0 0 6px; }
    h2 a { color: #111; text-decoration: none; }
    h2 a:hover { text-decoration: underline; }
    p { margin: 0 0 8px; }
    .meta { font-size: 12px; color: #666; }
    .note { font-size: 12px; color: #666; margin-bottom: 18px; }
  </style>
</head>
<body>
  <h1>Asia Tech Review Bulletin — latest stories</h1>
  <p class="note">Updated feed for readers and assistants. ${items.length} stories. Plain text: <a href="/latest?format=text">/latest?format=text</a> · JSON: <a href="/feed.json">/feed.json</a> · RSS: <a href="/rss.xml">/rss.xml</a></p>
  ${articles}
</body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300"
    }
  });
}
