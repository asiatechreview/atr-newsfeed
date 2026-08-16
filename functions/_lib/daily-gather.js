// ATR Daily Gather — ported from scripts/atr-daily-doc-export.py to run
// inside the atr-newsfeed Pages functions (manual /gather via the Rapid
// Transit webhook) and a standalone cron Worker (scheduled runs, off by
// default).
//
// Behaviour mirrors the skill (daily-gather/SKILL.md):
//   - Source: bulletin public API only
//   - Group by IST date, ordinal tab names ("August 3rd, 2026")
//   - Merge-only same-date re-runs (add missing source URLs, never rewrite)
//   - Checkpoint in D1 (no stories missed between runs)
//   - Monthly doc rotation: new "DNG <Month>, <YYYY>" doc at month start,
//     shared with sai@asiatechreview.com (editor), link posted to the group
//     once
//   - Validation read-back after each write
//
// Google auth: OAuth refresh-token exchange (no SDK, plain fetch).

const API_URL = "https://bulletin.asiatechreview.com/api/v1/items?limit=1000";
const USER_AGENT = "ATRBot-DailyGather/1.0";
const FONT_FAMILY = "Arial";
const FONT_SIZE_PT = 10.5;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30
const GATHER_STATE_KEY = "daily_gather";
const SCHEDULE_KEY = "gather_schedule";

// Default doc used on first run / cleared state. Sai confirmed (Aug 16 2026)
// the gather should stay on the doc it created for the month, not revert to
// the older DNG August doc, to avoid confusion.
export const DEFAULT_DOC_ID = "1COqiUNh442OpaTokqswveXd-cng1O3S2Iexye3eR26Q";

// ---------------------------------------------------------------------------
// Dates (IST)
// ---------------------------------------------------------------------------

export function istNow() {
  return new Date(Date.now() + IST_OFFSET_MS);
}

export function istDateKey(date = new Date()) {
  const d = new Date(date.getTime() + IST_OFFSET_MS);
  return d.toISOString().slice(0, 10);
}

export function istDayOfMonth(date = new Date()) {
  const d = new Date(date.getTime() + IST_OFFSET_MS);
  return d.getUTCDate();
}

export function ordinal(day) {
  if (10 <= day % 100 && day % 100 <= 20) return `${day}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[day % 10] || "th";
  return `${day}${suffix}`;
}

export function tabTitleFor(dayKey) {
  const d = new Date(`${dayKey}T00:00:00Z`);
  const month = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(d);
  return `${month} ${ordinal(d.getUTCDate())}, ${d.getUTCFullYear()}`;
}

export function previousIstDayKey() {
  const now = Date.now() + IST_OFFSET_MS;
  return new Date(now - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Google auth (refresh token exchange)
// ---------------------------------------------------------------------------

async function googleAccessToken(env) {
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  const refreshToken = env.GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google OAuth env vars missing (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN)");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token"
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
  if (!response.ok) {
    throw new Error(`Google token exchange failed: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
  }
  const payload = await response.json();
  if (!payload.access_token) {
    throw new Error("Google token exchange returned no access_token");
  }
  return payload.access_token;
}

