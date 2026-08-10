import { ensureAuthTables, verifyPassword, createSession, sessionCookieHeader } from "../../_lib/admin-auth.js";
import { writeOperationalEvent } from "../../_lib/operational-log.js";

// Accepts native form posts (application/x-www-form-urlencoded) so browsers
// offer to save the username and password, and JSON for API callers.
// On success it redirects to the requested page with the session cookie set.

export async function onRequestPost({ env, request }) {
  const contentType = request.headers.get("content-type") || "";
  let body;
  if (contentType.includes("application/json")) {
    body = await request.json().catch(() => ({}));
  } else {
    const form = await request.formData().catch(() => new FormData());
    body = Object.fromEntries(form.entries());
  }

  const username = clean(body.username);
  const password = String(body.password || "");
  const next = normalizeNext(body.next);

  if (!username || !password) {
    await writeOperationalEvent(env, request, {
      workflow: "admin_auth",
      action: "login",
      status: "unauthorized",
      severity: "warning",
      http_status: 401,
      message: "Admin login failed: username or password missing."
    });
    return redirectWithError(next);
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
    return redirectWithError(next);
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
    return redirectWithError(next);
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

  return new Response(null, {
    status: 302,
    headers: {
      location: next,
      "set-cookie": sessionCookieHeader(token),
      "cache-control": "no-store"
    }
  });
}

function redirectWithError(next) {
  const separator = next.includes("?") ? "&" : "?";
  return new Response(null, {
    status: 302,
    headers: {
      location: `${next}${separator}error=1`,
      "cache-control": "no-store"
    }
  });
}

function normalizeNext(value) {
  const candidate = clean(value);
  if (candidate.startsWith("/") && !candidate.startsWith("//")) {
    return candidate;
  }
  return "/admin";
}

function clean(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}
