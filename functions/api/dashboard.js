import { isAdmin } from "../_lib/admin-auth.js";
import { ensureCrawlerAccessLogTable } from "../_lib/crawler-log.js";
import { ensureOperationalEventsTable, summarizeOperationalEvents } from "../_lib/operational-log.js";

const DEFAULT_LIMIT = 80;
const MAX_LIMIT = 300;

export async function onRequestGet({ env, request }) {
  if (!isAuthorized(env, request)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || DEFAULT_LIMIT, MAX_LIMIT);
  const since = clean(url.searchParams.get("since")) || hoursAgoIso(24);

  await Promise.all([
    ensureCrawlerAccessLogTable(env),
    ensureOperationalEventsTable(env)
  ]);

  const [
    itemSummary,
    crawlerLogs,
    crawlerTotals,
    operationalEvents,
    operationalTotals,
    ingestFailures,
    ingestSuccesses,
    deployInfo
  ] = await Promise.all([
    readItemSummary(env, request),
    readCrawlerLogs(env, { since, limit }),
    readCrawlerTotals(env, { since }),
    readOperationalEvents(env, { since, limit }),
    readOperationalTotals(env, { since }),
    readIngestFailures(env, { since, limit: 25 }),
    readIngestSuccesses(env, { since, limit: 25 }),
    readDeployInfo(env)
  ]);

  return json({
    type: "atr_bulletin_dashboard",
    generated_at: new Date().toISOString(),
    window: { since },
    status: buildStatus({ itemSummary, crawlerTotals, operationalTotals, ingestFailures }),
    items: itemSummary,
    ingest: {
      ...ingestFailures,
      success_count: ingestSuccesses.success_count,
      successes: ingestSuccesses.successes
    },
    deploy: deployInfo,
    traffic: {
      logs: crawlerLogs,
      summary: summarizeCrawlerLogs(crawlerLogs),
      totals: crawlerTotals
    },
    operations: {
      events: operationalEvents,
      summary: summarizeOperationalEvents(operationalEvents),
      totals: operationalTotals
    }
  });
}

async function readIngestFailures(env, { since, limit }) {
  const result = await env.ATR_FEED_DB.prepare(
    `SELECT id, occurred_at, workflow, action, status, severity, http_status, item_id, source_name, source_url, message, details_json
     FROM operational_events
     WHERE workflow = 'bulletin_ingest'
       AND status IN ('unauthorized', 'error', 'failed')
       AND occurred_at >= ?
     ORDER BY occurred_at DESC, id DESC
     LIMIT ?`
  ).bind(since, limit).all();

  const failures = (result.results || []).map((event) => ({
    occurred_at: event.occurred_at,
    action: event.action,
    status: event.status,
    http_status: event.http_status,
    item_id: event.item_id,
    source_name: event.source_name,
    source_url: event.source_url,
    message: event.message,
    details: parseJson(event.details_json)
  }));

  const posted = await markPostedUrls(env, failures);
  const withPosted = failures.map((failure) => ({
    ...failure,
    posted: failure.source_url ? posted.has(failure.source_url) : null
  }));

  const count = await env.ATR_FEED_DB.prepare(
    `SELECT COUNT(*) AS count
     FROM operational_events
     WHERE workflow = 'bulletin_ingest'
       AND status IN ('unauthorized', 'error', 'failed')
       AND occurred_at >= ?`
  ).bind(since).first();

  return {
    failure_count: count?.count || 0,
    failures: withPosted,
    stranded: withPosted.filter((f) => f.posted === false)
  };
}

async function readIngestSuccesses(env, { since, limit }) {
  const result = await env.ATR_FEED_DB.prepare(
    `SELECT id, occurred_at, workflow, action, status, severity, http_status, item_id, source_name, source_url, message, details_json
     FROM operational_events
     WHERE workflow = 'bulletin_ingest'
       AND status NOT IN ('unauthorized', 'error', 'failed')
       AND occurred_at >= ?
     ORDER BY occurred_at DESC, id DESC
     LIMIT ?`
  ).bind(since, limit).all();

  const successes = (result.results || []).map((event) => ({
    occurred_at: event.occurred_at,
    action: event.action,
    status: event.status,
    http_status: event.http_status,
    item_id: event.item_id,
    source_name: event.source_name,
    source_url: event.source_url,
    message: event.message,
    details: parseJson(event.details_json)
  }));

  const posted = await markPostedUrls(env, successes);
  const withPosted = successes.map((event) => ({
    ...event,
    posted: event.source_url ? posted.has(event.source_url) : null
  }));

  const count = await env.ATR_FEED_DB.prepare(
    `SELECT COUNT(*) AS count
     FROM operational_events
     WHERE workflow = 'bulletin_ingest'
       AND status NOT IN ('unauthorized', 'error', 'failed')
       AND occurred_at >= ?`
  ).bind(since).first();

  return {
    success_count: count?.count || 0,
    successes: withPosted
  };
}

