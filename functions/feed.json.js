const SITE_TITLE = "Asia Tech Review Bulletin";
const SITE_URL = "https://bulletin.asiatechreview.com";
const FEED_URL = `${SITE_URL}/feed.json`;
const FEED_LIMIT = 100;
const CACHE_SECONDS = 300;

export async function onRequestGet({ request }) {
  const items = await loadItems(request);
  const payload = {
    version: "https://jsonfeed.org/version/1.1",
    title: SITE_TITLE,
    home_page_url: SITE_URL,
    feed_url: FEED_URL,
    language: "en",
    description: "Short headline-led Asia tech updates from Asia Tech Review.",
    items: items.map(toJsonFeedItem)
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/feed+json; charset=utf-8",
      "cache-control": `public, max-age=${CACHE_SECONDS}`
    }
  });
}

async function loadItems(request) {
  const origin = new URL(request.url).origin;
  const response = await fetch(`${origin}/api/items?limit=${FEED_LIMIT}`, {
    headers: { accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error(`Bulletin API returned ${response.status}`);
  }

  const payload = await response.json();
  return Array.isArray(payload.items) ? payload.items : [];
}

function toJsonFeedItem(item) {
  const id = String(item.id || "").trim();
  const sourceName = clean(item.source_name || "Source");
  const sourceUrl = clean(item.source_url);
  const tags = clean(item.category) ? [clean(item.category)] : [];

  return {
    id: `bulletin-${id}`,
    title: clean(item.headline || item.title || item.blurb || "Asia tech update"),
    content_text: clean(item.blurb),
    content_html: `${escapeHtml(clean(item.blurb))}<br><br>Source: ${sourceUrl ? `<a href="${escapeHtml(sourceUrl)}">${escapeHtml(sourceName)}</a>` : escapeHtml(sourceName)}`,
    url: sourceUrl || undefined,
    external_url: sourceUrl || undefined,
    date_published: validDate(item.published_at),
    tags
  };
}

function validDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function clean(value) {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
