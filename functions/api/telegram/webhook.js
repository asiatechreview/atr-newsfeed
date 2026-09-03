import { json } from "../../_lib/public-api.js";
import { linkKeyFor } from "../../_lib/link-key.js";
import { categoryRules } from "../../_lib/categories.js";
import {
  clearSchedule,
  istDateKey,
  previousIstDayKey,
  readSchedule,
  runGather,
  writeSchedule
} from "../../_lib/daily-gather.js";

// ATR Rapid Transit — Telegram posting pipeline for the ATR bulletin site.
//
// A dedicated Telegram bot (TARS @Controlfreakjrbot) sits in a private
// "ATR Rapid Transit" group. When Sai or Jon posts a URL plus a
// fact-checked blurb there, this Worker:
//   1. validates the Telegram webhook secret header;
//   2. checks the message came from the configured group;
//   3. extracts the URL and blurb, keeps the blurb verbatim;
//   4. resolves the outlet label (built-in map, then saved D1 mappings);
//      unmapped publishers pause the post and ask the group for a label,
//      which is recorded for future use;
//   5. generates a scan-first headline from the blurb via Workers AI, then
//      fact-checks it: every figure in the headline must match a figure in
//      the blurb. Vocabulary is the model's editorial freedom; numbers are
//      the objective facts a headline must never invent.
//   6. posts the formatted copy (blurb + linked [Outlet]) back to the group;
//   7. ingests the item to the bulletin site via POST /api/items
//      (dedupe, headline guard and operational logging all live there);
//   8. confirms with a single 🟢.
//
// Runs entirely on Cloudflare and works even when the normal Daily News
// Automation flow (through JR) is unavailable.

const OUTLET_MAP = {
  "ft.com": "FT",
  "reuters.com": "Reuters",
  "scmp.com": "SCMP",
  "wsj.com": "WSJ",
  "nytimes.com": "NYT",
  "bloomberg.com": "Bloomberg",
  "asia.nikkei.com": "Nikkei Asia",
  "nikkei.com": "Nikkei Asia",
  "techcrunch.com": "TechCrunch",
  "technode.global": "TechNode",
  "technode.com": "TechNode",
  "cnbc.com": "CNBC",
  "theinformation.com": "The Information",
  "economictimes.indiatimes.com": "Economic Times",
  "moneycontrol.com": "Moneycontrol",
  "theblock.co": "The Block",
  "therecord.media": "The Record",
  "business-standard.com": "Business Standard",
  "restofworld.org": "Rest of World",
  "semafor.com": "Semafor",
  "wired.com": "Wired",
  "torrentfreak.com": "TorrentFreak",
  "businesstimes.com.sg": "The Business Times",
  "axios.com": "Axios",
  "calcalistech.com": "Calcalist",
  "bbc.com": "BBC",
  "bbc.co.uk": "BBC",
  "cna.asia": "CNA",
  "channelnewsasia.com": "CNA",
  "x.com": "X",
  "twitter.com": "X",
  "robostrategy.co": "RoboStrategy",
  "z.ai": "Z.ai",
  "globenewswire.com": "GlobeNewswire"
};

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function fallbackLabel(host) {
  const parts = host.split(".");
  if (parts.length >= 2) {
    const root = parts[parts.length - 2];
    return root.charAt(0).toUpperCase() + root.slice(1);
  }
  return "Source";
}

async function ensureTables(env) {
  if (!env?.ATR_FEED_DB) return;
  await env.ATR_FEED_DB.prepare(
    `CREATE TABLE IF NOT EXISTS rapid_transit_outlets (
      domain TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    )`
  ).run();
  await env.ATR_FEED_DB.prepare(
    `CREATE TABLE IF NOT EXISTS rapid_transit_pending (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      url TEXT NOT NULL,
      blurb TEXT NOT NULL,
      domain TEXT NOT NULL,
      label TEXT,
      supplied_headline TEXT,
      status TEXT NOT NULL DEFAULT 'awaiting_label',
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    )`
  ).run();
  try {
    await env.ATR_FEED_DB.prepare("ALTER TABLE rapid_transit_pending ADD COLUMN label TEXT").run();
  } catch {
    // Existing table already has the optional label column.
  }
  try {
    await env.ATR_FEED_DB.prepare("ALTER TABLE rapid_transit_pending ADD COLUMN supplied_headline TEXT").run();
  } catch {
    // Existing table already has the optional supplied headline column.
  }
}

