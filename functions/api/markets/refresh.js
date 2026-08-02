import { refreshMarketSnapshot } from "../../_lib/markets.js";

export async function onRequestPost({ env, request }) {
  if (!isAuthorized(env, request)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const snapshot = await refreshMarketSnapshot(env);

  return json({
    ...snapshot,
    stored: Boolean(env?.ATR_FEED_DB)
  }, snapshot.status === "ok" ? 200 : 503);
}

function isAuthorized(env, request) {
  const auth = request.headers.get("authorization") || "";
  const expected = env.FEED_INGEST_TOKEN ? `Bearer ${env.FEED_INGEST_TOKEN}` : "";

  return Boolean(expected && auth === expected);
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
