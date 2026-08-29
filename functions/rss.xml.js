import { loadFeedItems } from "./api/items.js";

const SITE_TITLE = "Asia Tech Review Bulletin";
const SITE_URL = "https://bulletin.asiatechreview.com";
const FEED_URL = `${SITE_URL}/rss.xml`;
const FEED_LIMIT = 100;
const CACHE_SECONDS = 300;

export async function onRequestGet({ env }) {
  const { items } = await loadFeedItems({ env, limit: FEED_LIMIT });
  const updatedAt = latestDate(items);
  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${escapeXml(SITE_URL)}</link>
    <atom:link href="${escapeXml(FEED_URL)}" rel="self" type="application/rss+xml" />
    <description>Short headline-led Asia tech updates from Asia Tech Review.</description>
    <language>en</language>
    <lastBuildDate>${updatedAt.toUTCString()}</lastBuildDate>
    ${items.map(toRssItem).join("\n    ")}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": `public, max-age=${CACHE_SECONDS}`
    }
  });
}

function toRssItem(item) {
  const id = clean(item.id);
  const title = clean(item.headline || item.title || item.blurb || "Asia tech update");
  const blurb = clean(item.blurb);
  const sourceName = clean(item.source_name || "Source");
  const sourceUrl = clean(item.source_url);
  const publishedAt = parseDate(item.published_at);
  const description = `${escapeHtml(blurb)}<br><br>Source: ${sourceUrl ? `<a href="${escapeHtml(sourceUrl)}">${escapeHtml(sourceName)}</a>` : escapeHtml(sourceName)}`;

  return [
    "<item>",
    `<title>${escapeXml(title)}</title>`,
    `<description><![CDATA[${escapeCdata(description)}]]></description>`,
    sourceUrl ? `<link>${escapeXml(sourceUrl)}</link>` : "",
    `<guid isPermaLink="false">bulletin-${escapeXml(id)}</guid>`,
    `<pubDate>${publishedAt.toUTCString()}</pubDate>`,
    clean(item.category) ? `<category>${escapeXml(clean(item.category))}</category>` : "",
    sourceUrl ? `<source url="${escapeXml(sourceUrl)}">${escapeXml(sourceName)}</source>` : "",
    "</item>"
  ].filter(Boolean).join("");
}

function latestDate(items) {
  const dates = items.map((item) => parseDate(item.published_at).getTime()).filter(Boolean);
  return dates.length ? new Date(Math.max(...dates)) : new Date();
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function clean(value) {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeCdata(value) {
  return String(value ?? "").replaceAll("]]>", "]]]]><![CDATA[>");
}
