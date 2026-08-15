import { ensureSiteContentTable, readSiteContent, writeSiteContent } from "./_lib/site-content.js";
import { ensureOperationalEventsTable, writeOperationalEvent } from "./_lib/operational-log.js";
import { refreshNewsletterCardFromFeed } from "./_lib/newsletter-refresh.js";

const PUBLIC_BASE = "https://bulletin.asiatechreview.com";
const DEV_BASE = "https://atr-newsfeed.pages.dev";

// Cron triggers are declared in wrangler.toml under [triggers]. Keep these
// strings in sync with that file, because onScheduled dispatches on them.
export const CRONS = {
  NEWSLETTER_REFRESH: "0 1 * * *",
  INGEST_RECONCILE: "*/30 * * * *",
  HEALTH_CHECK: "*/10 * * * *",
  PUBLISH_SCHEDULED: "* * * * *"
};

// Admin bundle sentinel: the health cron verifies the deployed admin.js still
// contains a known recent function so a stale/missing deploy is caught. Bump
// this when the admin UI's function set changes.
const ADMIN_SENTINEL = "openLiveEditor";

const RECONCILE_WINDOW_HOURS = 48;
const RECONCILE_MAX_ATTEMPTS = 3;
const ALERT_COOLDOWN_MINUTES = 30;

export async function onScheduled({ env, cron }) {
  if (cron === CRONS.NEWSLETTER_REFRESH) {
    return refreshNewsletterCard(env);
  }
  if (cron === CRONS.INGEST_RECONCILE) {
    return reconcileFailedIngests(env);
  }
  if (cron === CRONS.PUBLISH_SCHEDULED) {
    return publishScheduledItems(env);
  }
  if (cron === CRONS.HEALTH_CHECK) {
    // Piggyback: publish any due drafts alongside the health pass so
    // scheduled publishing works even before the minute cron is registered
    // in the Pages dashboard (Settings -> Functions -> Cron Triggers).
    await publishScheduledItems(env);
    return runHealthChecks(env);
  }
  return null;
}

// ---------------------------------------------------------------------------
// 1. Newsletter card auto-refresh
// ---------------------------------------------------------------------------

async function refreshNewsletterCard(env) {
  try {
    await refreshNewsletterCardFromFeed(env);
  } catch (error) {
    await writeOperationalEvent(env, null, {
      workflow: "site_content",
      action: "newsletter_auto_refresh",
      status: "error",
      severity: "error",
      message: "Newsletter auto-refresh failed.",
      details: { error: error.message }
    });
  }
}

// ---------------------------------------------------------------------------
// 2. Scheduled draft publishing
// ---------------------------------------------------------------------------

async function publishScheduledItems(env) {
  try {
    await ensureScheduledAtColumn(env);
    const now = new Date().toISOString();
    const result = await env.ATR_FEED_DB.prepare(
      `UPDATE feed_items
       SET status = 'published', scheduled_at = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE status = 'draft' AND scheduled_at IS NOT NULL AND scheduled_at <= ?
       RETURNING id, headline`
    ).bind(now).all();
    const published = result.results || [];
    if (published.length) {
      await writeOperationalEvent(env, null, {
        workflow: "bulletin_schedule",
        action: "publish_due",
        status: "success",
        severity: "info",
        message: `Published ${published.length} scheduled item(s).`,
        details: { ids: published.map((item) => item.id) }
      });
    }
  } catch (error) {
    await writeOperationalEvent(env, null, {
      workflow: "bulletin_schedule",
      action: "publish_due",
      status: "error",
      severity: "error",
      message: "Scheduled publishing failed.",
      details: { error: error.message }
    });
  }
}

async function ensureScheduledAtColumn(env) {
  try {
    await env.ATR_FEED_DB.prepare("ALTER TABLE feed_items ADD COLUMN scheduled_at TEXT").run();
  } catch {
    // D1 throws once the column already exists.
  }
}

// ---------------------------------------------------------------------------
// 3. Ingest retry and reconciliation
// ---------------------------------------------------------------------------

