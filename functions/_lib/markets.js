export const DEFAULT_MARKETS = [
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

export const MARKET_CADENCE = "open_midday_close";
export const MARKET_SOURCE = "Yahoo Finance chart";

export async function fetchYahooMarketSnapshot(indexes = DEFAULT_MARKETS) {
  const results = await Promise.allSettled(indexes.map(fetchYahooIndex));

  return results
    .filter((result) => result.status === "fulfilled" && result.value)
    .map((result) => result.value);
}

export async function fetchYahooIndex(index) {
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

export async function ensureMarketSnapshotTable(env) {
  if (!env?.ATR_FEED_DB) return;

  await env.ATR_FEED_DB.prepare(
    `CREATE TABLE IF NOT EXISTS market_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fetched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      source TEXT NOT NULL,
      cadence TEXT NOT NULL,
      status TEXT NOT NULL,
      market_count INTEGER NOT NULL DEFAULT 0,
      snapshot_json TEXT NOT NULL
    )`
  ).run();

  await env.ATR_FEED_DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_market_snapshots_fetched_at ON market_snapshots (fetched_at DESC)"
  ).run();
}

export async function readLatestMarketSnapshot(env) {
  if (!env?.ATR_FEED_DB) return null;

  await ensureMarketSnapshotTable(env);

  const row = await env.ATR_FEED_DB.prepare(
    `SELECT id, fetched_at, source, cadence, status, market_count, snapshot_json
     FROM market_snapshots
     WHERE status = ?
     ORDER BY fetched_at DESC, id DESC
     LIMIT 1`
  )
    .bind("ok")
    .first();

  if (!row?.snapshot_json) {
    return null;
  }

  try {
    const snapshot = JSON.parse(row.snapshot_json);
    return {
      ...snapshot,
      id: row.id,
      updated_at: snapshot.updated_at || row.fetched_at,
      source: snapshot.source || row.source,
      cadence: snapshot.cadence || row.cadence
    };
  } catch {
    return null;
  }
}

export async function refreshMarketSnapshot(env) {
  const markets = await fetchYahooMarketSnapshot(DEFAULT_MARKETS);

  if (!markets.length) {
    const failedSnapshot = {
      type: "market_snapshot",
      status: "unavailable",
      source: MARKET_SOURCE,
      cadence: MARKET_CADENCE,
      updated_at: new Date().toISOString(),
      markets: [],
      expected_markets: DEFAULT_MARKETS,
      message: "Market snapshot unavailable."
    };

    await writeMarketSnapshot(env, failedSnapshot);
    return failedSnapshot;
  }

  const snapshot = {
    type: "market_snapshot",
    status: "ok",
    cadence: MARKET_CADENCE,
    source: MARKET_SOURCE,
    updated_at: newestMarketTimestamp(markets) || new Date().toISOString(),
    refreshed_at: new Date().toISOString(),
    markets
  };

  await writeMarketSnapshot(env, snapshot);
  return snapshot;
}

export async function writeMarketSnapshot(env, snapshot) {
  if (!env?.ATR_FEED_DB) return;

  await ensureMarketSnapshotTable(env);
  await env.ATR_FEED_DB.prepare(
    `INSERT INTO market_snapshots
      (source, cadence, status, market_count, snapshot_json)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(
      snapshot.source || MARKET_SOURCE,
      snapshot.cadence || MARKET_CADENCE,
      snapshot.status || "ok",
      Array.isArray(snapshot.markets) ? snapshot.markets.length : 0,
      JSON.stringify(snapshot)
    )
    .run();
}

export function normalizeMarkets(markets) {
  return markets
    .map((market) => ({
      symbol: clean(market.symbol),
      name: clean(market.name),
      value: toFiniteNumber(market.value),
      previous_close: toFiniteNumber(market.previous_close),
      change_percent: toFiniteNumber(market.change_percent),
      as_of: clean(market.as_of) || null
    }))
    .filter((market) => market.name && Number.isFinite(market.change_percent))
    .slice(0, 14);
}

export function parseSnapshot(value) {
  if (!value) {
    return null;
  }

  try {
    const payload = JSON.parse(value);
    if (!Array.isArray(payload.markets)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function newestMarketTimestamp(markets) {
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
