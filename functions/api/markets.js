const DEFAULT_MARKETS = [
  { symbol: "^N225", name: "Nikkei 225" },
  { symbol: "^KS11", name: "KOSPI" },
  { symbol: "^HSI", name: "Hang Seng" },
  { symbol: "000001.SS", name: "Shanghai Composite" },
  { symbol: "399001.SZ", name: "Shenzhen Component" },
  { symbol: "^TWII", name: "Taiwan Weighted" },
  { symbol: "^STI", name: "Straits Times" },
  { symbol: "^SET.BK", name: "SET Index" },
  { symbol: "^JKSE", name: "Jakarta Composite" },
  { symbol: "^KLSE", name: "KLCI" },
  { symbol: "^BSESN", name: "Sensex" },
  { symbol: "^NSEI", name: "Nifty 50" },
  { symbol: "^AXJO", name: "ASX 200" }
];

export async function onRequestGet({ env }) {
  const configuredSnapshot = parseSnapshot(env?.MARKET_SNAPSHOT_JSON);

  if (configuredSnapshot) {
    return json({
      type: "market_snapshot",
      status: "ok",
      cadence: configuredSnapshot.cadence || "daily",
      source: configuredSnapshot.source || "Configured snapshot",
      updated_at: configuredSnapshot.updated_at || new Date().toISOString(),
      markets: normalizeMarkets(configuredSnapshot.markets)
    }, 200, "public, max-age=900");
  }

  const markets = await fetchYahooMarketSnapshot(DEFAULT_MARKETS);

  if (!markets.length) {
    return json({
      type: "market_snapshot",
      status: "unavailable",
      updated_at: null,
      source: "Yahoo Finance chart",
      cadence: "daily",
      markets: [],
      expected_markets: DEFAULT_MARKETS,
      message: "Market snapshot unavailable."
    }, 503, "public, max-age=300");
  }

  return json({
    type: "market_snapshot",
    status: "ok",
    cadence: "daily",
    source: "Yahoo Finance chart",
    updated_at: newestMarketTimestamp(markets) || new Date().toISOString(),
    markets
  }, 200, "public, max-age=1800, stale-while-revalidate=3600");
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
    .slice(0, 14);
}

async function fetchYahooMarketSnapshot(indexes) {
  const results = await Promise.allSettled(indexes.map(fetchYahooIndex));

  return results
    .filter((result) => result.status === "fulfilled" && result.value)
    .map((result) => result.value);
}

async function fetchYahooIndex(index) {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(index.symbol)}?interval=1d&range=5d`;
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "ATRMarketSnapshot/1.0"
    }
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  const result = payload?.chart?.result?.[0];
  const meta = result?.meta;
  const price = toFiniteNumber(meta?.regularMarketPrice);
  const previousClose = toFiniteNumber(meta?.chartPreviousClose);

  if (!Number.isFinite(price) || !Number.isFinite(previousClose) || previousClose === 0) {
    return null;
  }

  const changePercent = ((price - previousClose) / previousClose) * 100;
  const marketTime = toFiniteNumber(meta?.regularMarketTime);

  return {
    symbol: index.symbol,
    name: index.name,
    value: price,
    previous_close: previousClose,
    change_percent: changePercent,
    as_of: marketTime ? new Date(marketTime * 1000).toISOString() : null
  };
}

function newestMarketTimestamp(markets) {
  const timestamps = markets
    .map((market) => Date.parse(market.as_of))
    .filter((value) => Number.isFinite(value));

  if (!timestamps.length) {
    return null;
  }

  return new Date(Math.max(...timestamps)).toISOString();
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
