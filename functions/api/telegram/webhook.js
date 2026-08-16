import { json } from "../../_lib/public-api.js";
import { SEED_CATEGORIES } from "../../_lib/categories.js";

// Backup posting webhook for the ATR bulletin site.
//
// A dedicated Telegram bot (TARS @Controlfreakjrbot) sits in a private
// "ATR backup posting" group. When Sai or Jon posts a URL plus a
// fact-checked blurb there, this Worker:
//   1. validates the Telegram webhook secret header;
//   2. checks the message came from the configured backup group;
//   3. extracts the URL and blurb, keeps the blurb verbatim;
//   4. posts the formatted copy (blurb + linked [Outlet]) back to the group;
//   5. ingests the item to the bulletin site via POST /api/items
//      (dedupe, headline guard and operational logging all live there);
//   6. confirms with a single 🟢.
//
// No LLM is involved anywhere in this path. It is a backup transport for
// when the normal Daily News Automation flow (through JR) is unavailable.

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

function outletName(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    for (const [domain, label] of Object.entries(OUTLET_MAP)) {
      if (host === domain || host.endsWith(`.${domain}`)) {
        return label;
      }
    }
    const parts = host.split(".");
    return parts.length >= 2 ? parts[parts.length - 2] : host;
  } catch {
    return "Source";
  }
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

async function sendGroupMessage(env, chatId, text) {
  const token = env.TELEGRAM_BACKUP_BOT_TOKEN;
  if (!token) return false;
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: true
      })
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function onRequestPost({ env, request }) {
  // 1. Validate the webhook secret token (set via setWebhook secret_token).
  const secretHeader = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (!env.TELEGRAM_WEBHOOK_SECRET || secretHeader !== env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response("forbidden", { status: 403 });
  }

  // 2. Backup-mode switch: nothing runs unless explicitly enabled.
  if (env.BACKUP_POSTING_ENABLED !== "1") {
    return json({ ok: true, skipped: "backup posting disabled" });
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
    return json({ ok: true }); // Not the backup group; ignore silently.
  }

  // 4. Extract URL and blurb from the message text. Messages without a
  //    valid URL+blurb pair are ignored silently: the group is a posting
  //    pipe, not a chat, so the bot stays quiet unless there is a real post.
  const text = String(message.text || "").trim();
  const urlMatch = text.match(/https?:\/\/[^\s]+/);
  if (!urlMatch) {
    return json({ ok: true });
  }
  const url = urlMatch[0].replace(/[),.;!?]+$/, "");
  const blurb = text.replace(urlMatch[0], "").trim();
  if (!blurb) {
    return json({ ok: true });
  }

  // 5. Build the formatted copy and post it back to the backup group.
  const outlet = outletName(url);
  const formatted = `${blurb} [[${outlet}](${url})]`;
  await sendGroupMessage(env, chatId, formatted);

  // 6. Ingest to the bulletin site. The /api/items endpoint owns dedupe
  //    (normalised source_url), the headline guard, category/tags fallbacks
  //    and operational logging, so we keep it as the single writer.
  const origin = new URL(request.url).origin;
  const category = inferCategory(blurb) || undefined;
  const ingestBody = {
    blurb,
    sourceName: outlet,
    sourceUrl: url,
    category,
    tags: [],
    postedBy: "telegram_backup_bot",
    postedVia: "telegram_backup_bot",
    status: "published"
  };

  try {
    const response = await fetch(`${origin}/api/items`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.FEED_INGEST_TOKEN || ""}`
      },
      body: JSON.stringify(ingestBody)
    });
    if (response.ok) {
      await sendGroupMessage(env, chatId, "🟢");
    } else {
      const detail = (await response.text()).slice(0, 200);
      await sendGroupMessage(
        env,
        chatId,
        `❌ Ingest failed (${response.status}). ${detail}`
      );
    }
  } catch (error) {
    await sendGroupMessage(env, chatId, `❌ Ingest error: ${String(error).slice(0, 200)}`);
  }

  return json({ ok: true });
}
