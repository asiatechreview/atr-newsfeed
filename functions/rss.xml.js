const SITE_TITLE = "Asia Tech Review Daily Feed";
const SITE_URL = "https://bulletin.asiatechreview.com";

export async function onRequestGet({ env }) {
  const result = await env.ATR_FEED_DB.prepare(
    "SELECT id, blurb, source_name, source_url, category, published_at FROM feed_items WHERE status = ? ORDER BY published_at DESC, id DESC LIMIT 50"
  )
    .bind("published")
    .all();

  const items = (result.results || []).map((item) => {
    const link = `${SITE_URL}/?item=${item.id}`;
    return [
      "<item>",
      `<title>${escapeXml(item.blurb)}</title>`,
      `<link>${escapeXml(link)}</link>`,
      `<guid isPermaLink=\"false\">atr-feed-${item.id}</guid>`,
      `<pubDate>${new Date(item.published_at).toUTCString()}</pubDate>`,
      `<category>${escapeXml(item.category || "Other news")}</category>`,
      `<description>${escapeXml(`${item.blurb} [${item.source_name}] ${item.source_url}`)}</description>`,
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

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
