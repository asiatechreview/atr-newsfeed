export const SITE_NAME = "Asia Tech Review Bulletin";
export const SITE_URL = "https://bulletin.asiatechreview.com";
export const API_BASE_PATH = "/api/v1";
export const API_VERSION = "1.0.0";
export const DEFAULT_LIMIT = 100;
export const MAX_LIMIT = 500;
export const CACHE_SECONDS = 300;

export function json(payload, status = 200, cacheSeconds = CACHE_SECONDS) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cacheSeconds > 0 ? `public, max-age=${cacheSeconds}` : "no-store"
    }
  });
}

export async function loadBulletinItems(request, options = {}) {
  const origin = new URL(request.url).origin;
  const sourceUrl = new URL(`${origin}/api/items`);
  const limit = clampLimit(options.limit ?? MAX_LIMIT);
  const offset = Math.max(0, Number(options.offset) || 0);

  sourceUrl.searchParams.set("limit", String(limit));
  if (offset) sourceUrl.searchParams.set("offset", String(offset));
  if (options.category) sourceUrl.searchParams.set("category", options.category);
  if (options.date) sourceUrl.searchParams.set("date", options.date);

  const response = await fetch(sourceUrl, {
    headers: { accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error(`Bulletin item API returned ${response.status}`);
  }

  const payload = await response.json();
  const items = Array.isArray(payload.items) ? payload.items : [];
  const total = Number.isFinite(Number(payload.total)) ? Number(payload.total) : items.length;

  return { items, total };
}

export async function loadAllBulletinItems(request, options = {}) {
  const allItems = [];
  const pageSize = MAX_LIMIT;
  let offset = 0;
  let total = Infinity;

  while (allItems.length < total) {
    const page = await loadBulletinItems(request, { ...options, limit: pageSize, offset });
    allItems.push(...page.items);
    total = page.total;
    if (page.items.length < pageSize) break;
    offset += pageSize;
  }

  return { items: allItems, total };
}

export function toPublicItem(item) {
  const rawId = clean(item.id);
  const title = clean(item.headline || item.title || item.blurb || "Asia tech update");
  const blurb = clean(item.blurb);
  const sourceName = clean(item.source_name || "Source");
  const sourceUrl = clean(item.source_url);
  const category = clean(item.category) || "Other news";
  const publishedAt = validDate(item.published_at);
  const tags = normalizeTags(item.tags, category);

  return {
    type: "bulletin_item",
    id: publicId(rawId),
    raw_id: rawId,
    link_key: clean(item.link_key) || null,
    title,
    blurb,
    source_name: sourceName,
    source_url: sourceUrl,
    source: {
      name: sourceName,
      url: sourceUrl
    },
    url: sourceUrl,
    category,
    tags,
    published_at: publishedAt,
    date_published: publishedAt,
    links: {
      source: sourceUrl,
      json_feed: `${SITE_URL}/feed.json`,
      rss: `${SITE_URL}/rss.xml`
    }
  };
}

export function publicId(rawId) {
  const value = clean(rawId);
  return value.startsWith("bulletin-") ? value : `bulletin-${value}`;
}

export function stripPublicId(id) {
  return clean(id).replace(/^bulletin-/, "");
}

export function filterItems(items, options = {}) {
  const query = clean(options.query).toLowerCase();
  const category = clean(options.category).toLowerCase();
  const tag = clean(options.tag).toLowerCase();

  return items.filter((item) => {
    if (category && clean(item.category).toLowerCase() !== category) return false;

    const itemTags = (Array.isArray(item.tags) ? item.tags : []).map((value) => clean(value).toLowerCase());
    if (tag && !itemTags.some((value) => value.includes(tag))) return false;
    if (!query) return true;

    return [
      item.title,
      item.blurb,
      item.source_name,
      item.source_url,
      item.category,
      ...itemTags
    ].some((value) => clean(value).toLowerCase().includes(query));
  });
}

export function summarizeCollection(items, request, limit, total = items.length, offset = 0) {
  const url = new URL(request.url);

  return {
    type: "bulletin_item_collection",
    count: items.length,
    total,
    limit,
    offset,
    generated_at: new Date().toISOString(),
    self: `${url.origin}${url.pathname}${url.search}`,
    items
  };
}

export function categoriesFromItems(items) {
  const counts = new Map();

  for (const item of items) {
    const category = clean(item.category) || "Other news";
    counts.set(category, (counts.get(category) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({
      type: "bulletin_category",
      name,
      count,
      items_url: `${SITE_URL}${API_BASE_PATH}/items?category=${encodeURIComponent(name)}`
    }));
}

export function clampLimit(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(number), MAX_LIMIT);
}

export function clean(value) {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

function normalizeTags(tags, category) {
  const values = Array.isArray(tags)
    ? tags
    : typeof tags === "string"
      ? tags.split(",")
      : [];

  const allTags = [...values, category]
    .map(clean)
    .filter(Boolean);

  return [...new Set(allTags)];
}

function validDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}
