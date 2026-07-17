import { STATIC_ITEMS } from "../_data/static-items.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1-9bPUuh73mgFWM1gDc_3qlTe_-VNZGrgRfWMApv8yxU/gviz/tq?tqx=out:csv&gid=0&headers=1";

export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || DEFAULT_LIMIT, MAX_LIMIT);
  const category = url.searchParams.get("category");
  const date = parseDateParam(url.searchParams.get("date"));

  let query = "SELECT * FROM feed_items WHERE status = ?";
  const params = ["published"];

  if (category) {
    query += " AND category = ?";
    params.push(category);
  }

  query += " ORDER BY published_at DESC, id DESC LIMIT ?";
  params.push(MAX_LIMIT);

  let d1Items = [];

  try {
    const result = await env.ATR_FEED_DB.prepare(query).bind(...params).all();
    d1Items = result.results || [];
  } catch (error) {
    d1Items = [];
  }

  const staticItems = loadStaticItems({ limit: MAX_LIMIT, category });
  const mergedItems = balanceArchiveDates(rebalanceJulyArchiveDates(mergeItems(d1Items, staticItems)))
    .filter((item) => !date || dateKey(item.published_at) === date)
    .slice(0, limit);

  if (mergedItems.length) {
    return json({
      items: mergedItems
    });
  }

  const sheetItems = await loadSheetItems({ limit, category, date });

  return json({
    items: sheetItems
  });
}

function mergeItems(...groups) {
  const seen = new Set();
  return groups
    .flat()
    .filter((item) => {
      if (!item) return false;
      const key = String(item.source_url || item.id || `${item.blurb}-${item.published_at}`).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      const aTime = new Date(a.published_at).getTime() || 0;
      const bTime = new Date(b.published_at).getTime() || 0;
      return bTime - aTime;
    });
}

function loadStaticItems({ limit, category, date }) {
  return STATIC_ITEMS
    .filter((item) => item && (!category || item.category === category) && (!date || dateKey(item.published_at) === date))
    .sort((a, b) => {
      const aTime = new Date(a.published_at).getTime() || 0;
      const bTime = new Date(b.published_at).getTime() || 0;
      return bTime - aTime;
    })
    .slice(0, limit);
}

function rebalanceJulyArchiveDates(items) {
  const targetDates = [
    "2026-07-13",
    "2026-07-14",
    "2026-07-15",
    "2026-07-16"
  ];
  const sourceDate = "2026-07-16";
  const itemsPerDate = 20;
  const julyItems = items
    .filter((item) => dateKey(item.published_at) === sourceDate)
    .sort((a, b) => {
      const aTime = new Date(a.published_at).getTime() || 0;
      const bTime = new Date(b.published_at).getTime() || 0;
      return aTime - bTime;
    });
  const movedByKey = new Map();

  julyItems.forEach((item, index) => {
    const targetDate = targetDates[Math.min(Math.floor(index / itemsPerDate), targetDates.length - 1)];
    movedByKey.set(itemKey(item), {
      ...item,
      published_at: moveBangkokDate(item.published_at, targetDate)
    });
  });

  return items
    .map((item) => movedByKey.get(itemKey(item)) || item)
    .sort((a, b) => {
      const aTime = new Date(a.published_at).getTime() || 0;
      const bTime = new Date(b.published_at).getTime() || 0;
      return bTime - aTime;
    });
}

function balanceArchiveDates(items) {
  return [
    ["2026-07-04", "2026-07-03", 5],
    ["2026-07-12", "2026-07-11", 9]
  ].reduce((balancedItems, [sourceDate, targetDate, count]) => {
    return shiftOldestItemsByDate(balancedItems, sourceDate, targetDate, count);
  }, items);
}

function shiftOldestItemsByDate(items, sourceDate, targetDate, count) {
  const itemsToMove = items
    .filter((item) => dateKey(item.published_at) === sourceDate)
    .sort((a, b) => {
      const aTime = new Date(a.published_at).getTime() || 0;
      const bTime = new Date(b.published_at).getTime() || 0;
      return aTime - bTime;
    })
    .slice(0, count);
  const movedKeys = new Set(itemsToMove.map(itemKey));

  return items
    .map((item) => {
      if (!movedKeys.has(itemKey(item))) {
        return item;
      }

      return {
        ...item,
        published_at: moveBangkokDate(item.published_at, targetDate)
      };
    })
    .sort((a, b) => {
      const aTime = new Date(a.published_at).getTime() || 0;
      const bTime = new Date(b.published_at).getTime() || 0;
      return bTime - aTime;
    });
}

function itemKey(item) {
  return String(item.source_url || item.id || `${item.blurb}-${item.published_at}`).toLowerCase();
}

function moveBangkokDate(value, targetDate) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "Asia/Bangkok"
    }).formatToParts(date);
    const values = {};
    for (const part of parts) {
      values[part.type] = part.value;
    }
    return new Date(`${targetDate}T${values.hour}:${values.minute}:${values.second}+07:00`).toISOString();
  } catch (error) {
    const fallback = new Date(date.getTime());
    fallback.setUTCFullYear(Number(targetDate.slice(0, 4)));
    fallback.setUTCMonth(Number(targetDate.slice(5, 7)) - 1);
    fallback.setUTCDate(Number(targetDate.slice(8, 10)));
    return fallback.toISOString();
  }
}

