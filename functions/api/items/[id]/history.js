import { isAdmin } from "../../../_lib/admin-auth.js";

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

// Per-item edit history for the live editor.
//   GET /api/items/{id}/history
// Returns operational events referencing the item id, newest first.
export async function onRequestGet({ env, request, params }) {
  if (!(await isAdmin(env, request))) {
    return json({ error: "Unauthorized" }, 401);
  }

  const rawId = String(params?.id ?? request.url.split("/").filter(Boolean).pop()?.replace("/history", "") ?? "").trim();
  if (!rawId) {
    return json({ error: "item id is required" }, 400);
  }

  try {
    const result = await env.ATR_FEED_DB.prepare(
      `SELECT id, occurred_at, workflow, action, status, severity, http_status, item_id, source_name, source_url, message, details_json
       FROM operational_events
       WHERE item_id = ?
       ORDER BY occurred_at DESC, id DESC
       LIMIT 50`
    )
      .bind(rawId)
      .all();

    const events = (result.results || []).map((event) => {
      let details = {};
      try {
        details = JSON.parse(event.details_json || "{}");
      } catch {
        details = {};
      }
      return {
        id: event.id,
        occurred_at: event.occurred_at,
        workflow: event.workflow,
        action: event.action,
        status: event.status,
        severity: event.severity,
        http_status: event.http_status,
        item_id: event.item_id,
        source_name: event.source_name,
        source_url: event.source_url,
        message: event.message,
        details
      };
    });

    return json({ item_id: rawId, events });
  } catch (error) {
    return json({ error: "history lookup failed", detail: error.message }, 500);
  }
}
