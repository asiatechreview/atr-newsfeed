// Shared public deep-link key helpers for bulletin items.
// link_key = first 10 hex chars of sha256(source_url).
// Case-insensitive, collision odds ~1 in a trillion, no volume leakage.

export async function ensureLinkKeyColumn(env) {
  if (!env?.ATR_FEED_DB) return;
  try {
    await env.ATR_FEED_DB.prepare("ALTER TABLE feed_items ADD COLUMN link_key TEXT").run();
  } catch {
    // D1 throws once the column already exists.
  }
}

export async function linkKeyFor(url) {
  const value = String(url || "").trim();
  if (!value) return null;
  try {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 10);
  } catch {
    return null;
  }
}