async function savedLabel(env, domain) {
  if (!env?.ATR_FEED_DB) return null;
  const row = await env.ATR_FEED_DB.prepare(
    "SELECT label FROM rapid_transit_outlets WHERE domain = ?"
  ).bind(domain).first();
  return row?.label || null;
}

async function saveLabel(env, domain, label) {
  if (!env?.ATR_FEED_DB) return;
  await env.ATR_FEED_DB.prepare(
    `INSERT INTO rapid_transit_outlets (domain, label, created_at)
     VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
     ON CONFLICT(domain) DO UPDATE SET label = excluded.label`
  ).bind(domain, label).run();
}

async function resolveLabel(env, domain) {
  if (OUTLET_MAP[domain]) return OUTLET_MAP[domain];
  const saved = await savedLabel(env, domain);
  if (saved) return saved;
  return null; // Unmapped: caller should ask the group.
}

function cleanLabelInput(value) {
  return String(value || "")
    .trim()
    .replace(/^["'[\]]+|["'[\]]+$/g, "")
    .replace(/[\[\]()]/g, "")
    .slice(0, 40)
    .trim();
}

async function pendingAwaitingLabel(env, domain) {
  if (!env?.ATR_FEED_DB) return null;
  const row = await env.ATR_FEED_DB.prepare(
    "SELECT id FROM rapid_transit_pending WHERE domain = ? AND status = 'awaiting_label' ORDER BY id ASC LIMIT 1"
  ).bind(domain).first();
  return row || null;
}

async function oldestPending(env) {
  if (!env?.ATR_FEED_DB) return null;
  const row = await env.ATR_FEED_DB.prepare(
    "SELECT * FROM rapid_transit_pending WHERE status = 'awaiting_label' ORDER BY id ASC LIMIT 1"
  ).first();
  return row || null;
}

async function oldestPendingTitle(env) {
  if (!env?.ATR_FEED_DB) return null;
  const row = await env.ATR_FEED_DB.prepare(
    "SELECT * FROM rapid_transit_pending WHERE status = 'awaiting_title' ORDER BY id ASC LIMIT 1"
  ).first();
  return row || null;
}

async function markPendingProcessed(env, id) {
  if (!env?.ATR_FEED_DB) return;
  await env.ATR_FEED_DB.prepare(
    "UPDATE rapid_transit_pending SET status = 'processed' WHERE id = ?"
  ).bind(id).run();
}

async function savePendingTitleRequest(env, chatId, url, blurb, domain, label) {
  if (!env?.ATR_FEED_DB) return;
  await env.ATR_FEED_DB.prepare(
    `INSERT INTO rapid_transit_pending (chat_id, url, blurb, domain, label, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'awaiting_title', strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`
  ).bind(String(chatId), url, blurb, domain, label).run();
}

async function inferCategory(env, blurb) {
  const text = String(blurb || "").toLowerCase();
  const rules = await categoryRules(env);
  for (const rule of rules) {
    if (!rule || !rule.pattern) continue;
    try {
      if (new RegExp(rule.pattern, "i").test(text)) {
        return rule.name;
      }
    } catch {
      // Skip malformed patterns.
    }
  }
  return "";
}

async function sendGroupMessage(env, chatId, text, replyTo = null, entities = null) {
  const token = env.TELEGRAM_BACKUP_BOT_TOKEN;
  if (!token) return false;
  try {
    const body = {
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    };
    if (Array.isArray(entities) && entities.length) {
      body.entities = entities;
    } else {
      body.parse_mode = "Markdown";
    }
    if (replyTo) body.reply_to_message_id = replyTo;
    const send = async (payload) => {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      return response.ok ? true : { ok: false, status: response.status, text: (await response.text()).slice(0, 200) };
    };
    let result = await send(body);
    if (result !== true && body.parse_mode === "Markdown") {
      // Markdown can fail on titles containing special characters. Retry as
      // plain text so the reply always lands.
      const plain = { ...body };
      delete plain.parse_mode;
      result = await send(plain);
    }
    return result === true;
  } catch {
    return false;
  }
}

const HEADLINE_EXAMPLES = [
  {
    blurb: "A surge in investor enthusiasm and strong backing from Beijing have pushed valuations of Chinese tech stocks far above US peers as the country's AI sector emerges as a credible challenger to Silicon Valley. Shanghai's Star 50 index has gained 29% this year and trades at more than 150 times earnings, compared with about 35 times for the Nasdaq 100.",
    title: "Chinese tech valuations outstrip US peers"
  },
  {
    blurb: "European businesses are increasingly turning to low-cost Chinese AI models, sparking debate over whether the technology threatens the continent's digital sovereignty or could help strengthen it. Some companies argue that running open-weight Chinese models on local servers offers greater control than relying on proprietary AI services from US tech groups.",
    title: "European firms turn to Chinese AI models"
  },
  {
    blurb: "The Trump administration is opposing Apple's plans to source memory chips from China, as soaring AI-driven demand creates shortages and pushes up component prices. Commerce Secretary Howard Lutnick said Washington wants US companies to find alternatives even as Apple explores Chinese suppliers to ease supply constraints.",
    title: "US opposes Apple China memory chip plan"
  },
  {
    blurb: "China's Unitree is raising ¥6.10 billion ($904 million) in a STAR Market IPO at an implied ¥61 billion ($9.04 billion) market cap, after selling 5,215 humanoid robots last year. The prospectus allocates $300 million, or 48% of the plan, to AI models as Unitree tries to move beyond low-cost hardware.",
    title: "Unitree's $904 million IPO puts AI models in focus"
  },
  {
    blurb: "Beijing is set to lift travel restrictions on Manus founders as the Chinese AI agent startup unwinds its $2 billion acquisition by Meta, paving the way for chief executive and co-founder Xiao Hong to return to Singapore, where the company is based.",
    title: "Beijing set to lift travel curbs on Manus founders"
  },
  {
    blurb: "A profile of Sony CEO Hiroki Totoki, the company veteran leading the Japanese conglomerate's shift from an electronics giant to an entertainment powerhouse as it bets on gaming, music and film to fuel its next phase of growth.",
    title: "Sony CEO Totoki bets on entertainment"
  },
  {
    blurb: "The US is preparing to pressure dozens of countries to choose between rival American and Chinese AI blocs, warning they could be excluded from Washington's Pax Silica coalition if they also join Beijing's competing framework.",
    title: "US tells partners to pick sides in AI race"
  },
  {
    blurb: "DeepSeek has released a developer preview of Harness, a software framework designed to help developers turn AI models into autonomous agents capable of running software, writing code and completing complex tasks.",
    title: "DeepSeek releases Harness agent framework"
  }
];

const HEADLINE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    confidence: { type: "number" },
    needs_review: { type: "boolean" }
  },
  required: ["title", "confidence", "needs_review"],
  additionalProperties: false
};

