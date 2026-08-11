import { isAdmin } from "../_lib/admin-auth.js";
import { ensureLinkKeyColumn, linkKeyFor } from "../_lib/link-key.js";
import { writeOperationalEvent } from "../_lib/operational-log.js";

// Bounded backfill of link_key for recent items only (default: last 2 days).
// Sai's rule (Aug 11, 2026): no full-database refactor. This endpoint fills the
// hash key for items in a recent window so recent stories get public hash links
// without touching the older archive.

const MAX_DAYS = 30;

export async function onRequestPost({ env, request }) {
  if (!isAdmin(env, request)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const url = new URL(request.url);
  const requested = Number(url.searchParams.get("days"));
  const days = Number.isFinite(requested) && requested > 0 ? Math.min(requested, MAX_DAYS) : 2;
  const cutoff = new Date(Date.now() - days * 864e5).toISOString();

  await ensureLinkKeyColumn(env);

  const rows = await env.ATR_FEED_DB.prepare(
    `SELECT id, source_url FROM feed_items
     WHERE status = 'published'
       AND link_key IS NULL
       AND source_url IS NOT NULL AND source_url != ''
       AND published_at >= ?
     ORDER BY published_at DESC, id DESC`
  ).bind(cutoff).all();

  let updated = 0;
  for (const row of rows.results || []) {
    const key = await linkKeyFor(row.source_url);
    if (!key) continue;
    await env.ATR_FEED_DB.prepare(
      "UPDATE feed_items SET link_key = ? WHERE id = ?"
    ).bind(key, row.id).run();
    updated += 1;
  }

  await writeOperationalEvent(env, request, {
    workflow: "bulletin_ingest",
    action: "backfill_link_keys",
    status: "success",
    severity: "info",
    http_status: 200,
    message: `Backfilled link_key for ${updated} items in the last ${days} days.`,
    details: { days, scanned: (rows.results || []).length, updated }
  });

  return json({ ok: true, days, scanned: (rows.results || []).length, updated });
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