async function docsGet(accessToken, documentId) {
  const response = await fetch(
    `https://docs.googleapis.com/v1/documents/${documentId}?includeTabsContent=true`,
    { headers: { authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) {
    throw new Error(`Google Docs get failed: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
  }
  return response.json();
}

async function docsBatchUpdate(accessToken, documentId, requests) {
  for (let i = 0; i < requests.length; i += 450) {
    const chunk = requests.slice(i, i + 450);
    const response = await fetch(
      `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
      {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ requests: chunk })
      }
    );
    if (!response.ok) {
      throw new Error(`Google Docs batchUpdate failed: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// State (D1)
// ---------------------------------------------------------------------------

async function ensureGatherTables(env) {
  if (!env?.ATR_FEED_DB) return;
  await env.ATR_FEED_DB.prepare(
    `CREATE TABLE IF NOT EXISTS rapid_transit_gather (
      state_key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    )`
  ).run();
}

async function readGatherState(env) {
  if (!env?.ATR_FEED_DB) return {};
  await ensureGatherTables(env);
  const row = await env.ATR_FEED_DB.prepare(
    "SELECT value_json FROM rapid_transit_gather WHERE state_key = ?"
  ).bind(GATHER_STATE_KEY).first();
  if (!row?.value_json) return {};
  try {
    const parsed = JSON.parse(row.value_json);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeGatherState(env, state) {
  if (!env?.ATR_FEED_DB) return;
  await ensureGatherTables(env);
  await env.ATR_FEED_DB.prepare(
    `INSERT INTO rapid_transit_gather (state_key, value_json, updated_at)
     VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
     ON CONFLICT(state_key) DO UPDATE SET value_json = excluded.value_json, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`
  ).bind(GATHER_STATE_KEY, JSON.stringify(state)).run();
}

export async function readSchedule(env) {
  if (!env?.ATR_FEED_DB) return null;
  await ensureGatherTables(env);
  const row = await env.ATR_FEED_DB.prepare(
    "SELECT value_json FROM rapid_transit_gather WHERE state_key = ?"
  ).bind(SCHEDULE_KEY).first();
  if (!row?.value_json) return null;
  try {
    return JSON.parse(row.value_json);
  } catch {
    return null;
  }
}

export async function writeSchedule(env, schedule) {
  if (!env?.ATR_FEED_DB) return;
  await ensureGatherTables(env);
  await env.ATR_FEED_DB.prepare(
    `INSERT INTO rapid_transit_gather (state_key, value_json, updated_at)
     VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
     ON CONFLICT(state_key) DO UPDATE SET value_json = excluded.value_json, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`
  ).bind(SCHEDULE_KEY, JSON.stringify(schedule)).run();
}

export async function clearSchedule(env) {
  if (!env?.ATR_FEED_DB) return;
  await ensureGatherTables(env);
  await env.ATR_FEED_DB.prepare(
    "DELETE FROM rapid_transit_gather WHERE state_key = ?"
  ).bind(SCHEDULE_KEY).run();
}

// ---------------------------------------------------------------------------
// Bulletin API
// ---------------------------------------------------------------------------

async function fetchApiItems() {
  const response = await fetch(API_URL, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) {
    throw new Error(`Bulletin API returned HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (!Array.isArray(payload.items)) {
    throw new Error("Bulletin API response did not contain an items list");
  }
  return payload.items;
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function parseItems(rawItems) {
  const parsed = [];
  const seenUrls = new Set();
  for (const raw of rawItems) {
    const publishedValue = raw.published_at || raw.date_published;
    if (!publishedValue) continue;
    const publishedAt = new Date(String(publishedValue).replace("Z", "+00:00"));
    if (Number.isNaN(publishedAt.getTime())) continue;

    const blurb = cleanText(raw.blurb);
    const sourceName = cleanText(raw.source_name || raw.source?.name);
    const sourceUrl = cleanText(raw.source_url || raw.url);
    if (!blurb || !sourceName || !sourceUrl) continue;
    if (seenUrls.has(sourceUrl)) continue;
    seenUrls.add(sourceUrl);

    parsed.push({
      raw_id: String(raw.raw_id ?? raw.id ?? ""),
      blurb,
      source_name: sourceName,
      source_url: sourceUrl,
      published_at: publishedAt
    });
  }
  return parsed;
}

function inWindow(item, dayKey) {
  const start = new Date(`${dayKey}T00:00:00Z`).getTime() - IST_OFFSET_MS;
  const end = start + 24 * 60 * 60 * 1000;
  const t = item.published_at.getTime();
  return t >= start && t < end;
}

function selectItemsForDay(rawItems, dayKey) {
  return parseItems(rawItems)
    .filter((item) => inWindow(item, dayKey))
    .sort((a, b) => a.published_at.getTime() - b.published_at.getTime());
}

// ---------------------------------------------------------------------------
// Doc / tab helpers
// ---------------------------------------------------------------------------

function flattenTabs(tabs) {
  const out = [];
  for (const tab of tabs || []) {
    out.push(tab);
    out.push(...flattenTabs(tab.childTabs || []));
  }
  return out;
}

function findTab(doc, title) {
  for (const tab of flattenTabs(doc.tabs || [])) {
    const props = tab.tabProperties || {};
    if (props.title === title && props.tabId) {
      return { tab_id: props.tabId, tab };
    }
  }
  return null;
}

async function getOrCreateTab(accessToken, docId, title) {
  const doc = await docsGet(accessToken, docId);
  const existing = findTab(doc, title);
  if (existing) return existing;

  await docsBatchUpdate(accessToken, docId, [
    { addDocumentTab: { tabProperties: { title } } }
  ]);
  const refreshed = await docsGet(accessToken, docId);
  const created = findTab(refreshed, title);
  if (!created) throw new Error(`Created tab ${title}, but could not find it on readback`);
  return created;
}

function tabBody(tab) {
  const body = tab.documentTab?.body;
  if (!body) throw new Error("Could not resolve Google Doc tab body");
  return body;
}

function bodyEndIndex(body) {
  const content = body.content || [];
  if (!content.length) return 1;
  return Number(content[content.length - 1].endIndex || 1);
}

function buildDocText(items) {
  let text = "";
  const linkRanges = [];
  for (const item of items) {
    const prefix = `${item.blurb} [`;
    text += prefix;
    const linkStart = text.length;
    text += item.source_name;
    const linkEnd = text.length;
    text += "]\n\n";
    linkRanges.push([linkStart, linkEnd, item.source_url]);
  }
  return { text, linkRanges };
}

function bodyTextAndLinks(body) {
  let text = "";
  const links = [];
  for (const elem of body.content || []) {
    const para = elem.paragraph;
    if (!para) continue;
    for (const el of para.elements || []) {
      const run = el.textRun;
      if (!run) continue;
      const content = run.content || "";
      text += content;
      const url = run.textStyle?.link?.url;
      if (url && content.trim()) links.push([content.trim(), url]);
    }
  }
  return { text, links };
}

function verifyReadback(text, links, items, existingLinks = null) {
  const expected = items.map((item) => [item.source_name, item.source_url]);
  for (const exp of expected) {
    if (!links.some(([label, url]) => label === exp[0] && url === exp[1])) {
      throw new Error(`Readback missing source link: ${exp[0]}`);
    }
  }
  if (existingLinks) {
    for (const existing of existingLinks) {
      if (!links.some(([label, url]) => label === existing[0] && url === existing[1])) {
        throw new Error(`Readback lost existing source link: ${existing[0]}`);
      }
    }
  } else if (links.length !== expected.length) {
    throw new Error(`Readback link count mismatch: expected ${expected.length}, got ${links.length}`);
  }
  if (text.includes("[[") || text.includes("](") || text.includes("]]")) {
    throw new Error("Readback contains markdown transport syntax");
  }
  if (/https?:\/\/\S+/i.test(text)) {
    throw new Error("Readback contains a visible raw URL");
  }
  for (const item of items) {
    if (!text.includes(item.blurb)) {
      throw new Error(`Readback missing blurb for item ${item.raw_id}`);
    }
  }
}

async function writeTab(accessToken, docId, target, items, replace = false) {
  const doc = await docsGet(accessToken, docId);
  const fresh = findTab(doc, target.tab.tabProperties?.title || "");
  if (!fresh) throw new Error("Write verification failed: tab missing after write");
  const body = tabBody(fresh.tab);
  const end = bodyEndIndex(body);
  const { text: existingText, links: existingLinks } = bodyTextAndLinks(body);
  const existingUrls = new Set(existingLinks.map(([, url]) => url.replace(/\/$/, "").toLowerCase()));

  if (!replace && existingLinks.length) {
    const missing = items.filter(
      (item) => !existingUrls.has(item.source_url.replace(/\/$/, "").toLowerCase())
    );
    if (!missing.length) {
      return {
        chars_written: 0,
        links_expected: items.length,
        links_read_back: existingLinks.length,
        added: 0,
        already_present: items.length,
        merged: true
      };
    }
    items = missing;
  }

  let { text, linkRanges } = buildDocText(items);
  const requests = [];
  let insertIndex;

  if (replace || !existingLinks.length) {
    if (end > 2) {
      requests.push({
        deleteContentRange: { range: { tabId: target.tab_id, startIndex: 1, endIndex: end - 1 } }
      });
    }
    insertIndex = 1;
  } else {
    insertIndex = end - 1;
    if (existingText && !existingText.endsWith("\n\n")) {
      text = "\n" + text;
    }
  }

  if (text) {
    requests.push({
      insertText: { location: { tabId: target.tab_id, index: insertIndex }, text }
    });
    requests.push({
      updateTextStyle: {
        range: { tabId: target.tab_id, startIndex: insertIndex, endIndex: insertIndex + text.length },
        textStyle: {
          weightedFontFamily: { fontFamily: FONT_FAMILY },
          fontSize: { magnitude: FONT_SIZE_PT, unit: "PT" },
          bold: false
        },
        fields: "weightedFontFamily,fontSize,bold"
      }
    });
    for (const [start, finish, url] of linkRanges) {
      requests.push({
        updateTextStyle: {
          range: { tabId: target.tab_id, startIndex: insertIndex + start, endIndex: insertIndex + finish },
          textStyle: { link: { url } },
          fields: "link"
        }
      });
    }
  }

  if (requests.length) {
    await docsBatchUpdate(accessToken, docId, requests);
  }

  const after = await docsGet(accessToken, docId);
  const refreshed = findTab(after, target.tab.tabProperties?.title || "");
  if (!refreshed) throw new Error("Write verification failed: tab missing after write");
  const afterBody = tabBody(refreshed.tab);
  const { text: afterText, links: afterLinks } = bodyTextAndLinks(afterBody);
  verifyReadback(afterText, afterLinks, items, existingLinks.length ? existingLinks : null);
  return {
    chars_written: text.length,
    links_expected: items.length,
    links_read_back: afterLinks.length,
    added: items.length,
    already_present: existingLinks.length || 0,
    merged: !replace && Boolean(existingLinks.length)
  };
}

// ---------------------------------------------------------------------------
// Monthly doc rotation + sharing
// ---------------------------------------------------------------------------

async function driveCreateDoc(accessToken, title) {
  const response = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      name: title,
      mimeType: "application/vnd.google-apps.document"
    })
  });
  if (!response.ok) {
    throw new Error(`Drive create failed: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
  }
  return response.json();
}

async function driveShare(accessToken, fileId, email) {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?transferOwnership=false`,
    {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ type: "user", role: "writer", emailAddress: email })
    }
  );
  if (!response.ok) {
    throw new Error(`Drive share failed: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
  }
}

export async function monthlyDocInfo(env, state, notifyFn) {
  const accessToken = await googleAccessToken(env);
  const nowIst = istNow();
  const monthKey = nowIst.toISOString().slice(0, 7); // YYYY-MM
  const monthName = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(
    new Date(`${monthKey}-01T00:00:00Z`)
  );
  const year = nowIst.toISOString().slice(0, 4);

  if (state.doc && state.doc.month === monthKey) {
    return { docId: state.doc.docId, created: false };
  }

  // First run / no recorded doc: use the default doc for the current month
  // instead of creating a new one. Only a real month rollover (the recorded
  // doc belongs to an earlier month) creates a fresh doc.
  if (!state.doc) {
    state.doc = {
      month: monthKey,
      docId: DEFAULT_DOC_ID,
      title: "Default",
      created_at: new Date().toISOString()
    };
    await writeGatherState(env, state);
    return { docId: DEFAULT_DOC_ID, created: false };
  }

  // Month rollover: create the new monthly doc: "DNG <Month>, <YYYY>"
  const title = `DNG ${monthName}, ${year}`;
  const created = await driveCreateDoc(accessToken, title);
  const docId = created.id;
  if (!docId) throw new Error("Drive create returned no file id");

  // Share with the configured editor (admin) recipient.
  const shareEmail = env.GATHER_SHARE_EMAIL || "sai@asiatechreview.com";
  await driveShare(accessToken, docId, shareEmail);

  state.doc = { month: monthKey, docId, title, created_at: new Date().toISOString() };
  await writeGatherState(env, state);

  if (notifyFn) {
    await notifyFn(`New DNG doc created for ${monthName} ${year}: https://docs.google.com/document/d/${docId}/edit`);
  }
  return { docId, created: true };
}

