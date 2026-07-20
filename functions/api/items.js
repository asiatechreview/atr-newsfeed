import { STATIC_ITEMS } from "../_data/static-items.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1-9bPUuh73mgFWM1gDc_3qlTe_-VNZGrgRfWMApv8yxU/gviz/tq?tqx=out:csv&gid=0&headers=1";
const HEADLINE_OVERRIDES = new Map(Object.entries({
  "43": "SK warns AI memory crunch is getting political",
  "html-2026-07-16-034": "SoftBank's Son puts AI infra cost at $5tn a year",
  "19": "DeepSeek pushes China AI price war into enterprise adoption",
  "manual-telegram-2026-07-17-005": "DeepSeek pushes China AI price war into enterprise adoption",
  "manual-telegram-2026-07-17-004": "Montage faces South Korea competition probe",
  "manual-telegram-2026-07-16-008": "CXMT and YMTC face US chip ban push",
  "10": "BrainCo shows thought-controlled robots",
  "5": "Kioxia shares fall as memory rally fades",
  "6": "Malaysia probe puts Network School under pressure",
  "manual-telegram-2026-07-17-001": "DeepSeek valuation tops $51bn",
  "html-2026-07-16-041": "DeepSeek revenue nears $500m run rate",
  "md-2026-07-12-017": "SK Hynix jumps 13% in Nasdaq debut",
  "md-2026-07-08-014": "Iluvatar CoreX seeks $850m Hong Kong raise",
  "md-2026-07-06-015": "Biren seeks $892m for GPU push",
  "md-2026-07-05-002": "Micron starts $9.3bn Hiroshima expansion",
  "md-2026-06-30-005": "Japan backs Rakuten low-Earth orbit network"
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
  const value = String(text || "")
    .trim()
    .replace(/\bU\.S\./g, "US")
    .replace(/\bInc\./g, "Inc")
    .replace(/\bCo\./g, "Co")
    .replace(/\bLtd\./g, "Ltd");
  const match = value.match(/^(.+?[.!?])\s+/);
  return match ? match[1] : value;
}

function stripAttribution(text) {
  return String(text || "")
    .replace(/\s+\[[^\]]+\]\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function simplifyLeadPhrase(text) {
  return stripAttribution(text)
    .replace(/^(?:Chinese|Indian|Singapore-based|Japanese|South Korean|Indonesian|Taiwanese|Malaysian|Thai|Vietnamese|Philippine|Hong Kong|UAE|US|American)\s+(?:[\w-]+\s+){0,5}(?:startup|company|firm|chipmaker|operator|chain|platform|designer|developer|maker|group|giant|giants|supplier|data centre operator|fintech)\s+([A-Z0-9][A-Za-z0-9.&' -]{1,48})\s+/i, "$1 ")
    .replace(/^Japan’s\s+([A-Z0-9][A-Za-z0-9.&' -]{1,48})\s+/i, "$1 ")
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
    [/^Indonesia's planned copyright rewrite would grant copyright privileges.*?AI/i, "Indonesia weighs copyright rights for AI users"],
    [/^BrainCo\s+unveiled .*?brain-to-robot platform/i, "BrainCo shows thought-controlled robot platform"],
    [/^Kioxia\s+fell as much as\s+([0-9.]+%)/i, "Kioxia shares fall $1"],
    [/^South Korean authorities searched and seized materials from\s+(.+?)'s local office/i, "$1 faces South Korea competition probe"],
    [/^TSMC pledged .*?invest another\s+\$?([0-9.]+)\s*(billion|million|mn|m)\b.*?Arizona/i, (match) => `TSMC adds ${shortMoney(match[1], match[2])} Arizona pledge`],
    [/^Nvidia and four Japanese industrial automation companies.*?robot development/i, "Nvidia expands Japan robotics push"],
    [/^Hyundai will buy SoftBank's roughly\s+([0-9.]+%)\s+stake in\s+(.+?),/i, "Hyundai buys rest of Boston Dynamics"],
    [/^SBI Holdings and the Solana Foundation teamed up to build/i, "SBI and Solana team on Japan onchain market"],
    [/^India's Elevation Capital raised a\s+\$?([0-9.]+)\s*(billion|million|mn|m)\s+fund/i, (match) => `Elevation Capital raises ${shortMoney(match[1], match[2])} India fund`],
    [/^Shein executive chairman Donald Tang will step down/i, "Shein chair exits as IPO nears"],
    [/^China's integrated-circuit exports nearly doubled/i, "China chip exports nearly double"],
    [/^CXMT priced its Shanghai IPO/i, "CXMT prices Shanghai IPO"],
    [/^State-backed Chinese companies are setting up semiconductor funds/i, "China state firms set up chip funds"],
    [/^South Korea expects record tax revenue from .*?semiconductor boom/i, "Korea chip boom lifts tax outlook"],
    [/^TSMC will build two more advanced chip-packaging plants/i, "TSMC adds Taiwan chip-packaging plants"],
    [/^Indian startups are turning to Chinese open-weight models/i, "Indian startups turn to Chinese AI models"],
    [/^DoorDash, Siemens and Airbnb are among companies using Chinese AI models/i, "Global firms turn to Chinese AI models"],
    [/^Anthropic and OpenAI accused .*?Chinese firms of illicit model distillation/i, "US AI labs accuse China rivals of distillation"],
    [/^Samsung will bring forward the launch of its Yongin chip fabrication site to\s+([0-9-]+)/i, "Samsung pulls Yongin fab launch forward"],
    [/^India's semiconductor-device consumption is expected to rise from\s+\$?([0-9.]+)\s*(billion|million|mn|m)\s+in\s+([0-9]{4})\s+to\s+\$?([0-9.]+)\s*(billion|million|mn|m)\s+by\s+([0-9]{4})/i, (match) => `India chip demand seen hitting ${shortMoney(match[5], match[6])}`],
    [/^Taiwan's UMC began producing advanced photonics chips in Singapore/i, "UMC starts Singapore photonics chip output"],
    [/^Anthropic introduced India-specific rupee pricing/i, "Anthropic prices Claude locally in India"],
    [/^India asked domestic AI firms Sarvam and BharatGen to adapt/i, "India taps local AI labs for cyber work"],
    [/^Chinese AI founders including .*?moving away from frontier model competition/i, "China AI founders shift to vertical systems"],
    [/^DeepSeek founder Liang Wenfeng's net worth more than doubled to\s+\$?([0-9.]+)\s*(billion|million|mn|m)/i, (match) => `DeepSeek founder fortune jumps to ${shortMoney(match[1], match[2])}`],
    [/^Chinese regulators approved Apple Intelligence for iPhones/i, "Apple Intelligence clears China approvals"],
    [/^Chinese President Xi Jinping will attend WAIC/i, "Xi to make first WAIC appearance"],
    [/^Dongfang Suanxin, also known as DFSX, unveiled/i, "DFSX unveils domestic AI chip"],
    [/^MiniMax will showcase its M3 multimodal large model/i, "MiniMax brings M3 model to WAIC"],
    [/^Pakistan's top crypto regulator said digital assets should/i, "Pakistan crypto regulator urges case-by-case Islamic review"],
    [/^Japan's SBI Group will launch a lending service offering a\s+([0-9.]+%)\s+annual yield/i, "SBI launches JPYSC stablecoin lending"],
    [/^Saudi Arabia bought a record\s+\$?([0-9.]+)\s*(billion|million|mn|m)\s+worth of Taiwanese drones/i, (match) => `Saudi buys record ${shortMoney(match[1], match[2])} Taiwan drones`],
    [/^An EY-Parthenon analysis estimated Europe and the US would need to invest an extra\s+\$?([0-9.]+)\s*trillion/i, (match) => `West needs $${match[1]}tn to cut China reliance`],
    [/^Huawei plans to raise smartphone shipments by more than\s+([0-9.]+%)/i, "Huawei lifts smartphone shipment target"],
    [/^The Philippines' top outsourcing industry group cut its\s+([0-9]{4})\s+revenue and jobs forecasts/i, "Philippines BPO sector cuts 2028 forecast"],
    [/^Thinking Machines Lab released Inkling/i, "Thinking Machines releases Inkling model"],
    [/^CXMT is emerging as one of the world's most important chipmakers/i, "CXMT tests China's memory-chip ambitions"],
    [/^SK Hynix Inc\. raised\s+\$?([0-9.]+)\s*(billion|million|mn|m)/i, (match) => `SK Hynix raises ${shortMoney(match[1], match[2])} in US listing`],
    [/^China’s MiniMax is seeking to raise as much as\s+HK\$?([0-9.]+)\s*(billion|million|mn|m)/i, "MiniMax seeks $1.9bn Hong Kong raise"],
    [/^US investment firm Susquehanna .*?winding down its China/i, "Susquehanna winds down China venture arm"],
    [/^India’s JioStar, .*?is using OpenAI/i, "JioStar uses OpenAI for streaming search"],
    [/^India’s JioStar is using OpenAI/i, "JioStar uses OpenAI for streaming search"],
    [/^American companies have developed a growing reliance on cheaper Chinese AI models/i, "US companies lean on cheaper Chinese AI"],
    [/^US hospitals are increasingly hiring Filipino nurses/i, "US hospitals hire Filipino nurses for remote care"],
    [/^US lawmakers are weighing ways to curb American companies' growing use of Chinese AI models/i, "US lawmakers target China AI model use"],
    [/^Chinese companies plan to shift nearly half their AI accelerator budgets to domestic chips/i, "China firms shift AI chip budgets home"],
    [/^Chinese authorities have met with major tech firms/i, "China weighs limits on overseas AI access"],
    [/^Chinese smartphone sales fell\s+([0-9.]+%)/i, "China smartphone sales fall $1"],
    [/^Chinese AI models are winning over US companies/i, "Chinese AI models win over US companies"],
    [/^Chinese web novel platforms .*?cracking down on the AI tools/i, "China web fiction sites curb AI tools"],
    [/^Indian fintech Navi, .*?is preparing to file for an IPO/i, "Navi prepares IPO filing"],
    [/^Indian fintech Navi is preparing to file for an IPO/i, "Navi prepares IPO filing"],
    [/^Navi, .*?is preparing to file for an IPO/i, "Navi prepares IPO filing"],
    [/^Hong Kong has become a key gateway for high-tech goods/i, "Hong Kong becomes China tech-goods gateway"],
    [/^ShareChat, positioned as India's answer to Meta, plans to raise/i, "ShareChat plans IPO raise"],
    [/^South Korean trade watchdog alleges Google abused/i, "Korea watchdog accuses Google over app store"],
    [/^Indian serial entrepreneur Bhavin Turakhia is betting\s+\$?([0-9.]+)\s*(billion|million|mn|m)/i, (match) => `Bhavin Turakhia bets ${shortMoney(match[1], match[2])} on Neo`],
    [/^Xiaohongshu, known abroad as RedNote, is courting male users/i, "RedNote courts male users before Hong Kong IPO"],
    [/^Global creditors, .*?filed insolvency proceedings against .*?Udaan/i, "Udaan creditors file insolvency case"],
    [/^South Korean AI rout drags emerging stocks/i, "Korea AI rout hits emerging stocks"],
    [/^Indian VC firms face their toughest fundraising stretch/i, "Indian VCs face fundraising drought"],
    [/^Chinese chip material makers are ramping up production/i, "China chip-material firms ramp output"],
    [/^Taiwanese prosecutors detained two Super Micro Computer/i, "Taiwan detains Super Micro staff in probe"],
    [/^South Korean exports in June surged past\s+\$?([0-9.]+)\s*(billion|million|mn|m)/i, (match) => `Korea exports pass ${shortMoney(match[1], match[2])}`],
    [/^Chinese smartphone makers Xiaomi, Oppo and Vivo have told suppliers/i, "China phone makers cut shipment targets"],
    [/^Indian AI startup Rocket, .*?is in talks to raise\s+\$?([0-9]+)-([0-9]+)\s*(billion|million|mn|m)/i, (match) => `Rocket seeks $${match[1]}m-${match[2]}m round`],
    [/^Japanese startups are sidestepping the country's strict anti-gambling laws/i, "Japan startups test prediction-market rules"],
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
      if (typeof replacement === "function") {
        return replacement(match);
      }

      return replacement.includes("$") ? sentence.replace(pattern, replacement) : replacement;
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

  return trimWeakEnding(kept.length ? kept.join(" ") : words.slice(0, 8).join(" ")).replace(/[,:;.-]+$/, "");
}

function trimWeakEnding(text) {
  const weakEnding = /\b(?:a|an|the|to|for|from|of|in|on|at|by|with|into|as|and|or|but|after|before|while|amid|among|including|through|using|than|more|less|around|roughly|nearly|over|under|about|its|their|his|her|this|that|which|who|what|where|when|why|how|would|will|could|should|has|have|had|is|are|was|were|being|been|called|known|also|first|new)\s*$/i;
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);

  while (words.length > 4 && weakEnding.test(words.join(" "))) {
    words.pop();
  }

  return words.join(" ");
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