async function reconcileFailedIngests(env) {
  try {
    await ensureOperationalEventsTable(env);
    await ensureCronStateTable(env);

    const since = new Date(Date.now() - RECONCILE_WINDOW_HOURS * 3600 * 1000).toISOString();
    const rows = await env.ATR_FEED_DB.prepare(
      `SELECT id, source_url, details_json, occurred_at FROM operational_events
       WHERE workflow = 'bulletin_ingest' AND action = 'create_item' AND status = 'error'
         AND occurred_at >= ?
       ORDER BY occurred_at DESC
       LIMIT 25`
    ).bind(since).all();

    const bySource = new Map();
    for (const row of rows.results || []) {
      if (!row.source_url) continue;
      if (!bySource.has(row.source_url)) bySource.set(row.source_url, row);
    }

    let replayed = 0;
    for (const [sourceUrl, event] of bySource) {
      const state = await readCronState(env, `reconcile:${sourceUrl}`);
      const attempts = Number(state?.attempts || 0);
      if (attempts >= RECONCILE_MAX_ATTEMPTS) continue;

      const existing = await env.ATR_FEED_DB.prepare(
        "SELECT id FROM feed_items WHERE lower(source_url) = lower(?) AND status = 'published' LIMIT 1"
      ).bind(sourceUrl).first();
      if (existing) {
        await writeCronState(env, `reconcile:${sourceUrl}`, { attempts, status: "done", lastError: null });
        continue;
      }

      const details = parseJson(event.details_json);
      const payload = details?.payload;
      if (!payload || !payload.sourceUrl) continue;

      const result = await replayIngest(env, payload);
      if (result.ok) {
        await writeCronState(env, `reconcile:${sourceUrl}`, { attempts: attempts + 1, status: "done", lastError: null });
        await writeOperationalEvent(env, null, {
          workflow: "bulletin_reconcile",
          action: "replay_ingest",
          status: "success",
          severity: "info",
          http_status: result.status,
          source_url: sourceUrl,
          message: "Reconciled failed ingest: item created.",
          details: { headline: payload.headline }
        });
        replayed += 1;
      } else if (result.permanent) {
        await writeCronState(env, `reconcile:${sourceUrl}`, { attempts: RECONCILE_MAX_ATTEMPTS, status: "failed", lastError: result.error });
      } else {
        await writeCronState(env, `reconcile:${sourceUrl}`, { attempts: attempts + 1, status: "pending", lastError: result.error });
      }
    }

    if (replayed > 0) {
      await writeOperationalEvent(env, null, {
        workflow: "bulletin_reconcile",
        action: "reconcile_pass",
        status: "success",
        severity: "info",
        message: `Ingest reconciliation replayed ${replayed} failed item(s).`
      });
    }
  } catch (error) {
    await writeOperationalEvent(env, null, {
      workflow: "bulletin_reconcile",
      action: "reconcile_pass",
      status: "error",
      severity: "error",
      message: "Ingest reconciliation pass failed.",
      details: { error: error.message }
    });
  }
}

