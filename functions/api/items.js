import { STATIC_ITEMS } from "../_data/static-items.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1-9bPUuh73mgFWM1gDc_3qlTe_-VNZGrgRfWMApv8yxU/gviz/tq?tqx=out:csv&gid=0&headers=1";
const HEADLINE_OVERRIDES = new Map(Object.entries({
  "43": "SK warns AI memory crunch is getting political",
  "html-2026-07-16-034": "SoftBank's Son puts AI infra cost at $5tn a year",
  "19": "DeepSeek pushes China AI price war into enterprise adoption",
  "manual-telegram-2026-07-17-005": "DeepSeek pushes China AI price war into enterprise adoption"
}));

export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || DEFAULT_LIMIT, MAX_LIMIT);
  const category = url.searchParams.get("category");
  const date = parseDateParam(url.searchParams.get("date"));

  let query = "SELECT id, blurb, source_name, source_url, category, telegram_message_id, published_at, created_at FROM feed_items WHERE status = ?";
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
      items: withHeadlines(mergedItems)
    });
  }

  const sheetItems = await loadSheetItems({ limit, category, date });

  return json({
    items: withHeadlines(sheetItems)
  });
}

function withHeadlines(items) {
  return items.map((item) => {
    const headline = clean(item.headline || item.Headline || item.title) || headlineForItem(item);
    return {
      ...item,
      headline
    };
  });
}