async function markPostedUrls(env, failures) {
  const urls = [...new Set(failures.map((f) => f.source_url).filter(Boolean))].slice(0, 50);
  if (!urls.length) return new Set();
  const placeholders = urls.map(() => "?").join(",");
  const result = await env.ATR_FEED_DB.prepare(
    `SELECT DISTINCT source_url FROM feed_items WHERE source_url IN (${placeholders})`
  ).bind(...urls).all();
  return new Set((result.results || []).map((row) => row.source_url));
}

async function ensureDeployStateTable(env) {
  if (!env?.ATR_FEED_DB) return;
  await env.ATR_FEED_DB.prepare(
    `CREATE TABLE IF NOT EXISTS deploy_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      commit_sha TEXT NOT NULL DEFAULT '',
      branch TEXT NOT NULL DEFAULT '',
      deployment_id TEXT NOT NULL DEFAULT '',
      seen_at TEXT NOT NULL
    )`
  ).run();
}

async function readDeployInfo(env) {
  const sha = env?.CF_PAGES_COMMIT_SHA || null;
  const branch = env?.CF_PAGES_BRANCH || null;
  const deploymentId = env?.CF_PAGES_DEPLOYMENT_ID || null;
  const now = new Date().toISOString();

  if (!env?.ATR_FEED_DB) {
    return { commit_sha: sha, branch, deployment_id: deploymentId, deployed_at: null };
  }

  await ensureDeployStateTable(env);
  const row = await env.ATR_FEED_DB.prepare(
    `SELECT commit_sha, branch, deployment_id, seen_at FROM deploy_state WHERE id = 1`
  ).first();

  if (!row) {
    await env.ATR_FEED_DB.prepare(
      `INSERT INTO deploy_state (id, commit_sha, branch, deployment_id, seen_at) VALUES (1, ?, ?, ?, ?)`
    ).bind(sha || "", branch || "", deploymentId || "", now).run();
    return { commit_sha: sha, branch, deployment_id: deploymentId, deployed_at: now };
  }

  if (row.commit_sha !== (sha || "")) {
    await env.ATR_FEED_DB.prepare(
      `UPDATE deploy_state SET commit_sha = ?, branch = ?, deployment_id = ?, seen_at = ? WHERE id = 1`
    ).bind(sha || "", branch || "", deploymentId || "", now).run();
    return { commit_sha: sha, branch, deployment_id: deploymentId, deployed_at: now };
  }

  return { commit_sha: sha, branch, deployment_id: deploymentId, deployed_at: row.seen_at };
}

async function readItemSummary(env, request) {
  const counts = await env.ATR_FEED_DB.prepare(
    `SELECT status, COUNT(*) AS count
     FROM feed_items
     GROUP BY status`
  ).all();

  const latest = await env.ATR_FEED_DB.prepare(
    `SELECT id, headline, blurb, source_name, source_url, category, published_at, created_at
     FROM feed_items
     WHERE status = ?
     ORDER BY published_at DESC, id DESC
     LIMIT 1`
  ).bind("published").first();

  const latestRemoved = await env.ATR_FEED_DB.prepare(
    `SELECT id, headline, source_name, source_url, updated_at
     FROM feed_items
     WHERE status = ?
     ORDER BY updated_at DESC, id DESC
     LIMIT 1`
  ).bind("removed").first();

  const publicItems = await readPublicItems(request);

  return {
    public_count: publicItems.total,
    d1_counts: Object.fromEntries((counts.results || []).map((row) => [row.status, row.count])),
    latest_published: publicItems.items[0] || latest || null,
    latest_removed: latestRemoved || null
  };
}

async function readPublicItems(request) {
  try {
    const url = new URL("/api/items?limit=500&offset=0", request.url);
    const response = await fetch(url, { headers: { accept: "application/json" } });
    if (!response.ok) return { items: [], total: 0 };
    const payload = await response.json();
    return {
      items: Array.isArray(payload.items) ? payload.items : [],
      total: Number.isFinite(Number(payload.total)) ? Number(payload.total) : (Array.isArray(payload.items) ? payload.items.length : 0)
    };
  } catch {
    return { items: [], total: 0 };
  }
}

async function readCrawlerLogs(env, { since, limit }) {
  const result = await env.ATR_FEED_DB.prepare(
    `SELECT id, requested_at, path, method, status, user_agent, bot_name, country, colo
     FROM crawler_access_logs
     WHERE requested_at >= ?
     ORDER BY requested_at DESC, id DESC
     LIMIT ?`
  ).bind(since, limit).all();

  return result.results || [];
}

