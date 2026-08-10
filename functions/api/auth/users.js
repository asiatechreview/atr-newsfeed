import { ensureAuthTables, hashPassword, isValidBearer } from "../../_lib/admin-auth.js";
import { writeOperationalEvent } from "../../_lib/operational-log.js";

// Admin user management. All routes require the existing ingest bearer token,
// which only automation and the site owner hold, so accounts cannot be
// created or reset by anyone without that token.

export async function onRequestGet({ env, request }) {
  if (!isValidBearer(env, request)) return json({ error: "Unauthorized" }, 401);

  await ensureAuthTables(env);
  const result = await env.ATR_FEED_DB.prepare(
    "SELECT username, role, created_at FROM admin_users ORDER BY username"
  ).all();

  return json({ ok: true, users: result.results || [] });
}

export async function onRequestPost({ env, request }) {
  if (!isValidBearer(env, request)) return json({ error: "Unauthorized" }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const username = clean(body.username);
  const password = String(body.password || "");
  const role = cleanRole(body.role);

  if (!username || password.length < 8) {
    return json({ error: "username and a password of at least 8 characters are required" }, 400);
  }

  await ensureAuthTables(env);
  const hash = await hashPassword(password);

  await env.ATR_FEED_DB.prepare(
    `INSERT INTO admin_users (username, password_hash, role) VALUES (?, ?, ?)
     ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash, role = excluded.role`
  ).bind(username, hash, role).run();

  await writeOperationalEvent(env, request, {
    workflow: "admin_auth",
    action: "upsert_user",
    status: "success",
    severity: "info",
    http_status: 200,
    message: `Admin user ${username} upserted.`,
    details: { username, role }
  });

  return json({ ok: true, username, role });
}

export async function onRequestDelete({ env, request }) {
  if (!isValidBearer(env, request)) return json({ error: "Unauthorized" }, 401);

  const url = new URL(request.url);
  const username = clean(url.searchParams.get("username"));
  if (!username) return json({ error: "username is required" }, 400);

  await ensureAuthTables(env);
  await env.ATR_FEED_DB.prepare("DELETE FROM admin_users WHERE username = ?").bind(username).run();

  await writeOperationalEvent(env, request, {
    workflow: "admin_auth",
    action: "delete_user",
    status: "success",
    severity: "info",
    http_status: 200,
    message: `Admin user ${username} deleted.`,
    details: { username }
  });

  return json({ ok: true, username });
}

function clean(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function cleanRole(value) {
  return clean(value) || "super_admin";
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
