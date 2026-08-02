import {
  DEFAULT_MARKETS,
  MARKET_CADENCE,
  MARKET_SOURCE,
  fetchYahooMarketSnapshot,
  newestMarketTimestamp,
  normalizeMarkets,
  parseSnapshot,
  readLatestMarketSnapshot
} from "../_lib/markets.js";

export async function onRequestGet({ env }) {
  const configuredSnapshot = parseSnapshot(env?.MARKET_SNAPSHOT_JSON);

  if (configuredSnapshot) {
    return json({
      type: "market_snapshot",
      status: "ok",
      cadence: configuredSnapshot.cadence || MARKET_CADENCE,
      source: configuredSnapshot.source || "Configured snapshot",
      updated_at: configuredSnapshot.updated_at || new Date().toISOString(),
      markets: normalizeMarkets(configuredSnapshot.markets)
    }, 200, "public, max-age=900");
  }

  const cachedSnapshot = await readLatestMarketSnapshot(env);

  if (cachedSnapshot) {
    return json({
      ...cachedSnapshot,
      status: "ok",
      markets: normalizeMarkets(cachedSnapshot.markets || [])
    }, 200, "public, max-age=900, stale-while-revalidate=3600");
  }

  const markets = await fetchYahooMarketSnapshot(DEFAULT_MARKETS);

  if (!markets.length) {
    return json({
      type: "market_snapshot",
      status: "unavailable",
      updated_at: null,
      source: MARKET_SOURCE,
      cadence: MARKET_CADENCE,
      markets: [],
      expected_markets: DEFAULT_MARKETS,
      message: "Market snapshot unavailable."
    }, 503, "public, max-age=300");
  }

  return json({
    type: "market_snapshot",
    status: "ok",
    cadence: MARKET_CADENCE,
    source: MARKET_SOURCE,
    updated_at: newestMarketTimestamp(markets) || new Date().toISOString(),
    refreshed_at: new Date().toISOString(),
    markets
  }, 200, "public, max-age=1800, stale-while-revalidate=3600");
}

function json(payload, status = 200, cacheControl = "no-store") {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cacheControl
    }
  });
}
