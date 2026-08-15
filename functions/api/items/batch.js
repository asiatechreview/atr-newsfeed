import { isAdmin } from "../../_lib/admin-auth.js";
import { writeOperationalEvent } from "../../_lib/operational-log.js";

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function clean(value) {
  return String(value ?? "").trim();
}

// Bulk update endpoint for the Live Items admin: apply a category or status
// change to many items in one request.
//   POST /api/items/batch
//   { ids: ["12", "435", ...], category?: "Chips", status?: "hidden" }
export async function onRequestPost({ env, request }) {
  if (!(await isAdmin(env, request))) {
    await writeOperationalEvent(env, request, {
      workflow: "bulletin_admin",
      action: "bulk_update",
      status: "unauthorized",
      severity: "warning",
      http_status: 401,
      message: "Unauthorized bulk update attempt."
    });
    return json({ error: "Unauthorized" }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const rawIds = Array.isArray(body.ids) ? body.ids.map((id) => String(id).trim()).filter(Boolean) : [];
  const category = body.category === undefined ? undefined : clean(body.category);
  const status = body.status === undefined ? undefined : clean(body.status);

  if (!rawIds.length) {
    return json({ error: "ids is required" }, 400);
  }
  if (category === undefined && status === undefined) {
    return json({ error: "category or status is required" }, 400);
  }
  if (rawIds.length > 500) {
    return json({ error: "too many ids (max 500)" }, 400);
  }
  if (category !== undefined && !category) {
    return json({ error: "category cannot be empty" }, 400);
  }
  if (status !== undefined && !["published", "hidden", "removed"].includes(status)) {
    return json({ error: "status must be published, hidden or removed" }, 400);
  }

  const sets = [];
  const params = [];
  if (category !== undefined) {
    sets.push("category = ?");
    params.push(category);
  }
  if (status !== undefined) {
    sets.push("status = ?");
    params.push(status);
  }
  sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')");

  const placeholders = rawIds.map(() => "?").join(", ");
  params.push(...rawIds);

  const query = `UPDATE feed_items
    SET ${sets.join(", ")}
    WHERE id IN (${placeholders})
    RETURNING id, headline, category, status`;

  try {
    const result = await env.ATR_FEED_DB.prepare(query).bind(...params).all();
    const updated = result.results || [];

    await writeOperationalEvent(env, request, {
      workflow: "bulletin_admin",
      action: "bulk_update",
      status: "success",
      severity: "info",
      http_status: 200,
      message: `Bulk updated ${updated.length} item(s).`,
      details: {
        requested: rawIds.length,
        updated: updated.length,
        category: category ?? null,
        status: status ?? null
      }
    });

    return json({ updated: updated.length, requested: rawIds.length, items: updated });
  } catch (error) {
    await writeOperationalEvent(env, request, {
      workflow: "bulletin_admin",
      action: "bulk_update",
      status: "error",
      severity: "error",
      http_status: 500,
      message: "Bulk update failed.",
      details: { error: error.message }
    });
    return json({ error: "bulk update failed" }, 500);
  }
}
