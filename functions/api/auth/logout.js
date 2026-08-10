import { destroySession, clearSessionCookieHeader } from "../../_lib/admin-auth.js";
import { writeOperationalEvent } from "../../_lib/operational-log.js";

export async function onRequestPost({ env, request }) {
  await destroySession(env, request);

  await writeOperationalEvent(env, request, {
    workflow: "admin_auth",
    action: "logout",
    status: "success",
    severity: "info",
    http_status: 200,
    message: "Admin logout."
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "set-cookie": clearSessionCookieHeader(),
      "cache-control": "no-store"
    }
  });
}
