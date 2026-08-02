const DEFAULT_MARKETS = [
  { symbol: "N225", name: "Nikkei 225" },
  { symbol: "KS11", name: "KOSPI" },
  { symbol: "HSI", name: "Hang Seng" },
  { symbol: "SSEC", name: "Shanghai Composite" },
  { symbol: "TWII", name: "Taiwan Weighted" },
  { symbol: "STI", name: "Straits Times" },
  { symbol: "SET", name: "SET Index" },
  { symbol: "JKSE", name: "Jakarta Composite" },
  { symbol: "KLSE", name: "KLCI" },
  { symbol: "BSESN", name: "Sensex" },
  { symbol: "NSEI", name: "Nifty 50" },
  { symbol: "AXJO", name: "ASX 200" }
];

export async function onRequestGet({ env }) {
  const configuredSnapshot = parseSnapshot(env?.MARKET_SNAPSHOT_JSON);

  if (!configuredSnapshot) {
    return json({
      type: "market_snapshot",
      status: "not_configured",
      updated_at: null,
      source: null,
      cadence: "daily",
      markets: [],
      expected_markets: DEFAULT_MARKETS,
      message: "Market data source pending."
    }, 503, "public, max-age=300");
  }

  return json({
    type: "market_snapshot",
    status: "ok",
    cadence: configuredSnapshot.cadence || "daily",
    source: configuredSnapshot.source || "Configured snapshot",
    updated_at: configuredSnapshot.updated_at || new Date().toISOString(),
    markets: normalizeMarkets(configuredSnapshot.markets)
  }, 200, "public, max-age=900");
}

function parseSnapshot(value) {
  if (!value) {
    return null;
  }

  try {
    const payload = JSON.parse(value);
    if (!Array.isArray(payload.markets)) {
      return null;
    }
    return payload;
  } catch (error) {
    return null;
  }
}

function normalizeMarkets(markets) {
  return markets
    .map((market) => ({
      symbol: clean(market.symbol),
      name: clean(market.name),
      value: toFiniteNumber(market.value),
      change_percent: toFiniteNumber(market.change_percent)
    }))
    .filter((market) => market.name && Number.isFinite(market.change_percent))
    .slice(0, 12);
}

function clean(value) {
  return String(value || "").trim();
}

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
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