function buildHeadlinePrompt() {
  const examples = HEADLINE_EXAMPLES.map(
    (e) => `Blurb: ${e.blurb}\nObject: {"title":${JSON.stringify(e.title)},"confidence":0.95,"needs_review":false}`
  ).join("\n\n");
  return `You write scan-first headlines for ATR (Asia Tech Review), a daily Asia tech news bulletin.

Study these real examples of blurb-to-title pairs produced by ATR's editor:

${examples}

Now write the title for the new blurb below. Match the style of the examples: telegraphic, lead with the actor and action, keep the key figure or subject noun, use the blurb's own verb where it works, never add facts not in the blurb, no trailing period.

Return ONLY a JSON object with:
- title: the headline, short and scan-first, 2-14 words (usually 4-10)
- confidence: 0 to 1
- needs_review: true only if you cannot derive a clean title from the blurb`;
}

function cleanHeadlineOutput(value) {
  return String(value || "")
    .replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, "")
    .replace(/^Headline:?\s*/i, "")
    .replace(/^Title:?\s*/i, "")
    .replace(/\.+$/g, "")
    .trim();
}

function suppliedHeadlineLooksUsable(value) {
  const headline = cleanHeadlineOutput(value);
  return Boolean(headline && headline.length <= 120 && !/[\r\n\t]/.test(headline) && !/https?:\/\/|www\./i.test(headline));
}

