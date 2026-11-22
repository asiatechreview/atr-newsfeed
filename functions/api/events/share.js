import { writeOperationalEvent } from "../../_lib/operational-log.js";

// Public, silent beacon from the share button. No cookies, no identifiers —
// just an aggregate copy count per item. Failures never affect the reader.
export async function onRequestPost({ env, request }) {
  try {
    const body = await request.json().catch(() => ({}));
    const itemId = String(body.id || "").trim().slice(0, 80);
    const linkKey = String(body.link_key || "").trim().slice(0, 40);
    if (!itemId && !linkKey) return json({ ok: false }, 400);

    await writeOperationalEvent(env, request, {
      workflow: "share",
      action: "copy",
      status: "success",
      severity: "info",
      item_id: itemId || linkKey,
      message: "Share link copied.",
      details: { link_key: linkKey || null }
    });
    return json({ ok: true });
  } catch {
    return json({ ok: true });
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
