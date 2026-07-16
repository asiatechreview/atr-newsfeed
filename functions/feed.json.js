export async function onRequestGet({ env }) {
  const result = await env.ATR_FEED_DB.prepare(
    "SELECT id, blurb, source_name, source_url, category, telegram_message_id, published_at, created_at FROM feed_items WHERE status = ? ORDER BY published_at DESC, id DESC LIMIT 100"
  )
    .bind("published")
    .all();

  return new Response(JSON.stringify({ items: result.results || [] }, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=120"
    }
  });
}