function parseRapidTransitPost(text, urlMatch) {
  const url = urlMatch[0].replace(/[),.;!?]+$/, "");
  const rawText = String(text || "").replace(urlMatch[0], "").trim();
  const blocks = rawText
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean);
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  let suppliedHeadline = null;
  const blurbLines = [];

  if (blocks.length >= 2) {
    const firstBlockLines = blocks[0].split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const markdownTitleMatch = firstBlockLines.length === 1
      ? firstBlockLines[0].match(/^(?:\*\*|__)(.+?)(?:\*\*|__)$/)
      : null;
    const possibleTitle = markdownTitleMatch ? markdownTitleMatch[1] : firstBlockLines[0];
    if (firstBlockLines.length === 1 && suppliedHeadlineLooksUsable(possibleTitle)) {
      return {
        url,
        blurb: blocks.slice(1).join(" ").replace(/\s+/g, " ").trim(),
        suppliedHeadline: cleanHeadlineOutput(possibleTitle)
      };
    }
  }

  for (const line of lines) {
    const titleMatch = line.match(/^(?:title|headline)\s*[:\-–]\s*(.+)$/i);
    if (titleMatch && !suppliedHeadline) {
      suppliedHeadline = cleanHeadlineOutput(titleMatch[1]);
      continue;
    }
    const blurbMatch = line.match(/^(?:blurb|copy)\s*[:\-–]\s*(.+)$/i);
    blurbLines.push(blurbMatch ? blurbMatch[1].trim() : line);
  }

  return {
    url,
    blurb: blurbLines.join(" ").replace(/\s+/g, " ").trim(),
    suppliedHeadline
  };
}

