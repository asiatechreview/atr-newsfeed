const SESSION_COOKIE = "atr_admin_session";
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days, sliding renewal
const PBKDF2_ITERATIONS = 100000;

export async function ensureAuthTables(env) {
  if (!env?.ATR_FEED_DB) return;

  await env.ATR_FEED_DB.prepare(
    `CREATE TABLE IF NOT EXISTS admin_users (
      username TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'super_admin',
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    )`
  ).run();

  await env.ATR_FEED_DB.prepare(
    `CREATE TABLE IF NOT EXISTS admin_sessions (
      token TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )`
  ).run();

  await env.ATR_FEED_DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions (expires_at)"
  ).run();
}

export async function hashPassword(password) {
  const salt = randomHex(16);
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt}$${hash}`;
}

export async function verifyPassword(password, stored) {
  try {
    const [scheme, iterations, salt, hash] = String(stored || "").split("$");
    if (scheme !== "pbkdf2" || !iterations || !salt || !hash) return false;
    const candidate = await pbkdf2(password, salt, Number(iterations));
    return timingSafeEqualHex(candidate, hash);
  } catch {
    return false;
  }
}

export async function createSession(env, username) {
  const token = randomHex(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  await env.ATR_FEED_DB.prepare(
    "INSERT INTO admin_sessions (token, username, expires_at) VALUES (?, ?, ?)"
  ).bind(token, username, expiresAt).run();
  return token;
}

export async function destroySession(env, request) {
  const token = sessionTokenFromRequest(request);
  if (!token || !env?.ATR_FEED_DB) return;
  try {
    await env.ATR_FEED_DB.prepare("DELETE FROM admin_sessions WHERE token = ?").bind(token).run();
  } catch {
    // Session cleanup must never block logout.
  }
}

export async function sessionUser(env, request) {
  const token = sessionTokenFromRequest(request);
  if (!token || !env?.ATR_FEED_DB) return null;
  const row = await env.ATR_FEED_DB.prepare(
    "SELECT username, expires_at FROM admin_sessions WHERE token = ? AND expires_at > ?"
  ).bind(token, new Date().toISOString()).first();
  if (!row?.username) return null;

  // Sliding renewal: extend the session on every valid use so active admins
  // are not logged out by the TTL. Admin traffic is low; one UPDATE per
  // request is negligible and renewal must never break session validation.
  try {
    await env.ATR_FEED_DB.prepare(
      "UPDATE admin_sessions SET expires_at = ? WHERE token = ?"
    ).bind(new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString(), token).run();
  } catch {
    // Ignore renewal failures; the session is still valid.
  }

  let role = "super_admin";
  let displayName = null;
  try {
    const user = await env.ATR_FEED_DB.prepare(
      "SELECT role, display_name FROM admin_users WHERE username = ?"
    ).bind(row.username).first();
    if (user?.role) role = user.role;
    if (user?.display_name) displayName = user.display_name;
  } catch {
    // Role lookup must never break session validation.
  }

  return { username: row.username, role, display_name: displayName };
}

export async function ensureDisplayNameColumn(env) {
  if (!env?.ATR_FEED_DB) return;
  try {
    await env.ATR_FEED_DB.prepare("ALTER TABLE admin_users ADD COLUMN display_name TEXT").run();
  } catch {
    // Column already exists.
  }
}

// Returns the acting identity: username for a valid session,
// "automation" for a valid bearer token, or null when unauthenticated.
export async function getActor(env, request) {
  const session = await sessionUser(env, request);
  if (session?.username) return session.username;
  return isValidBearer(env, request) ? "automation" : null;
}

export async function getRole(env, request) {
  const session = await sessionUser(env, request);
  return session?.role || null;
}

export async function isAdmin(env, request) {
  return (await getActor(env, request)) !== null;
}

export function isValidBearer(env, request) {
  const auth = request.headers.get("authorization") || "";
  const expected = env.FEED_INGEST_TOKEN ? `Bearer ${env.FEED_INGEST_TOKEN}` : "";
  return Boolean(expected && auth === expected);
}

export function sessionTokenFromRequest(request) {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${SESSION_COOKIE}=`)) {
      return trimmed.slice(SESSION_COOKIE.length + 1);
    }
  }
  return null;
}

export function sessionCookieHeader(token) {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearSessionCookieHeader() {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

async function pbkdf2(password, saltHex, iterations) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: hexToBytes(saltHex), iterations, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

function randomHex(bytes) {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return bytesToHex(buffer);
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function timingSafeEqualHex(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
