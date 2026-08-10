const DEFAULT_NEWSLETTER = {
  title: "Grab bets on fintech to reinforce its tech story",
  blurb: "The company's bid to become a fintech heavyweight is about to face its first major test",
  url: "https://www.asiatechreview.com/p/grab-bets-on-fintech-to-reinforce",
  image: "https://substackcdn.com/image/fetch/$s_!PMQo!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F5db78b08-9f8e-4b8f-9ba1-bcdb75abfb84_1672x941.png"
};

export async function ensureSiteContentTable(env) {
  if (!env?.ATR_FEED_DB) return;

  await env.ATR_FEED_DB.prepare(
    `CREATE TABLE IF NOT EXISTS site_content (
      content_key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      updated_by TEXT
    )`
  ).run();
}

export async function readSiteContent(env) {
  const result = { newsletter: { ...DEFAULT_NEWSLETTER }, sponsors: [] };

  if (!env?.ATR_FEED_DB) return result;

  const rows = await env.ATR_FEED_DB.prepare(
    "SELECT content_key, value_json FROM site_content"
  ).all();

  for (const row of rows.results || []) {
    const value = parseJson(row.value_json);
    if (row.content_key === "newsletter" && value && typeof value === "object") {
      result.newsletter = { ...DEFAULT_NEWSLETTER, ...value };
    }
    if (row.content_key === "sponsors" && Array.isArray(value)) {
      result.sponsors = value;
    }
  }

  return result;
}

export async function writeSiteContent(env, updates, actor) {
  if (!env?.ATR_FEED_DB) return;

  for (const [key, value] of Object.entries(updates)) {
    await env.ATR_FEED_DB.prepare(
      `INSERT INTO site_content (content_key, value_json, updated_at, updated_by)
       VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), ?)
       ON CONFLICT(content_key) DO UPDATE SET
         value_json = excluded.value_json,
         updated_at = excluded.updated_at,
         updated_by = excluded.updated_by`
    ).bind(key, JSON.stringify(value), actor || null).run();
  }
}

function parseJson(value) {
  try {
    return JSON.parse(value || "");
  } catch {
    return null;
  }
}