export async function onRequestPost({ env, request }) {
  const auth = request.headers.get("authorization") || "";
  const expected = env.FEED_INGEST_TOKEN ? `Bearer ${env.FEED_INGEST_TOKEN}` : "";

  if (!expected || auth !== expected) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const blurb = clean(body.blurb);
  const quoteBlurb = clean(body.quote || body.quoteBlurb || body.quote_blurb || body.quotedBlurb || body.quoted_blurb);
  const commentary = clean(body.commentary || body.comment || body.jonCommentary || body.jon_commentary);
  const sourceName = clean(body.sourceName || body.source_name);
  const sourceUrl = clean(body.sourceUrl || body.source_url);
  const category = clean(body.region || body.category) || "Other news";
  const telegramMessageId = clean(body.telegramMessageId || body.telegram_message_id);
  const publishedAt = clean(body.publishedAt || body.published_at) || new Date().toISOString();

  if (!blurb) {
    return json({ error: "blurb is required" }, 400);
  }

  if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) {
    return json({ error: "sourceUrl must be an http(s) URL" }, 400);
  }

  let result;

  try {
    result = await env.ATR_FEED_DB.prepare(
      `INSERT INTO feed_items
        (blurb, quote_blurb, commentary, source_name, source_url, category, telegram_message_id, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id, blurb, quote_blurb, commentary, source_name, source_url, category, telegram_message_id, published_at, created_at`
    )
      .bind(blurb, quoteBlurb || null, commentary || null, sourceName, sourceUrl, category, telegramMessageId || null, publishedAt)
      .first();
  } catch (error) {
    if (!isMissingCommentaryColumnError(error)) {
      throw error;
    }

    result = await env.ATR_FEED_DB.prepare(
      `INSERT INTO feed_items
        (blurb, source_name, source_url, category, telegram_message_id, published_at)
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING id, blurb, source_name, source_url, category, telegram_message_id, published_at, created_at`
    )
      .bind(commentary || blurb, sourceName, sourceUrl, category, telegramMessageId || null, publishedAt)
      .first();
  }

  return json({ item: result }, 201);
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isMissingCommentaryColumnError(error) {
  return /no such column|table feed_items has no column named/i.test(String(error?.message || error));
}

async function loadSheetItems({ limit, category, date }) {
  const response = await fetch(SHEET_CSV_URL);
  if (!response.ok) {
    throw new Error(`Feed sheet returned ${response.status}`);
  }

  return parseCsv(await response.text())
    .map(normalizeSheetItem)
    .filter((item) => item && (!category || item.category === category) && (!date || dateKey(item.published_at) === date))
    .sort((a, b) => {
      const aTime = new Date(a.published_at).getTime() || 0;
      const bTime = new Date(b.published_at).getTime() || 0;
      return bTime - aTime;
    })
    .slice(0, limit);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (value || row.length) {
        row.push(value);
        rows.push(row);
        row = [];
        value = "";
      }
      if (char === "\r" && next === "\n") {
        index += 1;
      }
    } else {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  if (!rows.length) {
    return [];
  }

  const headers = rows.shift().map((header) => header.trim());
  return rows
    .filter((cells) => cells.some((cell) => clean(cell)))
    .map((cells) => {
      const item = {};
      headers.forEach((header, index) => {
        item[header] = clean(cells[index]);
      });
      return item;
    });
}

function normalizeSheetItem(item) {
  const blurb = clean(item.Blurb || item.blurb);
  if (!blurb) {
    return null;
  }

  const sourceUrl = clean(item.URL || item.Url || item.url);
  const publishedAt = parseSheetDate(item) || new Date().toISOString();

  return {
    id: `sheet-${publishedAt}-${blurb.slice(0, 24)}`,
    blurb,
    quote_blurb: clean(item.Quote || item.quote || item.QuoteBlurb || item.quote_blurb),
    commentary: clean(item.Commentary || item.commentary || item.Comment || item.comment),
    source_name: clean(item.Source || item.source),
    source_url: /^https?:\/\//i.test(sourceUrl) ? sourceUrl : "",
    category: clean(item.Region || item.region || item.Category || item.category),
    telegram_message_id: null,
    published_at: publishedAt,
    created_at: publishedAt
  };
}

function parseSheetDate(item) {
  const dateValue = clean(item.Date || item.date);
  const timeValue = clean(item.Time || item.time);

  if (!dateValue) {
    return "";
  }

  const parsed = timeValue && /^\d{1,2}:\d{2}/.test(timeValue)
    ? new Date(`${dateValue}T${timeValue}:00+07:00`)
    : new Date(`${dateValue}T00:00:00+07:00`);

  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function parseDateParam(value) {
  const cleaned = clean(value);
  const dmy = cleaned.match(/^([0-9]{2})-([0-9]{2})-([0-9]{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(cleaned) ? cleaned : "";
}

function dateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Asia/Bangkok"
    }).format(date);
  } catch {
    const bangkok = new Date(date.getTime() + (7 * 60 * 60 * 1000));
    return [
      bangkok.getUTCFullYear(),
      pad2(bangkok.getUTCMonth() + 1),
      pad2(bangkok.getUTCDate())
    ].join("-");
  }
}

function pad2(value) {
  return value < 10 ? `0${value}` : String(value);
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
