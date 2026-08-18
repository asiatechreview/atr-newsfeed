// OG/Twitter meta injection helper for bulletin share links.
//
// Resolves the ?item= share parameter the same way public/app.js does:
// numeric item id, or the 10-hex link_key derived from the source URL.
// Returns the meta tags to inject, or null when no item matches.

export const SITE_NAME = "Asia Tech Review Bulletin";
export const SITE_URL = "https://bulletin.asiatechreview.com";
export const OG_IMAGE_PATH = "/og-image.png";
export const OG_IMAGE_URL = `${SITE_URL}${OG_IMAGE_PATH}`;
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

const TAGLINE = "What's moving in Asia tech, as it happens.";

function escapeAttr(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function isNumericId(raw) {
  return /^\d+$/.test(String(raw || "").trim());
}

export function isLinkKey(raw) {
  return /^[0-9a-f]{10}$/i.test(String(raw || "").trim());
}

export function canonicalShareUrl(itemParam) {
  return `${SITE_URL}/?item=${encodeURIComponent(String(itemParam).trim())}`;
}

function defaultTags(url) {
  return [
    `<meta property="og:site_name" content="${escapeAttr(SITE_NAME)}">`,
    `<meta property="og:title" content="${escapeAttr(SITE_NAME)}">`,
    `<meta property="og:description" content="${escapeAttr(TAGLINE)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:url" content="${escapeAttr(url.href)}">`,
    `<meta property="og:image" content="${OG_IMAGE_URL}">`,
    `<meta property="og:image:width" content="${OG_IMAGE_WIDTH}">`,
    `<meta property="og:image:height" content="${OG_IMAGE_HEIGHT}">`,
    `<meta property="og:image:type" content="image/png">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeAttr(SITE_NAME)}">`,
    `<meta name="twitter:description" content="${escapeAttr(TAGLINE)}">`,
    `<meta name="twitter:image" content="${OG_IMAGE_URL}">`
  ].join("\n    ");
}

function itemTags(item, itemParam) {
  const title = escapeAttr(item.headline || SITE_NAME);
  const description = escapeAttr(item.blurb || TAGLINE);
  const canonical = escapeAttr(canonicalShareUrl(itemParam));
  return [
    `<meta property="og:site_name" content="${escapeAttr(SITE_NAME)}">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:type" content="article">`,
    `<meta property="og:url" content="${canonical}">`,
    `<meta property="og:image" content="${OG_IMAGE_URL}">`,
    `<meta property="og:image:width" content="${OG_IMAGE_WIDTH}">`,
    `<meta property="og:image:height" content="${OG_IMAGE_HEIGHT}">`,
    `<meta property="og:image:type" content="image/png">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${description}">`,
    `<meta name="twitter:image" content="${OG_IMAGE_URL}">`
  ].join("\n    ");
}

// Look up a published item by numeric id or link_key.
// Returns { id, headline, blurb, link_key } or null.
export async function lookupItem(env, itemParam) {
  const raw = String(itemParam || "").trim();
  if (!raw || (!isNumericId(raw) && !isLinkKey(raw))) return null;
  try {
    const row = await env.ATR_FEED_DB.prepare(
      "SELECT id, headline, blurb, source_name, source_url, link_key, published_at, region, category FROM feed_items WHERE status = 'published' AND (id = ?1 OR LOWER(link_key) = LOWER(?2)) LIMIT 1"
    )
      .bind(isNumericId(raw) ? Number(raw) : 0, raw)
      .first();
    return row || null;
  } catch {
    return null;
  }
}

// Build the meta block to inject for a given request URL.
// Always returns tags: item-specific when ?item= resolves, defaults otherwise.
export async function ogMetaBlock(env, url) {
  const itemParam = url.searchParams.get("item");
  if (itemParam) {
    const item = await lookupItem(env, itemParam);
    if (item) return itemTags(item, itemParam);
  }
  return defaultTags(url);
}
