const SITE_TITLE = "Asia Tech Review Daily Feed";
const SITE_URL = "https://feed.asiatechreview.com";

export async function onRequestGet({ env }) {
  const result = await env.ATR_FEED_DB.prepare(
    "SELECT * FROM feed_items WHERE status = ? ORDER BY published_at DESC, id DESC LIMIT 50"
  )
    .bind("published")
    .all();

  const items = (result.results || []).map((item) => {
    const link = `${SITE_URL}/?item=${item.id}`;
    return [
      "<item>",
      `<title>${escapeXml(item.commentary || item.blurb)}</title>`,
      `<link>${escapeXml(link)}</link>`,
      `<guid isPermaLink=\"false\">atr-feed-${item.id}</guid>`,
      `<pubDate>${new Date(item.published_at).toUTCString()}</pubDate>`,
      `<category>${escapeXml(item.category || "Other news")}</category>`,
      `<description>${escapeXml(itemDescription(item))}</description>`,
      "</item>"
    ].join("");
  });

  const xml = `<?xml version=\"1.0\" encoding=\"UTF-8\" ?>
<rss version=\"2.0\">
  <channel>
    <title>${SITE_TITLE}</title>
    <link>${SITE_URL}</link>
    <description>Concise Asia tech news updates from Asia Tech Review.</description>
    <language>en</language>
    ${items.join("\\n    ")}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=120"
    }
  });
}

function itemDescription(item) {
  const text = [
    item.quote_blurb ? `Quote: ${item.quote_blurb}` : "",
    item.commentary || item.blurb,
    `[${item.source_name}] ${item.source_url}`
  ].filter(Boolean);

  return text.join("\n\n");
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
