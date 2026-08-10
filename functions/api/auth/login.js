import { ensureAuthTables, verifyPassword, createSession, sessionCookieHeader } from "../../_lib/admin-auth.js";
import { writeOperationalEvent } from "../../_lib/operational-log.js";

export async function onRequestPost({ env, request }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const username = clean(body.username);
  const password = String(body.password || "");
  if (!username || !password) {
    return json({ error: "Username and password required" }, 400);
  }

  await ensureAuthTables(env);

  const user = await env.ATR_FEED_DB.prepare(
    "SELECT username, password_hash, role FROM admin_users WHERE username = ?"
  ).bind(username).first();

  if (!user) {
    await writeOperationalEvent(env, request, {
      workflow: "admin_auth",
      action: "login",
      status: "unauthorized",
      severity: "warning",
      http_status: 401,
      message: `Admin login failed for unknown user ${username}.`,
      details: { username }
    });
    return json({ error: "Invalid username or password" }, 401);
  }

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    await writeOperationalEvent(env, request, {
      workflow: "admin_auth",
      action: "login",
      status: "unauthorized",
      severity: "warning",
      http_status: 401,
      message: `Admin login failed for ${username}: bad password.`,
      details: { username }
    });
    return json({ error: "Invalid username or password" }, 401);
  }

  const token = await createSession(env, user.username);

  await writeOperationalEvent(env, request, {
    workflow: "admin_auth",
    action: "login",
    status: "success",
    severity: "info",
    http_status: 200,
    message: `Admin login: ${user.username}.`,
    details: { username: user.username, role: user.role || "super_admin" }
  });

  return new Response(JSON.stringify({ ok: true, username: user.username, role: user.role || "super_admin" }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "set-cookie": sessionCookieHeader(token),
      "cache-control": "no-store"
    }
  });
}

function clean(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
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
