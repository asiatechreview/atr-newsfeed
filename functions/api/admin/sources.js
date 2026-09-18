import { isAdmin } from "../../_lib/admin-auth.js";
import { STATIC_ITEMS } from "../../_data/static-items.js";

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

export async function onRequestGet({ env, request }) {
  if (!(await isAdmin(env, request))) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const sources = new Set();
    for (const item of STATIC_ITEMS) {
      if (item && item.source_name) sources.add(item.source_name);
    }

    if (env?.ATR_FEED_DB) {
      const result = await env.ATR_FEED_DB
        .prepare("SELECT DISTINCT source_name FROM feed_items WHERE status IN ('published','hidden','draft') AND source_name IS NOT NULL AND source_name != ''")
        .all();
      for (const row of result.results || []) {
        if (row.source_name) sources.add(row.source_name);
      }
    }

    return json({ sources: [...sources].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })) });
  } catch (error) {
    return json({ error: error.message || "failed to list sources" }, 500);
  }
}