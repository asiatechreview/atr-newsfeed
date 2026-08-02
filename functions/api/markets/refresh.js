import { refreshMarketSnapshot } from "../../_lib/markets.js";
import { writeOperationalEvent } from "../../_lib/operational-log.js";

export async function onRequestPost({ env, request }) {
  if (!isAuthorized(env, request)) {
    await writeOperationalEvent(env, request, {
      workflow: "markets",
      action: "refresh_snapshot",
      status: "unauthorized",
      severity: "warning",
      http_status: 401,
      message: "Unauthorized market snapshot refresh attempt."
    });
    return json({ error: "Unauthorized" }, 401);
  }

  let snapshot;
  try {
    snapshot = await refreshMarketSnapshot(env);
  } catch (error) {
    await writeOperationalEvent(env, request, {
      workflow: "markets",
      action: "refresh_snapshot",
      status: "error",
      severity: "error",
      http_status: 500,
      message: "Market snapshot refresh failed.",
      details: { error: error.message }
    });
    return json({ error: "market refresh failed" }, 500);
  }

  const status = snapshot.status === "ok" ? 200 : 503;
  await writeOperationalEvent(env, request, {
    workflow: "markets",
    action: "refresh_snapshot",
    status: snapshot.status === "ok" ? "success" : "error",
    severity: snapshot.status === "ok" ? "info" : "error",
    http_status: status,
    message: snapshot.status === "ok" ? "Market snapshot refreshed." : "Market snapshot unavailable.",
    details: {
      source: snapshot.source,
      cadence: snapshot.cadence,
      market_count: Array.isArray(snapshot.markets) ? snapshot.markets.length : 0
    }
  });

  return json({
    ...snapshot,
    stored: Boolean(env?.ATR_FEED_DB)
  }, status);
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
