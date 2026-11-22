import { isAdmin } from "../_lib/admin-auth.js";

// Admin-only: most-shared stories, all-time and last 7 days.
export async function onRequestGet({ env, request }) {
  if (!(await isAdmin(env, request))) return json({ error: "Unauthorized" }, 401);

  const limit = Math.min(Math.max(Number(new URL(request.url).searchParams.get("limit")) || 5, 1), 20);
  try {
    const rows = await env.ATR_FEED_DB.prepare(
      `SELECT e.item_id AS item_id,
              COUNT(*) AS total,
              SUM(CASE WHEN e.occurred_at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-7 days') THEN 1 ELSE 0 END) AS recent,
              f.headline, f.source_name
       FROM operational_events e
       LEFT JOIN feed_items f ON CAST(f.id AS TEXT) = e.item_id
       WHERE e.workflow = 'share' AND e.action = 'copy'
       GROUP BY e.item_id
       ORDER BY total DESC
       LIMIT ?`
    ).bind(limit).all();
    return json({ top: rows.results || [] });
  } catch {
    return json({ top: [] });
  }
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