function headlineForItem(item) {
  const id = String(item.id || item.ID || item.ItemID || item.item_id || "").trim();
  return HEADLINE_OVERRIDES.get(id) || deriveHeadline(item.blurb || item.Blurb || "");
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

  const result = await env.ATR_FEED_DB.prepare(
    `INSERT INTO feed_items
      (blurb, source_name, source_url, category, telegram_message_id, published_at)
     VALUES (?, ?, ?, ?, ?, ?)
     RETURNING id, blurb, source_name, source_url, category, telegram_message_id, published_at, created_at`
  )
    .bind(blurb, sourceName, sourceUrl, category, telegramMessageId || null, publishedAt)
    .first();

  return json({ item: withHeadlines([result])[0] }, 201);
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function firstSentence(text) {
  const match = String(text || "").trim().match(/^(.+?[.!?])\s+/);
  return match ? match[1] : String(text || "").trim();
}

function stripAttribution(text) {
  return String(text || "")
    .replace(/\s+\[[^\]]+\]\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function simplifyLeadPhrase(text) {
  return stripAttribution(text)
    .replace(/\bhas begun\b/gi, "begins")
    .replace(/\bhas started\b/gi, "starts")
    .replace(/\bhas launched\b/gi, "launches")
    .replace(/\bhas unveiled\b/gi, "unveils")
    .replace(/\bhas completed\b/gi, "completes")
    .replace(/\bhas won\b/gi, "wins")
    .replace(/\bhas rolled out\b/gi, "rolls out")
    .replace(/\bhas raised\b/gi, "raises")
    .replace(/\bhas cut\b/gi, "cuts")
    .replace(/\bhas dismissed\b/gi, "rejects")
    .replace(/\bis preparing to\b/gi, "plans to")
    .replace(/\bis planning to\b/gi, "plans to")
    .replace(/\bis pushing ahead with plans to\b/gi, "plans to")
    .replace(/\bwill work with\b/gi, "adds")
    .replace(/\bwill buy\b/gi, "buys")
    .replace(/\bwould likely set\b/gi, "may set")
    .replace(/\bappears set to raise\b/gi, "nears")
    .replace(/\bsaid it will\b/gi, "will")
    .replace(/\bsaid it would\b/gi, "would")
    .replace(/\bsaid\b/gi, "says")
    .replace(/\bannounced\b/gi, "unveiled")
    .replace(/\s*,\s*(?:the|a|an)\s+(?:Chinese|Indian|South Korean|Singapore-based|Japanese|US|American|UAE|Abu Dhabi|Taiwanese|Indonesian|Malaysian|Thai|Vietnamese|Philippine|Hong Kong)\b[^,]{10,90},\s*/gi, " ")
    .replace(/\s*,\s*(?:the|a|an)\s+[^,]{12,90},\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shortMoney(amount, unit) {
  const normalizedUnit = String(unit || "").toLowerCase();
  const suffix = normalizedUnit.startsWith("b") ? "bn" : "m";
  return `$${amount}${suffix}`;
}

function headlineFromPattern(sentence) {
  const patterns = [
    [/^SK Group chairman Chey Tae-won\s+says\s+the global AI memory-chip shortage.*?foreign governments are intervening.*$/i, "SK warns AI memory crunch is getting political"],
    [/^SoftBank founder Masayoshi Son\s+says?\s+global AI infrastructure will require\s+\$?([0-9.]+)\s*trillion a year/i, (match) => `SoftBank's Son puts AI infra cost at $${match[1]}tn a year`],
    [/^(.+?)\s+plans to raise pre-IPO funding before a planned Hong Kong listing/i, "$1 lines up Hong Kong IPO push"],
    [/^(.+?)\s+is on pace for\s+\$?([0-9.]+)\s*(billion|million|mn|m)\s+in annual recurring revenue/i, (match) => `${match[1]} nears ${shortMoney(match[2], match[3])} ARR`],
    [/^(.+?)\s+has held talks with banks about a potential listing/i, "$1 weighs IPO"],
    [/^Xi Jinping\s+used .*?World AI Conference.*?to praise\s+China.*$/i, "Xi uses WAIC to pitch China AI"],
    [/^(.+?)\s+plans to produce India's first semiconductor wafers on ([0-9]+nm).*$/i, "$1 plans India's first $2 wafers"],
    [/^(.+?)\s+plans to launch (.+?),\s+a\s+([0-9]+tn-[0-9]+tn|[0-9.]+-trillion)[^,]*model/i, "$1 readies $2 model launch"],
    [/^(.+?)\s+unveiled\s+(.+?),\s+(?:a|an|billed as)/i, "$1 unveils $2"],
    [/^(.+?)\s+launches?\s+(.+?),\s+(?:a|an|billed as)/i, "$1 launches $2"],
    [/^(.+?)\s+raises?\s+(?:nearly\s+|more than\s+)?(?:a\s+)?\$?([0-9.]+)\s*(billion|million|mn|m)\b/i, (match) => `${match[1]} raises ${shortMoney(match[2], match[3])}`],
    [/^(.+?)\s+secured\s+(?:a\s+)?\$?([0-9.]+)\s*(billion|million|mn|m)\b/i, (match) => `${match[1]} secures ${shortMoney(match[2], match[3])}`],
    [/^Representatives from\s+([0-9]+)\s+countries signed an agreement to establish\s+(?:a\s+)?(?:global\s+)?(.+?)(?:\s+body|\s+headquartered|,|$).*$/i, "$1 countries back $2"],
    [/^US House China committee chair John Moolenaar urged .*? to ban\s+US companies from buying\s+(.+?)\s+chips.*$/i, "US lawmaker pushes $1 chip ban"]
  ];

  for (const [pattern, replacement] of patterns) {
    const match = sentence.match(pattern);
    if (match) {
      return typeof replacement === "function" ? replacement(match) : sentence.replace(pattern, replacement);
    }
  }

  return "";
}

function limitHeadline(text, maxLength = 58) {
  const words = stripAttribution(text)
    .replace(/\$([0-9.]+)billion\b/gi, "$$$1bn")
    .replace(/\$([0-9.]+)million\b/gi, "$$$1m")
    .replace(/\s+(?:that|which|while|warning|after|before|as|with|where|including|using|following)\b.*$/i, "")
    .replace(/\s+and\s*$/i, "")
    .replace(/[,:;.-]+$/, "")
    .split(/\s+/)
    .filter(Boolean);
  const kept = [];

  for (const word of words) {
    const next = [...kept, word].join(" ");
    if (next.length > maxLength) break;
    kept.push(word);
  }

  return (kept.length ? kept.join(" ") : words.slice(0, 8).join(" ")).replace(/[,:;.-]+$/, "");
}

function deriveHeadline(blurb) {
  const sentence = simplifyLeadPhrase(firstSentence(blurb));

  if (!sentence) {
    return "Asia tech update";
  }

  const patterned = headlineFromPattern(sentence);
  if (patterned) {
    return limitHeadline(patterned, 62);
  }

  const clauses = sentence.split(/,\s+(?:with|as|while|after|amid|according to|marking|making|in a move|where|before|part of)\b/i);
  return limitHeadline(clauses[0].trim());
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
