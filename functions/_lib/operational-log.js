export async function ensureOperationalEventsTable(env) {
  if (!env?.ATR_FEED_DB) return;

  await env.ATR_FEED_DB.prepare(
    `CREATE TABLE IF NOT EXISTS operational_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      workflow TEXT NOT NULL,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      http_status INTEGER,
      item_id TEXT,
      source_name TEXT,
      source_url TEXT,
      message TEXT NOT NULL DEFAULT '',
      details_json TEXT NOT NULL DEFAULT '{}',
      user_agent TEXT NOT NULL DEFAULT '',
      country TEXT,
      colo TEXT
    )`
  ).run();

  await env.ATR_FEED_DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_operational_events_occurred_at ON operational_events (occurred_at DESC)"
  ).run();

  await env.ATR_FEED_DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_operational_events_status ON operational_events (status, occurred_at DESC)"
  ).run();

  await env.ATR_FEED_DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_operational_events_workflow ON operational_events (workflow, occurred_at DESC)"
  ).run();
}

export async function writeOperationalEvent(env, request, event = {}) {
  if (!env?.ATR_FEED_DB) return;

  try {
    await ensureOperationalEventsTable(env);
    const cf = request?.cf || {};
    await env.ATR_FEED_DB.prepare(
      `INSERT INTO operational_events
        (workflow, action, status, severity, http_status, item_id, source_name, source_url, message, details_json, user_agent, country, colo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        clean(event.workflow) || "bulletin",
        clean(event.action) || "unknown",
        normalizeStatus(event.status),
        normalizeSeverity(event.severity, event.status),
        integerOrNull(event.http_status),
        clean(event.item_id) || null,
        clean(event.source_name) || null,
        clean(event.source_url) || null,
        clean(event.message).slice(0, 800),
        safeDetails(event.details),
        (request?.headers?.get("user-agent") || "").slice(0, 500),
        typeof cf.country === "string" ? cf.country : null,
        typeof cf.colo === "string" ? cf.colo : null
      )
      .run();
  } catch {
    // Operational logging must never block publishing or public reads.
  }
}

export function summarizeOperationalEvents(events = []) {
  const byStatus = {};
  const byWorkflow = {};
  const bySeverity = {};

  for (const event of events) {
    byStatus[event.status] = (byStatus[event.status] || 0) + 1;
    byWorkflow[event.workflow] = (byWorkflow[event.workflow] || 0) + 1;
    bySeverity[event.severity] = (bySeverity[event.severity] || 0) + 1;
  }

  return {
    total: events.length,
    byStatus,
    byWorkflow,
    bySeverity
  };
}

function normalizeStatus(value) {
  const status = clean(value).toLowerCase();
  if (["ok", "success", "duplicate", "warning", "error", "failed", "unauthorized"].includes(status)) {
    return status;
  }
  return status || "info";
}

function normalizeSeverity(severity, status) {
  const value = clean(severity).toLowerCase();
  if (["info", "warning", "error", "critical"].includes(value)) {
    return value;
  }

  const normalizedStatus = normalizeStatus(status);
  if (["error", "failed", "unauthorized"].includes(normalizedStatus)) return "error";
  if (normalizedStatus === "warning") return "warning";
  return "info";
}

function safeDetails(details) {
  try {
    return JSON.stringify(details || {}).slice(0, 4000);
  } catch {
    return "{}";
  }
}

function integerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function clean(value) {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}