async function replayIngest(env, payload) {
  const token = env.FEED_INGEST_TOKEN;
  if (!token) return { ok: false, permanent: false, error: "FEED_INGEST_TOKEN binding missing" };

  try {
    const response = await fetch(`${PUBLIC_BASE}/api/items`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        accept: "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (response.status === 200 || response.status === 201) {
      return { ok: true, status: response.status };
    }
    if (response.status === 400) {
      return { ok: false, permanent: true, error: `HTTP ${response.status}` };
    }
    return { ok: false, permanent: false, error: `HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, permanent: false, error: error.message };
  }
}

// ---------------------------------------------------------------------------
// 3. Health + deploy verification
// ---------------------------------------------------------------------------

async function runHealthChecks(env) {
  try {
    await ensureOperationalEventsTable(env);
    await ensureCronStateTable(env);

    const checks = [
      { name: "api-health", url: `${PUBLIC_BASE}/api/health`, type: "json-ok" },
      { name: "feed-json", url: `${PUBLIC_BASE}/feed.json`, type: "json-items" },
      { name: "rss", url: `${PUBLIC_BASE}/rss.xml`, type: "text-item" },
      { name: "homepage", url: `${PUBLIC_BASE}/`, type: "text-newsletter" },
      { name: "admin-bundle", url: `${DEV_BASE}/admin.js`, type: "text-admin-sentinel" }
    ];

    let failures = 0;
    for (const check of checks) {
      const result = await runSingleCheck(check);
      const previous = await readCronState(env, `health:${check.name}`);
      const previousStatus = previous?.status || "ok";
      const lastAlertAt = previous?.lastAlertAt ? new Date(previous.lastAlertAt).getTime() : 0;

      if (result.ok) {
        if (previousStatus === "error") {
          await writeOperationalEvent(env, null, {
            workflow: "health_check",
            action: check.name,
            status: "success",
            severity: "info",
            http_status: result.status,
            message: `Health check recovered: ${check.name}.`
          });
        }
        await writeCronState(env, `health:${check.name}`, { status: "ok", lastAlertAt: previous.lastAlertAt || null });
        continue;
      }

      failures += 1;
      await writeOperationalEvent(env, null, {
        workflow: "health_check",
        action: check.name,
        status: "error",
        severity: "error",
        http_status: result.status,
        message: `Health check failed: ${check.name} - ${result.error}`
      });

      const cooldownOk = Date.now() - lastAlertAt > ALERT_COOLDOWN_MINUTES * 60 * 1000;
      if (previousStatus !== "error" || cooldownOk) {
        const alerted = await sendTelegramAlert(env, `⚠️ ATR bulletin health check failed: ${check.name}\n${result.error}\n${check.url}`);
        await writeCronState(env, `health:${check.name}`, {
          status: "error",
          lastAlertAt: alerted ? new Date().toISOString() : (previous?.lastAlertAt || null)
        });
      } else {
        await writeCronState(env, `health:${check.name}`, { status: "error", lastAlertAt: previous.lastAlertAt || null });
      }
    }

    if (failures > 0) {
      await writeOperationalEvent(env, null, {
        workflow: "health_check",
        action: "health_pass",
        status: "error",
        severity: "error",
        message: `Health pass: ${failures} check(s) failed.`
      });
    }
  } catch (error) {
    await writeOperationalEvent(env, null, {
      workflow: "health_check",
      action: "health_pass",
      status: "error",
      severity: "error",
      message: "Health pass crashed.",
      details: { error: error.message }
    });
  }
}

async function runSingleCheck(check) {
  try {
    const response = await fetch(check.url, {
      headers: { accept: "application/json, application/xml, text/html, */*" }
    });
    const status = response.status;

    if (check.type === "json-ok") {
      const payload = await response.json().catch(() => null);
      if (status !== 200 || payload?.ok !== true) {
        return { ok: false, status, error: `expected ok:true, got HTTP ${status}` };
      }
      return { ok: true, status };
    }

    const text = await response.text();

    if (check.type === "json-items") {
      const payload = JSON.parse(text);
      if (status !== 200 || !Array.isArray(payload.items) || payload.items.length === 0) {
        return { ok: false, status, error: "feed.json empty or missing items" };
      }
      return { ok: true, status };
    }

    if (check.type === "text-item") {
      if (status !== 200 || !text.includes("<item>")) {
        return { ok: false, status, error: "rss.xml missing <item> entries" };
      }
      return { ok: true, status };
    }

    if (check.type === "text-newsletter") {
      if (status !== 200 || !text.includes('id="newsletter-title"')) {
        return { ok: false, status, error: "homepage missing newsletter card" };
      }
      return { ok: true, status };
    }

    if (check.type === "text-admin-sentinel") {
      if (status !== 200 || !text.includes(ADMIN_SENTINEL)) {
        return { ok: false, status, error: `admin.js missing sentinel ${ADMIN_SENTINEL}` };
      }
      return { ok: true, status };
    }

    return { ok: true, status };
  } catch (error) {
    return { ok: false, status: null, error: error.message };
  }
}

async function sendTelegramAlert(env, text) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_ALERT_CHAT_ID;
  if (!token || !chatId) return false;

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true
      })
    });
    return response.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Cron state (small key/value store for reconcile attempts and alert cooldowns)
// ---------------------------------------------------------------------------

async function ensureCronStateTable(env) {
  if (!env?.ATR_FEED_DB) return;
  await env.ATR_FEED_DB.prepare(
    `CREATE TABLE IF NOT EXISTS cron_state (
      state_key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    )`
  ).run();
}

async function readCronState(env, key) {
  if (!env?.ATR_FEED_DB) return null;
  const row = await env.ATR_FEED_DB.prepare("SELECT value_json FROM cron_state WHERE state_key = ?").bind(key).first();
  return row ? parseJson(row.value_json) : null;
}

async function writeCronState(env, key, value) {
  if (!env?.ATR_FEED_DB) return;
  await env.ATR_FEED_DB.prepare(
    `INSERT INTO cron_state (state_key, value_json, updated_at)
     VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
     ON CONFLICT(state_key) DO UPDATE SET
       value_json = excluded.value_json,
       updated_at = excluded.updated_at`
  ).bind(key, JSON.stringify(value || {})).run();
}

function parseJson(value) {
  try {
    return JSON.parse(value || "");
  } catch {
    return null;
  }
}
