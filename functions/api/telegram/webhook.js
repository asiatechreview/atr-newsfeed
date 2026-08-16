import { json } from "../../_lib/public-api.js";
import { SEED_CATEGORIES } from "../../_lib/categories.js";

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
//   5. posts the formatted copy (blurb + linked [Outlet]) back to the group;
//   6. ingests the item to the bulletin site via POST /api/items
//      (dedupe, headline guard and operational logging all live there);
//   7. confirms with a single 🟢.
//
// No LLM is involved anywhere in this path. It is a transport pipeline that
// works even when the normal Daily News Automation flow (through JR) is
// unavailable.

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
      status TEXT NOT NULL DEFAULT 'awaiting_label',
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    )`
  ).run();
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

async function markPendingProcessed(env, id) {
  if (!env?.ATR_FEED_DB) return;
  await env.ATR_FEED_DB.prepare(
    "UPDATE rapid_transit_pending SET status = 'processed' WHERE id = ?"
  ).bind(id).run();
}

function inferCategory(blurb) {
  const text = String(blurb || "").toLowerCase();
  for (const rule of SEED_CATEGORIES || []) {
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

async function sendGroupMessage(env, chatId, text, replyTo = null) {
  const token = env.TELEGRAM_BACKUP_BOT_TOKEN;
  if (!token) return false;
  try {
    const body = {
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      disable_web_page_preview: true
    };
    if (replyTo) body.reply_to_message_id = replyTo;
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    return response.ok;
  } catch {
    return false;
  }
}

const HEADLINE_STYLE = `You write scan-first headlines for ATR (Asia Tech Review).
Rules:
- 7-13 words, 35-60 characters.
- Lead with company/country + concrete action. Present tense.
- KEEP the key number or stat from the blurb (financing size, downloads, valuation, percent, robots sold, etc). The number is the news.
- Compress everything else. NEVER add facts not in the blurb.
- No "The" unless essential. No trailing period.
- Examples: "DeepSeek pushes China AI price war into enterprise adoption", "Unitree raises $904m in STAR Market IPO", "Alibaba Qwen models pass 3bn global downloads".
- Output ONLY the headline.`;

function cleanHeadlineOutput(value) {
  return String(value || "")
    .replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, "")
    .replace(/^Headline:?\s*/i, "")
    .replace(/\.+$/g, "")
    .trim();
}

function headlineLooksValid(headline) {
  const value = cleanHeadlineOutput(headline);
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length < 4 || words.length > 14) return false;
  if (value.length > 72) return false;
  if (/\$[0-9.]+$/.test(value)) return false;
  if (/\b(?:a|an|the|to|for|from|of|in|on|at|by|with|into|as|and|or|but|after|before|while|amid|among|including|through|using|than|more|less|around|roughly|nearly|over|under|about|its|their|his|her|this|that|which|who|what|where|when|why|how|would|will|could|should|has|have|had|is|are|be|was|were|being|been|called|known|also|first|new)\s*$/i.test(value)) return false;
  return true;
}

async function generateHeadline(env, blurb) {
  const account = env.WORKERS_AI_ACCOUNT_ID;
  const token = env.WORKERS_AI_TOKEN;
  if (!account || !token) return null;

  try {
    const body = JSON.stringify({
      messages: [
        { role: "system", content: HEADLINE_STYLE },
        { role: "user", content: `Blurb: ${blurb}\n\nWrite the headline.` }
      ],
      max_tokens: 80,
      temperature: 0.3
    });
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`
        },
        body
      }
    );
    if (!response.ok) return null;
    const payload = await response.json();
    const result = payload?.result || {};
    const choices = result.choices || [];
    const text = choices.length
      ? choices[0].message.content
      : result.response;
    const headline = cleanHeadlineOutput(text);
    return headlineLooksValid(headline) ? headline : null;
  } catch {
    return null;
  }
}

async function ingestItem(env, request, { blurb, url, label, headline }) {
  const origin = new URL(request.url).origin;
  const category = inferCategory(blurb) || undefined;
  const ingestBody = {
    blurb,
    sourceName: label,
    sourceUrl: url,
    category,
    tags: [],
    postedBy: "telegram_rapid_transit",
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

  if (response.ok) return { ok: true };
  return { ok: false, detail: (await response.text()).slice(0, 200), status: response.status };
}

async function processPost(env, request, chatId, url, blurb, label, replyTo = null) {
  const formatted = `${blurb} [[${label}](${url})]`;
  await sendGroupMessage(env, chatId, formatted, replyTo);

  // Generate a scan-first headline from the supplied blurb. This is
  // compression, not creation: the blurb is the only input, so no new facts
  // can appear. If the LLM is unavailable or produces an invalid headline,
  // we ingest without one and the site derives a mechanical title.
  const headline = await generateHeadline(env, blurb);

  const result = await ingestItem(env, request, { blurb, url, label, headline });
  if (result.ok) {
    await sendGroupMessage(env, chatId, "🟢");
  } else {
    await sendGroupMessage(
      env,
      chatId,
      `❌ Ingest failed (${result.status || "error"}). ${result.detail || ""}`
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
  const urlMatch = text.match(/https?:\/\/[^\s]+/);

  // 4a. Plain text with no URL: treat it as the answer to a pending
  //     "how should I mention this publisher?" question.
  if (!urlMatch) {
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
    await processPost(env, request, chatId, pending.url, pending.blurb, label, message.message_id);

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
  const url = urlMatch[0].replace(/[),.;!?]+$/, "");
  const blurb = text.replace(urlMatch[0], "").trim();
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
    await processPost(env, request, chatId, url, blurb, label);
    return json({ ok: true });
  }

  // Unmapped publisher: pause the post and ask the group for a label.
  const existing = await pendingAwaitingLabel(env, domain);
  if (!existing) {
    await env.ATR_FEED_DB.prepare(
      "INSERT INTO rapid_transit_pending (chat_id, url, blurb, domain, status, created_at) VALUES (?, ?, ?, ?, 'awaiting_label', strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))"
    ).bind(String(chatId), url, blurb, domain).run();
  }
  await sendGroupMessage(
    env,
    chatId,
    `New publisher: *${domain}*. How should I mention it? Reply with the name (e.g. TechNode).`,
    message.message_id
  );

  return json({ ok: true });
}
