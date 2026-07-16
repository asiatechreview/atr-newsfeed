const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || DEFAULT_LIMIT, MAX_LIMIT);
  const category = url.searchParams.get("category");

  let query = "SELECT id, blurb, source_name, source_url, category, telegram_message_id, published_at, created_at FROM feed_items WHERE status = ?";
  const params = ["published"];

  if (category) {
    query += " AND category = ?";
    params.push(category);
  }

  query += " ORDER BY published_at DESC, id DESC LIMIT ?";
  params.push(limit);

  const result = await env.ATR_FEED_DB.prepare(query).bind(...params).all();

  return json({
    items: result.results || []
  });
}

export async function onRequestPost({ env, request }) {
  const auth = request.headers.get("authorization") || "";
  const expected = env.FEED_INGEST_TOKEN ? `Bearer ${env.FEED_INGEST_TOKEN}` : "";

  if (!expected || auth !== expected) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const blurb = clean(body.blurb);
  const sourceName = clean(body.sourceName || body.source_name);
  const sourceUrl = clean(body.sourceUrl || body.source_url);
  const category = clean(body.region || body.category) || "Other news";
  const telegramMessageId = clean(body.telegramMessageId || body.telegram_message_id);
  const publishedAt = clean(body.publishedAt || body.published_at) || new Date().toISOString();

  if (!blurb) {
    return json({ error: "blurb is required" }, 400);
  }

  if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) {
    return json({ error: "sourceUrl must be an http(s) URL" }, 400);
  }

  const result = await env.ATR_FEED_DB.prepare(
    `INSERT INTO feed_items
      (blurb, source_name, source_url, category, telegram_message_id, published_at)
     VALUES (?, ?, ?, ?, ?, ?)
     RETURNING id, blurb, source_name, source_url, category, telegram_message_id, published_at, created_at`
  )
    .bind(blurb, sourceName, sourceUrl, category, telegramMessageId || null, publishedAt)
    .first();

  return json({ item: result }, 201);
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
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
