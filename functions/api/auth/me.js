import { sessionUser } from "../../_lib/admin-auth.js";

export async function onRequestGet({ env, request }) {
  const session = await sessionUser(env, request);
  if (!session) {
    return json({ error: "Unauthorized" }, 401);
  }

  return json({ ok: true, username: session.username, display_name: session.display_name || null, role: session.role });
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