function extractJsonObject(text) {
  const value = String(text || "").trim();
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(value.slice(start, end + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function extractNumbers(text) {
  const out = [];
  const re = /(\d[\d,.]*)\s*(billion|bn|million|m|tn|trillion|thousand|k)?/gi;
  let match;
  while ((match = re.exec(text))) {
    const raw = match[1].replace(/,/g, "");
    const unitRaw = (match[2] || "").toLowerCase();
    const unit = unitRaw.startsWith("b")
      ? "b"
      : unitRaw.startsWith("m")
        ? "m"
        : unitRaw.startsWith("t")
          ? "t"
          : unitRaw.startsWith("k")
            ? "k"
            : "";
    out.push({ value: parseFloat(raw), unit });
  }
  return out;
}

// Fact check: every figure in the headline must match a figure in the blurb
// at the same unit scale ("3bn" matches "3 billion", "$904m" matches "$904
// million"). Numbers are the objective facts a headline must never invent;
// vocabulary and compression are the model's editorial freedom.
function headlineFactsConsistent(headline, blurb) {
  const headlineNumbers = extractNumbers(headline);
  const blurbNumbers = extractNumbers(blurb);
  for (const hn of headlineNumbers) {
    const matched = blurbNumbers.some(
      (bn) => bn.unit === hn.unit && Math.abs(bn.value - hn.value) < 0.01
    );
    if (!matched) return false;
  }
  return true;
}

function headlineLooksValid(headline) {
  const value = cleanHeadlineOutput(headline);
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 14) return false;
  if (value.length > 72) return false;
  if (/[\r\n\t]/.test(value)) return false;
  if (/https?:\/\/|www\./i.test(value)) return false;
  if (/\$[0-9.]+$/.test(value)) return false;
  // Truncation markers: a complete title never contains ellipses or dangling hyphens.
  if (/\.\.\.|\.\.|…/.test(value)) return false;
  if (/[-:;,]\s*$/.test(value)) return false;
  // Fragment starts: a scan title leads with the actor/action, not a joining word.
  if (/^(?:as|while|after|before|with|when|amid|among|though|although|despite|and|but|so|because|since|if|that|which|who|where|how|why|the|a|an)\b/i.test(value)) return false;
  if (/\b(?:a|an|the|to|for|from|of|in|on|at|by|with|into|as|and|or|but|after|before|while|amid|among|including|through|using|than|more|less|around|roughly|nearly|over|under|about|its|their|his|her|this|that|which|who|what|where|when|why|how|would|will|could|should|has|have|had|is|are|be|was|were|being|been|called|known|also|first|new)\s*$/i.test(value)) return false;
  return true;
}

function validateHeadlineObject(candidate, blurb) {
  if (!candidate || typeof candidate !== "object") {
    return { ok: false, reason: "model did not return JSON" };
  }
  const headline = cleanHeadlineOutput(candidate.title);
  if (!headlineLooksValid(headline)) {
    return { ok: false, reason: "title failed shape check" };
  }
  if (!headlineFactsConsistent(headline, blurb)) {
    return { ok: false, reason: "title number not found in blurb" };
  }

  return { ok: true, headline };
}

async function requestHeadlineObject(env, blurb, repairReason = null, useSchema = true) {
  const account = env.WORKERS_AI_ACCOUNT_ID;
  const token = env.WORKERS_AI_TOKEN;
  if (!account || !token) return null;

  const userContent = repairReason
    ? `The previous title failed validation: ${repairReason}\n\nBlurb: ${blurb}\nReturn a corrected JSON object only.`
    : `Blurb: ${blurb}\nReturn the JSON object only.`;

  const requestBody = {
    messages: [
      { role: "system", content: buildHeadlinePrompt() },
      { role: "user", content: userContent }
    ],
    max_tokens: 200,
    temperature: 0.2
  };
  if (useSchema) {
    requestBody.guided_json = HEADLINE_SCHEMA;
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/@cf/qwen/qwen2.5-coder-32b-instruct`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      }
    );
    if (!response.ok) return null;
    const payload = await response.json();
    const result = payload?.result || {};
    const choices = result.choices || [];
    if (choices.length) {
      return extractJsonObject(choices[0].message.content);
    }
    // This Workers AI model returns result.response as an already-parsed
    // object ({title, confidence, needs_review}), not a JSON string.
    if (result.response && typeof result.response === "object" && !Array.isArray(result.response)) {
      return result.response;
    }
    return extractJsonObject(result.response);
  } catch {
    return null;
  }
}

async function generateHeadlineWithReason(env, blurb) {
  let candidate = await requestHeadlineObject(env, blurb, null, true);
  if (!candidate) {
    candidate = await requestHeadlineObject(env, blurb, null, false);
  }

  let validation = validateHeadlineObject(candidate, blurb);
  if (validation.ok) return { ok: true, headline: validation.headline };

  candidate = await requestHeadlineObject(env, blurb, validation.reason, false);
  validation = validateHeadlineObject(candidate, blurb);
  return validation.ok
    ? { ok: true, headline: validation.headline }
    : { ok: false, reason: validation.reason };
}

async function generateHeadline(env, blurb) {
  const result = await generateHeadlineWithReason(env, blurb);
  return result.ok ? result.headline : null;
}

async function ingestItem(env, request, { blurb, url, label, headline, postedBy }) {
  const origin = new URL(request.url).origin;
  const category = await inferCategory(env, blurb) || undefined;
  const ingestBody = {
    blurb,
    sourceName: label,
    sourceUrl: url,
    category,
    tags: [],
    postedBy: postedBy || "telegram_rapid_transit",
    postedVia: "telegram_rapid_transit",
    status: "published"
  };
  if (headline) {
    ingestBody.headline = headline;
  }

  const response = await fetch(`${origin}/api/items`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.FEED_INGEST_TOKEN || ""}`
    },
    body: JSON.stringify(ingestBody)
  });

  if (response.ok) {
    const payload = await response.json().catch(() => ({}));
    return {
      ok: true,
      duplicate: Boolean(payload?.duplicate),
      item: payload?.item || null
    };
  }
  return { ok: false, detail: (await response.text()).slice(0, 200), status: response.status };
}