async function readCrawlerTotals(env, { since }) {
  const [total, byPath, byBot, errorTotal] = await Promise.all([
    env.ATR_FEED_DB.prepare(
      "SELECT COUNT(*) AS count FROM crawler_access_logs WHERE requested_at >= ?"
    ).bind(since).first(),
    env.ATR_FEED_DB.prepare(
      `SELECT path, COUNT(*) AS count
       FROM crawler_access_logs
       WHERE requested_at >= ?
       GROUP BY path
       ORDER BY count DESC, path ASC`
    ).bind(since).all(),
    env.ATR_FEED_DB.prepare(
      `SELECT COALESCE(bot_name, 'Unclassified') AS bot_name, COUNT(*) AS count
       FROM crawler_access_logs
       WHERE requested_at >= ?
       GROUP BY COALESCE(bot_name, 'Unclassified')
       ORDER BY count DESC, bot_name ASC`
    ).bind(since).all(),
    env.ATR_FEED_DB.prepare(
      `SELECT COUNT(*) AS count
       FROM crawler_access_logs
       WHERE requested_at >= ? AND (status IS NULL OR status >= 400)`
    ).bind(since).first()
  ]);

  return {
    total: total?.count || 0,
    errors: errorTotal?.count || 0,
    byPath: rowsToObject(byPath.results, "path"),
    byBot: rowsToObject(byBot.results, "bot_name")
  };
}

async function readOperationalEvents(env, { since, limit }) {
  const result = await env.ATR_FEED_DB.prepare(
    `SELECT id, occurred_at, workflow, action, status, severity, http_status, item_id, source_name, source_url, message, details_json, user_agent, country, colo
     FROM operational_events
     WHERE occurred_at >= ?
     ORDER BY occurred_at DESC, id DESC
     LIMIT ?`
  ).bind(since, limit).all();

  return (result.results || []).map((event) => ({
    ...event,
    details: parseJson(event.details_json)
  }));
}

async function readOperationalTotals(env, { since }) {
  const [total, errors, byStatus, byWorkflow] = await Promise.all([
    env.ATR_FEED_DB.prepare(
      "SELECT COUNT(*) AS count FROM operational_events WHERE occurred_at >= ?"
    ).bind(since).first(),
    env.ATR_FEED_DB.prepare(
      `SELECT COUNT(*) AS count
       FROM operational_events
       WHERE occurred_at >= ? AND severity IN ('error', 'critical')`
    ).bind(since).first(),
    env.ATR_FEED_DB.prepare(
      `SELECT status, COUNT(*) AS count
       FROM operational_events
       WHERE occurred_at >= ?
       GROUP BY status
       ORDER BY count DESC, status ASC`
    ).bind(since).all(),
    env.ATR_FEED_DB.prepare(
      `SELECT workflow, COUNT(*) AS count
       FROM operational_events
       WHERE occurred_at >= ?
       GROUP BY workflow
       ORDER BY count DESC, workflow ASC`
    ).bind(since).all()
  ]);

  return {
    total: total?.count || 0,
    errors: errors?.count || 0,
    byStatus: rowsToObject(byStatus.results, "status"),
    byWorkflow: rowsToObject(byWorkflow.results, "workflow")
  };
}

function buildStatus({ itemSummary, crawlerTotals, operationalTotals, ingestFailures }) {
  const publishedItems = Number(itemSummary?.public_count || itemSummary?.d1_counts?.published || 0);
  const recentErrors = Number(operationalTotals?.errors || 0) + Number(crawlerTotals?.errors || 0);
  const ingestFailuresCount = Number(ingestFailures?.failure_count || 0);
  const strandedCount = Number(ingestFailures?.stranded?.length || 0);

  return {
    overall: (recentErrors || ingestFailuresCount) ? "attention" : "ok",
    public_items: publishedItems,
    recent_errors: recentErrors,
    ingest_failures: ingestFailuresCount,
    stranded_items: strandedCount,
    api_hits: crawlerTotals?.total || 0,
    latest_item_at: itemSummary?.latest_published?.published_at || null
  };
}

function summarizeCrawlerLogs(logs) {
  const byPath = {};
  const byBot = {};
  const byStatus = {};

  for (const log of logs) {
    byPath[log.path] = (byPath[log.path] || 0) + 1;
    byBot[log.bot_name || "Unclassified"] = (byBot[log.bot_name || "Unclassified"] || 0) + 1;
    byStatus[log.status || "unknown"] = (byStatus[log.status || "unknown"] || 0) + 1;
  }

  return {
    total: logs.length,
    byPath,
    byBot,
    byStatus
  };
}

function rowsToObject(rows = [], key) {
  return Object.fromEntries((rows || []).map((row) => [row[key] || "Unclassified", row.count]));
}

function isAuthorized(env, request) {
  return isAdmin(env, request);
}

function parseJson(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

function hoursAgoIso(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
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