// ---------------------------------------------------------------------------
// Main gather run
// ---------------------------------------------------------------------------

export async function runGather(env, options = {}) {
  const { date = null, force = false, mode = "manual" } = options;
  const state = await readGatherState(env);
  const rawItems = await fetchApiItems();
  const parsed = parseItems(rawItems);
  const checkpoint = state.checkpoint ? new Date(state.checkpoint) : null;
  const now = new Date();

  const summary = {
    doc_id: state.doc?.docId || DEFAULT_DOC_ID,
    mode,
    checkpoint: checkpoint ? checkpoint.toISOString() : null
  };

  // Resolve the active monthly doc (creates + shares a new one at rollover).
  const docResult = await monthlyDocInfo(env, state, options.notifyFn);
  const docId = docResult.docId;
  summary.doc_id = docId;

  let groups = {};
  let newCheckpoint = checkpoint;

  if (date) {
    const day = date;
    const items = selectItemsForDay(rawItems, day);
    groups = items.length ? { [day]: items } : {};
    newCheckpoint = checkpoint;
    summary.explicit_date = day;
  } else if (!checkpoint) {
    const day = previousIstDayKey();
    const items = selectItemsForDay(rawItems, day);
    groups = items.length ? { [day]: items } : {};
    newCheckpoint = new Date(Date.now() - IST_OFFSET_MS);
    summary.initial_run = true;
  } else {
    const items = parsed.filter((item) => checkpoint.getTime() < item.published_at.getTime() && item.published_at.getTime() <= now.getTime());
    for (const item of items) {
      const istDay = istDateKey(item.published_at);
      (groups[istDay] = groups[istDay] || []).push(item);
    }
    for (const day of Object.keys(groups)) {
      groups[day].sort((a, b) => a.published_at.getTime() - b.published_at.getTime());
    }
    newCheckpoint = items.length
      ? new Date(Math.max(...items.map((item) => item.published_at.getTime())))
      : checkpoint;
  }

  summary.dates = {};
  for (const day of Object.keys(groups).sort()) {
    summary.dates[day] = groups[day].length;
  }

  const accessToken = await googleAccessToken(env);
  let totalLinks = 0;
  for (const day of Object.keys(groups).sort()) {
    const items = groups[day];
    const title = tabTitleFor(day);
    const target = await getOrCreateTab(accessToken, docId, title);
    const writeResult = await writeTab(accessToken, docId, target, items, force);
    totalLinks += writeResult.links_read_back || 0;
    state.exports = state.exports || {};
    state.exports[day] = {
      status: "success",
      mode,
      completed_at: new Date().toISOString(),
      tab_title: title,
      items_found: items.length,
      links_read_back: writeResult.links_read_back
    };
    await writeGatherState(env, state);
  }
  summary.links_read_back = totalLinks;

  if (newCheckpoint) {
    state.checkpoint = newCheckpoint.toISOString();
    await writeGatherState(env, state);
  }

  return summary;
}