async function sendIngestResult(env, chatId, result, headline = null) {
  if (result.ok && result.duplicate) {
    const itemId = result.item?.id ? ` (id ${result.item.id})` : "";
    await sendGroupMessage(env, chatId, `⚠️ Already posted${itemId}`);
  } else if (result.ok) {
    const titleText = headline || result.item?.headline || "";
    const msg = titleText ? `🟢 ${titleText}` : "🟢";
    await sendGroupMessage(env, chatId, msg);
  } else {
    await sendGroupMessage(
      env,
      chatId,
      `❌ Ingest failed (${result.status || "error"}). ${result.detail || ""}`
    );
  }
}

function senderName(message) {
  const from = message?.from;
  if (!from) return null;
  if (from.first_name) {
    const last = from.last_name ? ` ${from.last_name}` : "";
    return `${from.first_name}${last}`.trim();
  }
  return from.username || null;
}

async function processPost(env, request, chatId, url, blurb, label, replyTo = null, postedBy = null, suppliedHeadline = null) {
  const linkKey = await linkKeyFor(url);
  const deepLink = linkKey
    ? `https://bulletin.asiatechreview.com/?item=${encodeURIComponent(linkKey)}`
    : url;
  const visibleText = `${blurb} [${label}]`;
  const labelOffset = blurb.length + 2;
  const entities = [{ type: "text_link", offset: labelOffset, length: label.length, url: deepLink }];
  await sendGroupMessage(env, chatId, visibleText, replyTo, entities);

  // Use an editor-supplied title when present; otherwise generate a
  // scan-first headline from the supplied blurb.
  let headline = suppliedHeadline ? cleanHeadlineOutput(suppliedHeadline) : "";
  if (headline && !suppliedHeadlineLooksUsable(headline)) {
    await sendGroupMessage(
      env,
      chatId,
      "That title doesn't look usable. Reply with just the headline text.",
      replyTo
    );
    await savePendingTitleRequest(env, chatId, url, blurb, hostOf(url), label);
    return;
  }
  if (!headline) {
    // This is compression, not creation: the blurb is the only input. If
    // Qwen cannot return a validated title, stop here so the site never
    // publishes a mechanically truncated fallback title.
    headline = await generateHeadline(env, blurb);
  }
  if (!headline) {
    await savePendingTitleRequest(env, chatId, url, blurb, hostOf(url), label);
    await sendGroupMessage(
      env,
      chatId,
      "Qwen couldn't produce a safe title. Reply with the title for this item."
    );
    return;
  }

  const result = await ingestItem(env, request, { blurb, url, label, headline, postedBy });
  await sendIngestResult(env, chatId, result, headline);
}

async function processPendingTitle(env, request, chatId, message, pending) {
  // Human-supplied titles bypass the Qwen style gates (Sai/Jon rule):
  // the operator's editorial call stands. Only reject transport junk.
  const headline = cleanHeadlineOutput(message.text);
  if (!headline || headline.length > 120 || /[\r\n\t]/.test(headline) || /https?:\/\/|www\./i.test(headline)) {
    await sendGroupMessage(
      env,
      chatId,
      "That doesn't look like a usable title. Reply with just the headline text.",
      message.message_id
    );
    return;
  }

  await markPendingProcessed(env, pending.id);
  const label = pending.label || await resolveLabel(env, pending.domain) || fallbackLabel(pending.domain);
  const result = await ingestItem(env, request, {
    blurb: pending.blurb,
    url: pending.url,
    label,
    headline,
    postedBy: senderName(message)
  });
  await sendIngestResult(env, chatId, result, headline);
}

export const __rapidTransitHeadlineTest = {
  extractJsonObject,
  validateHeadlineObject,
  parseRapidTransitPost
};

// ---------------------------------------------------------------------------
// /gather command handler (Daily Gather control)
// ---------------------------------------------------------------------------

