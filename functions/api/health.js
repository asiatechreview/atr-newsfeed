export async function onRequestGet({ env }) {
  try {
    const result = await env.ATR_FEED_DB.prepare("SELECT COUNT(*) AS count FROM feed_items").first();
    return json({ ok: true, items: result.count });
  } catch (error) {
    return json({ ok: false, error: error.message }, 500);
  }
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
