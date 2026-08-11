import { ensureAuthTables, ensureDisplayNameColumn, sessionUser, verifyPassword, hashPassword } from "../../_lib/admin-auth.js";
import { writeOperationalEvent } from "../../_lib/operational-log.js";

// Self-service profile: display name and password changes for the signed-in user.
// Username is the login identifier and is never editable here.

export async function onRequestGet({ env, request }) {
  const session = await sessionUser(env, request);
  if (!session) return json({ error: "Unauthorized" }, 401);

  await ensureAuthTables(env);
  await ensureDisplayNameColumn(env);
  const user = await env.ATR_FEED_DB.prepare(
    "SELECT username, display_name, role, created_at FROM admin_users WHERE username = ?"
  ).bind(session.username).first();

  if (!user) return json({ error: "User not found" }, 404);

  return json({
    ok: true,
    username: user.username,
    display_name: user.display_name || null,
    role: user.role,
    created_at: user.created_at
  });
}

export async function onRequestPatch({ env, request }) {
  const session = await sessionUser(env, request);
  if (!session) return json({ error: "Unauthorized" }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  await ensureAuthTables(env);
  await ensureDisplayNameColumn(env);

  const updates = [];
  const params = [];
  let changedPassword = false;

  if (body.displayName !== undefined) {
    updates.push("display_name = ?");
    params.push(clean(body.displayName) || null);
  }

  if (body.newPassword !== undefined) {
    const newPassword = String(body.newPassword || "");
    if (newPassword.length < 8) {
      return json({ error: "New password must be at least 8 characters" }, 400);
    }

    const user = await env.ATR_FEED_DB.prepare(
      "SELECT password_hash FROM admin_users WHERE username = ?"
    ).bind(session.username).first();
    if (!user) return json({ error: "User not found" }, 404);

    const currentPassword = String(body.currentPassword || "");
    const verified = await verifyPassword(currentPassword, user.password_hash);
    if (!verified) {
      return json({ error: "Current password is incorrect" }, 400);
    }

    updates.push("password_hash = ?");
    params.push(await hashPassword(newPassword));
    changedPassword = true;
  }

  if (!updates.length) {
    return json({ error: "Nothing to update" }, 400);
  }

  params.push(session.username);
  await env.ATR_FEED_DB.prepare(
    `UPDATE admin_users SET ${updates.join(", ")} WHERE username = ?`
  ).bind(...params).run();

  await writeOperationalEvent(env, request, {
    workflow: "admin_auth",
    action: changedPassword ? "change_password" : "update_profile",
    status: "success",
    severity: "info",
    http_status: 200,
    message: `Admin profile updated for ${session.username}.`,
    details: { username: session.username, changed_password: changedPassword }
  });

  return json({ ok: true });
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
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