function parseGatherDate(value) {
  const v = String(value || "").trim().toLowerCase();
  if (!v) return null;
  if (v === "today") return istDateKey();
  if (v === "yesterday") return previousIstDayKey();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  // Natural language: "august 10" or "august 10th, 2026"
  const monthMatch = v.match(/^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?$/);
  if (monthMatch) {
    const months = ["january","february","march","april","may","june","july","august","september","october","november","december"];
    const monthIndex = months.indexOf(monthMatch[1]);
    if (monthIndex >= 0) {
      const day = String(monthMatch[2]).padStart(2, "0");
      const year = monthMatch[3] || String(new Date().getUTCFullYear());
      return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${day}`;
    }
  }
  return null;
}

async function handleGatherCommand(env, request, chatId, text, replyTo = null) {
  const parts = text.split(/\s+/);
  const sub = (parts[1] || "").toLowerCase();
  const arg = parts.slice(2).join(" ");

  // Schedule management (off by default).
  if (sub === "schedule") {
    if (!arg) {
      const schedule = await readSchedule(env);
      await sendGroupMessage(
        env,
        chatId,
        schedule && schedule.time
          ? `Gather schedule: daily at ${schedule.time} (Bangkok).`
          : "No gather schedule set. Use /gather schedule HH:MM to set one.",
        replyTo
      );
      return;
    }
    const timeMatch = String(arg).match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (!timeMatch) {
      await sendGroupMessage(env, chatId, "Use /gather schedule HH:MM (24-hour Bangkok time).", replyTo);
      return;
    }
    const time = `${String(timeMatch[1]).padStart(2, "0")}:${timeMatch[2]}`;
    await writeSchedule(env, { time, set_at: new Date().toISOString() });
    await sendGroupMessage(env, chatId, `Gather scheduled daily at ${time} (Bangkok).`, replyTo);
    return;
  }

  if (sub === "unschedule") {
    await clearSchedule(env);
    await sendGroupMessage(env, chatId, "Gather schedule cleared. No more scheduled runs.", replyTo);
    return;
  }

  // Manual runs: /gather, /gather today, /gather yesterday, /gather YYYY-MM-DD.
  const date = sub && sub !== "run" ? parseGatherDate(sub + (arg ? ` ${arg}` : "")) : parseGatherDate(arg);
  const explicit = Boolean(date);
  await sendGroupMessage(env, chatId, `Running daily gather${explicit ? ` for ${date}` : ""}…`, replyTo);

  try {
    const summary = await runGather(env, {
      date,
      mode: "manual",
      notifyFn: (msg) => sendGroupMessage(env, chatId, msg)
    });
    const dateLine = summary.explicit_date
      ? `Gathered ${summary.explicit_date}: ${summary.dates?.[summary.explicit_date] || 0} items`
      : `Gathered ${Object.keys(summary.dates || {}).length} date(s): ` +
        Object.entries(summary.dates || {})
          .map(([d, n]) => `${d} (${n})`)
          .join(", ") || "No new items";
    const linkLine = summary.links_read_back != null ? ` | ${summary.links_read_back} source links written` : "";
    await sendGroupMessage(env, chatId, `✅ ${dateLine}${linkLine}`, replyTo);
  } catch (error) {
    await sendGroupMessage(
      env,
      chatId,
      `❌ Gather failed: ${String(error.message || error).slice(0, 300)}`,
      replyTo
    );
  }
}

export async function onRequestPost({ env, request }) {
  // 1. Validate the webhook secret token (set via setWebhook secret_token).
  const secretHeader = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (!env.TELEGRAM_WEBHOOK_SECRET || secretHeader !== env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response("forbidden", { status: 403 });
  }

  // 2. Transit-mode switch: nothing runs unless explicitly enabled.
  if (env.BACKUP_POSTING_ENABLED !== "1") {
    return json({ ok: true, skipped: "transit disabled" });
  }

  // 3. Parse the update.
  let update;
  try {
    update = await request.json();
  } catch {
    return json({ ok: true });
  }
  const message = update?.message;
  if (!message) return json({ ok: true });

  const chatId = message.chat?.id;
  if (String(chatId) !== String(env.BACKUP_TELEGRAM_CHAT_ID || "")) {
    return json({ ok: true }); // Not the transit group; ignore silently.
  }

  await ensureTables(env);

  const text = String(message.text || "").trim();

  // 4a. /gather commands: daily gather control from the group.
  if (text.startsWith("/gather")) {
    await handleGatherCommand(env, request, chatId, text, message.message_id);
    return json({ ok: true });
  }

  const urlMatch = text.match(/https?:\/\/[^\s]+/);

  // 4a. /testtitle dry run: run Qwen title generation + validation and
  //     reply with the result. Never ingests, never posts to the site.
  if (text.startsWith("/testtitle")) {
    const testBlurb = text.replace(/^\/testtitle\s*/, "").trim();
    if (!testBlurb) {
      await sendGroupMessage(
        env,
        chatId,
        "Send a blurb with the command, e.g. /testtitle GoTo posted a second straight quarterly profit.",
        message.message_id
      );
      return json({ ok: true });
    }
    const result = await generateHeadlineWithReason(env, testBlurb);
    const reply = result.ok
      ? `✅ Test title: ${result.headline}`
      : `❌ Title failed: ${result.reason}`;
    await sendGroupMessage(env, chatId, reply, message.message_id);
    return json({ ok: true });
  }

  // 4a. Plain text with no URL: treat it as the answer to a pending
  //     title request first, then a publisher-label question.
  if (!urlMatch) {
    const pendingTitle = await oldestPendingTitle(env);
    if (pendingTitle) {
      await processPendingTitle(env, request, chatId, message, pendingTitle);
      return json({ ok: true });
    }

    const pending = await oldestPending(env);
    if (!pending) {
      return json({ ok: true }); // No open question; stay silent.
    }
    const label = cleanLabelInput(text);
    if (!label) {
      await sendGroupMessage(
        env,
        chatId,
        `I still need a name for *${pending.domain}*. Reply with just the label (e.g. TechNode).`,
        message.message_id
      );
      return json({ ok: true });
    }
    await saveLabel(env, pending.domain, label);
    await markPendingProcessed(env, pending.id);
    await processPost(
      env,
      request,
      chatId,
      pending.url,
      pending.blurb,
      label,
      message.message_id,
      senderName(message),
      pending.supplied_headline || null
    );

    // If another unmapped publisher is queued, ask for the next label.
    const next = await oldestPending(env);
    if (next) {
      await sendGroupMessage(
        env,
        chatId,
        `New publisher: *${next.domain}*. How should I mention it? Reply with the name (e.g. TechNode).`,
        message.message_id
      );
    }
    return json({ ok: true });
  }

  // 4b. Message with a URL: extract the blurb and resolve the outlet.
  const parsedPost = parseRapidTransitPost(text, urlMatch);
  const { url, blurb, suppliedHeadline } = parsedPost;
  if (!blurb) {
    // Naked URL: one gentle nudge, then nothing. Unlike casual chat (which
    // stays silent), this is a malformed post, so a single prompt helps
    // avoid silently losing the story.
    await sendGroupMessage(
      env,
      chatId,
      "Add a blurb to post this story.",
      message.message_id
    );
    return json({ ok: true });
  }

  const domain = hostOf(url);
  const label = await resolveLabel(env, domain);

  if (label) {
    // Known publisher: process immediately.
    await processPost(env, request, chatId, url, blurb, label, null, senderName(message), suppliedHeadline);
    return json({ ok: true });
  }

  // Unmapped publisher: pause the post and ask the group for a label.
  const existing = await pendingAwaitingLabel(env, domain);
  if (!existing) {
    await env.ATR_FEED_DB.prepare(
      "INSERT INTO rapid_transit_pending (chat_id, url, blurb, domain, supplied_headline, status, created_at) VALUES (?, ?, ?, ?, ?, 'awaiting_label', strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))"
    ).bind(String(chatId), url, blurb, domain, suppliedHeadline || null).run();
  }
  await sendGroupMessage(
    env,
    chatId,
    `New publisher: *${domain}*. How should I mention it? Reply with the name (e.g. TechNode).`,
    message.message_id
  );

  return json({ ok: true });
}
