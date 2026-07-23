import { STATIC_ITEMS } from "../_data/static-items.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1-9bPUuh73mgFWM1gDc_3qlTe_-VNZGrgRfWMApv8yxU/gviz/tq?tqx=out:csv&gid=0&headers=1";
const HEADLINE_OVERRIDES = new Map(Object.entries({
  "43": "SK warns AI memory crunch is getting political",
  "html-2026-07-16-034": "SoftBank's Son puts AI infra cost at $5tn a year",
  "19": "DeepSeek pushes China AI price war into enterprise adoption",
  "manual-telegram-2026-07-17-005": "DeepSeek pushes China AI price war into enterprise adoption",
  "42": "01.ai lines up Hong Kong IPO push",
  "40": "Offline AI device targets Indian language gap",
  "39": "Upbit operator faces sanctions over $30m hack",
  "38": "Hugging Face breach tests AI response",
  "37": "Alibaba says Qwen3.8 Max narrows AI gap",
  "36": "G42 spy saga shows UAE's AI balancing act",
  "35": "Singapore weighs tax cuts for fund hub",
  "34": "Moonshot eyes Hong Kong IPO at $30bn+",
  "33": "Alibaba opens stack for Zhenwu AI chips",
  "32": "ZTE launches Doubao-powered AI phone",
  "31": "Japan backs sovereign AI with Nvidia Rubin",
  "30": "AI tokens become workplace currency in China",
  "29": "Biren scales AI clusters with optics",
  "28": "China starts space-computing satellite network",
  "27": "Open-weight models narrow cyber capability gap",
  "26": "China rejects US model-distillation claims",
  "24": "SBI completes Coinhako deal in Singapore",
  "23": "Kimi K3 stirs China-stack debate",
  "22": "Rapidus adds Cadence AI tools for chip design",
  "21": "Shein clears Hong Kong IPO review",
  "20": "Kimi K3 shock hits AI chip stocks",
  "18": "India resets chip incentives",
  "17": "CXMT IPO draws huge retail demand",
  "16": "Kioxia hit with $229m patent verdict",
  "15": "India may revive UPI fees",
  "14": "BitShine ringleader gets 22 years",
  "13": "Coupang fine strains US-South Korea ties",
  "12": "Zepto IPO interest cools below peak",
  "11": "Indonesia AI copyright rewrite advances",
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
  "md-2026-06-30-005": "Japan backs Rakuten low-Earth orbit network",
  "html-2026-07-16-002": "PixVerse raises $439m at $2bn valuation",
  "html-2026-07-16-003": "LimX Dynamics raises $200m before IPO",
  "html-2026-07-16-006": "TSMC sales jump 36% on AI demand",
  "html-2026-07-16-007": "SK Hynix falls 15% after Nasdaq debut",
  "html-2026-07-16-008": "Shein targets $40bn valuation for Hong Kong IPO",
  "html-2026-07-16-010": "InsuranceDekho plans $300m India IPO",
  "html-2026-07-16-011": "Samsung weighs US depositary receipt sale",
  "html-2026-07-16-013": "DeepSeek starts IPO preparations",
  "html-2026-07-16-014": "CXMT nears $8.5bn Shanghai IPO",
  "html-2026-07-16-017": "Xi puts WAIC at centre of China AI push",
  "html-2026-07-16-024": "India chip demand seen hitting $130bn",
  "html-2026-07-16-027": "DFSX maps out China AI chip roadmap",
  "html-2026-07-16-030": "Nvidia cuts Asian AI chip buyer list",
  "html-2026-07-16-031": "DeepSeek weighs $71bn funding round",
  "html-2026-07-16-033": "Tower Semiconductor plans $3bn Japan expansion",
  "html-2026-07-16-035": "Google expands India AI initiatives",
  "html-2026-07-16-036": "Japan electronics giants chase AI demand",
  "html-2026-07-16-037": "Nvidia starts H200 chip shipments to China",
  "html-2026-07-16-038": "ByteDance shuts Doubao AI personas",
  "html-2026-07-16-040": "XPeng plans global humanoid robot launch",
  "html-2026-07-16-042": "Oracle leads Japan secure cloud race",
  "html-2026-07-16-043": "India adds $19.7bn for chips and phones",
  "html-2026-07-16-044": "Viettel chip fab lifts Hanoi investment",
  "html-2026-07-16-045": "WAIC lines up 300 product debuts",
  "html-2026-07-16-047": "Huawei brings Atlas 950 SuperPoD to WAIC",
  "html-2026-07-16-050": "StepFun brings AI phone to WAIC",
  "html-2026-07-16-051": "Alibaba and Honor deepen AI phone partnership",
  "html-2026-07-16-052": "WAIC spotlights chips and humanoid robots",
  "html-2026-07-16-053": "Matwings previews AI protein-design platform",
  "html-2026-07-16-056": "SCB X pushes deeper into Thai virtual banking",
  "html-2026-07-16-058": "Thailand audits high-volume stablecoin flows",
  "html-2026-07-16-061": "Huawei energy unit gains Brazil storage project",
  "html-2026-07-16-063": "Singapore court keeps Byju founder jail risk alive",
  "html-2026-07-16-064": "Malaysia opens Network School immigration probe",
  "html-2026-07-16-066": "Famitsu marks 40 years of Japan games coverage",
  "html-2026-07-16-067": "Bangladesh makes Bangla QR mandatory",
  "html-2026-07-16-068": "Amazon builds China export warehouses",
  "html-2026-07-16-069": "Malaysia clears Network School residents' documents",
  "manual-telegram-2026-07-16-001": "Taiwan builds TAIDE to protect local AI language",
  "md-2026-07-12-001": "Nexchip raises $890m in Hong Kong listing",
  "md-2026-07-12-003": "SK Hynix raises record $26.5bn in US listing",
  "md-2026-07-12-004": "MiniMax seeks $1.9bn Hong Kong raise",
  "md-2026-07-12-005": "Amazon USB listings face fake-storage flags",
  "md-2026-07-12-006": "Tencent moves to take control of Manus",
  "md-2026-07-12-007": "MiniMax CEO gives up salary until AGI",
  "md-2026-07-12-008": "Nanya plans $6.2bn memory-chip capex",
  "md-2026-07-12-009": "SoftBank eyes Seven & i investment",
  "md-2026-07-12-010": "India clears Vivo-Dixon manufacturing venture",
  "md-2026-07-12-013": "Shein clears Beijing review for Hong Kong IPO",
  "md-2026-07-12-014": "SK Hynix warns memory shortage may worsen",
  "md-2026-07-12-015": "SK Hynix US debut jumps 13%",
  "md-2026-07-12-016": "China drops urban jobs target",
  "md-2026-07-12-019": "Chinese AI tools gain after Claude Code alarm",
  "md-2026-07-09-001": "China lets top AI firms buy Nvidia H200s",
  "md-2026-07-09-003": "Bain exits Kioxia after record returns",
  "md-2026-07-09-004": "Luxshare raises $3.1bn in Hong Kong listing",
  "md-2026-07-09-007": "LG plans $1bn Vietnam chip-packaging plant",
  "md-2026-07-09-009": "CXMT opens subscriptions for $5bn Shanghai IPO",
  "md-2026-07-09-010": "SK Hynix US listing demand surges",
  "md-2026-07-09-011": "India scraps electronics component import duties",
  "md-2026-07-09-012": "Nilekani steps back from Fundamentum",
  "md-2026-07-09-013": "WizCommerce raises $8.3m from existing backers",
  "md-2026-07-09-016": "Thailand approves $2bn in AI and tech projects",
  "md-2026-07-09-018": "CarDekho parent readies $360m IPO filing",
  "md-2026-07-08-001": "Google Cloud brings AI models to India",
  "md-2026-07-08-002": "MoMo stake sale draws Blackstone and CVC",
  "md-2026-07-08-003": "MiniMax readies 2.7tn-parameter M3 Pro",
  "md-2026-07-08-004": "Temasek leans further into AI and private credit",
  "md-2026-07-08-005": "China database flags Claude Code backdoor risk",
  "md-2026-07-08-006": "Zetrix wins Philippine blockchain role",
  "md-2026-07-08-009": "Hesai blacklisting tests China lidar sector",
  "md-2026-07-08-011": "India regulators press for tighter crypto curbs",
  "md-2026-07-08-012": "Momenta Hong Kong debut ends flat",
  "md-2026-07-08-013": "Korea stocks slide on chip deal worries",
  "md-2026-07-08-015": "Zhipu seeks $4bn after Hong Kong surge",
  "md-2026-07-07-002": "LG profit seen jumping 150% on tariff refund",
  "md-2026-07-07-004": "Tencent sells $1.5bn Kuaishou stake",
  "md-2026-07-07-005": "Tencent launches efficient Hy3 AI model",
  "md-2026-07-07-006": "Telegram becomes paid abuse-image hub",
  "md-2026-07-07-009": "B Capital closes $500m early-stage fund",
  "md-2026-07-06-001": "Korea plans chip-tax investment fund",
  "md-2026-07-06-002": "US judge gives Alibaba Pentagon reprieve",
  "md-2026-07-06-003": "Samsung union bonus win splits workers",
  "md-2026-07-06-004": "Doubao and Qwen shut custom AI agents",
  "md-2026-07-06-006": "Singapore adds laundering charges in AI chip case",
  "md-2026-07-06-007": "Even Realities raises $150m for smart glasses",
  "md-2026-07-06-010": "Luxshare set to raise $3.1bn in Hong Kong",
  "md-2026-07-06-011": "Ather Energy eyes $200m share sale",
  "md-2026-07-06-012": "SEA tech funding doubles to $7.4bn",
  "md-2026-07-06-014": "Tokyo Artisan plans custom AI chip production",
  "md-2026-07-06-017": "China robotaxi firms lead $1tn market forecast",
  "md-2026-07-05-001": "China widens draft e-commerce law",
  "md-2026-07-05-003": "India tells Telegram to tighten piracy takedowns",
  "md-2026-07-05-004": "ByteDance's Seedance makes Hollywood inroads",
  "md-2026-07-04-001": "Kioxia ships next-generation 3D flash samples",
  "md-2026-07-04-003": "Yotta Data seeks $1bn expansion raise",
  "md-2026-07-04-004": "Alibaba bars staff from Claude Code",
  "md-2026-07-04-005": "Anthropic closes China access loopholes",
  "md-2026-07-04-006": "China quant funds surge on AI adoption",
  "md-2026-07-04-007": "Unitree clears Shanghai listing review",
  "md-2026-07-04-008": "GoDaddy warns India web crackdown may backfire",
  "md-2026-07-04-009": "India summons Meta over abusive Instagram ads",
  "md-2026-07-04-010": "BBC finds abuse ads running on Instagram",
  "md-2026-07-04-011": "India investigates Tata Electronics data breach",
  "md-2026-07-04-012": "Azalea launches $350m evergreen PE fund",
  "md-2026-07-02-002": "Sparrow Capital closes third India fund",
  "md-2026-07-02-003": "Alibaba settles US drug-sales probe for $600m",
  "md-2026-07-02-006": "Krafton settles Unknown Worlds bonus dispute",
  "md-2026-07-02-007": "India tells Meta to pause WhatsApp usernames",
  "md-2026-07-02-008": "BlaBlaCar expands across Southeast Asia",
  "md-2026-07-02-010": "SK Hynix plans $64bn Cheongju chip investment",
  "md-2026-07-02-011": "Microsoft backs India-Southeast Asia cable",
  "md-2026-07-02-012": "Apple weighs buying memory chips from CXMT",
  "md-2026-07-02-016": "SoftBank prepares US AI cloud rental push",
  "md-2026-07-02-017": "Z.ai launches GLM-powered coding app",
  "md-2026-07-02-018": "Z.ai narrows gap with US AI rivals",
  "md-2026-07-02-019": "Skyroot prepares Vikram-1 orbital launch",
  "md-2026-07-02-020": "India backs offline multilingual AI devices",
  "md-2026-07-01-001": "Thailand startup law expected by year-end",
  "md-2026-07-01-002": "Japan puts startups inside $2.3tn tech strategy",
  "md-2026-07-01-003": "Joby and Toyota form air taxi JV",
  "md-2026-07-01-007": "Singapore seizes mansion in AI chip probe",
  "md-2026-07-01-008": "Anthropic rolls back Claude Code tracking",
  "md-2026-07-01-010": "Dream Sports shuts Dream Money within a year",
  "md-2026-07-01-011": "ByteDance picks Brazil for largest overseas data centre",
  "md-2026-07-01-012": "Korea refers crypto manipulation suspects to prosecutors",
  "md-2026-07-01-013": "G-Group plans $300m Vietnam AI data centre",
  "md-2026-07-01-014": "Ant International opens Kuala Lumpur development centre",
  "md-2026-07-01-015": "Shanghai court jails crypto money-movers",
  "md-2026-07-01-016": "Amity Robotics raises $7m seed round",
  "md-2026-07-01-017": "Taiwan passes crypto regulation framework",
  "md-2026-07-01-018": "Acti raises $5.3m for agentic keyboard",
  "md-2026-07-01-019": "Japan backs Noetra AI model with $6.2bn",
  "md-2026-07-01-020": "UBTech launches consumer humanoid robot",
  "md-2026-07-01-022": "Beijing sets industrial internet roadmap",
  "md-2026-07-01-023": "Kling AI nears $3bn funding round",
  "md-2026-07-01-024": "US-China AI race jolts work and markets",
  "md-2026-07-01-025": "India startup funding reaches $7.4bn in H1",
  "md-2026-06-30-002": "Luxshare launches $3.1bn Hong Kong IPO",
  "md-2026-06-30-001": "Taiwan raids Super Micro offices in chip probe",
  "md-2026-06-30-003": "Tencent buybacks follow $309bn selloff",
  "md-2026-06-30-004": "Japan ride-hailing reform stalls again",
  "md-2026-06-30-006": "US lobbyists drop Chinese tech clients",
  "md-2026-06-30-007": "Indonesia jails Gojek founder Nadiem Makarim",
  "md-2026-06-30-008": "Qashier raises $6.1m for SEA expansion",
  "md-2026-06-30-009": "Akro raises $700,000 pre-seed round",
  "md-2026-06-30-010": "Igloo buys Eazy Digital in insurtech push",
  "md-2026-06-30-011": "Japan startup visa rules hit applications",
  "md-2026-06-30-012": "NeoPulse consortium nears Wemade stake deal",
  "md-2026-06-30-013": "Guo Wengui gets 30 years for crypto fraud",
  "md-2026-06-30-014": "OYO parent PRISM refiles IPO papers",
  "md-2026-06-30-015": "Meituan open-sources LongCat AI model",
  "md-2026-06-30-016": "Five China firms seek $5.6bn in Hong Kong",
  "md-2026-06-30-018": "OYO parent revives $703m IPO plan",
  "md-2026-06-29-003": "AirTrunk nears Singapore REIT filing",
  "md-2026-06-29-001": "Vietnam raises fines for online fabrications",
  "md-2026-06-29-004": "Apple challenges India antitrust probe",
  "md-2026-06-29-005": "CXMT signs $2.9bn Tencent DRAM deal",
  "md-2026-06-29-006": "China robotics startups hit $2.9bn valuations",
  "md-2026-06-29-007": "DJI and Insta360 squeeze GoPro in cameras",
  "md-2026-06-29-008": "Momenta launches $751m Hong Kong IPO",
  "md-2026-06-29-010": "ByteDance targets 2027 in-house CPU rollout",
  "md-2026-06-29-012": "US tightens Chinese tech import ban"
}));

for (const [id, headline] of HEADLINE_OVERRIDES) {
  HEADLINE_OVERRIDES.set(id, normalizeHeadlineMoney(headline));
}

export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || DEFAULT_LIMIT, MAX_LIMIT);
  const category = url.searchParams.get("category");
  const date = parseDateParam(url.searchParams.get("date"));

  let query = "SELECT id, headline, blurb, source_name, source_url, category, telegram_message_id, published_at, created_at FROM feed_items WHERE status = ?";
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
    d1Items = await loadD1ItemsWithoutHeadline({ env, category });
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
    const storedHeadline = clean(item.headline || item.Headline || item.title);
    const headline = normalizeHeadlineMoney(storedHeadline || headlineForItem(item));
    return {
      ...item,
      headline,
      headline_source: storedHeadline ? "stored" : "generated"
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
  if (!isAuthorized(env, request)) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const blurb = clean(body.blurb);
  const headline = clean(body.headline || body.title);
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

  if (headline && isWeakHeadline(headline)) {
    return json({ error: "headline must be a clean ATR-style scan title" }, 400);
  }

  await ensureHeadlineColumn(env);

  const result = await env.ATR_FEED_DB.prepare(
    `INSERT INTO feed_items
      (headline, blurb, source_name, source_url, category, telegram_message_id, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     RETURNING id, headline, blurb, source_name, source_url, category, telegram_message_id, published_at, created_at`
  )
    .bind(headline || null, blurb, sourceName, sourceUrl, category, telegramMessageId || null, publishedAt)
    .first();

  return json({ item: withHeadlines([result])[0] }, 201);
}

export async function onRequestPatch({ env, request }) {
  if (!isAuthorized(env, request)) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return json({ error: "id is required" }, 400);
  }

  const current = await env.ATR_FEED_DB.prepare(
    "SELECT id, headline, blurb, source_name, source_url, category, telegram_message_id, published_at, created_at FROM feed_items WHERE id = ? AND status = ?"
  )
    .bind(id, "published")
    .first();

  if (!current) {
    return json({ error: "item not found" }, 404);
  }

  const headline = body.headline || body.title;
  const blurb = body.blurb;
  const sourceName = body.sourceName || body.source_name;
  const sourceUrl = body.sourceUrl || body.source_url;

  if (headline === undefined && blurb === undefined && sourceName === undefined && sourceUrl === undefined) {
    return json({ error: "headline, blurb, sourceName or sourceUrl is required" }, 400);
  }

  const nextHeadline = headline === undefined ? current.headline : clean(headline);
  const nextBlurb = blurb === undefined ? current.blurb : clean(blurb);
  const nextSourceName = sourceName === undefined ? current.source_name : clean(sourceName);
  const nextSourceUrl = sourceUrl === undefined ? current.source_url : clean(sourceUrl);

  if (!nextBlurb) {
    return json({ error: "blurb is required" }, 400);
  }

  if (nextHeadline && isWeakHeadline(nextHeadline)) {
    return json({ error: "headline must be a clean ATR-style scan title" }, 400);
  }

  if (nextSourceUrl && !/^https?:\/\//i.test(nextSourceUrl)) {
    return json({ error: "sourceUrl must be an http(s) URL" }, 400);
  }

  const result = await env.ATR_FEED_DB.prepare(
    `UPDATE feed_items
       SET headline = ?, blurb = ?, source_name = ?, source_url = ?
     WHERE id = ? AND status = ?
     RETURNING id, headline, blurb, source_name, source_url, category, telegram_message_id, published_at, created_at`
  )
    .bind(nextHeadline || null, nextBlurb, nextSourceName, nextSourceUrl, id, "published")
    .first();

  return json({ item: withHeadlines([result])[0] });
}

function isAuthorized(env, request) {
  const auth = request.headers.get("authorization") || "";
  const expected = env.FEED_INGEST_TOKEN ? `Bearer ${env.FEED_INGEST_TOKEN}` : "";

  return Boolean(expected && auth === expected);
}

async function loadD1ItemsWithoutHeadline({ env, category }) {
  let query = "SELECT id, blurb, source_name, source_url, category, telegram_message_id, published_at, created_at FROM feed_items WHERE status = ?";
  const params = ["published"];

  if (category) {
    query += " AND category = ?";
    params.push(category);
  }

  query += " ORDER BY published_at DESC, id DESC LIMIT ?";
  params.push(MAX_LIMIT);

  try {
    const result = await env.ATR_FEED_DB.prepare(query).bind(...params).all();
    return result.results || [];
  } catch {
    return [];
  }
}

async function ensureHeadlineColumn(env) {
  try {
    await env.ATR_FEED_DB.prepare("ALTER TABLE feed_items ADD COLUMN headline TEXT").run();
  } catch {
    // D1 throws once the column already exists. The POST insert/readback below is the real verification.
  }
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isWeakHeadline(headline) {
  const value = clean(headline).replace(/\bU\.S\./g, "US");
  const words = value.split(/\s+/).filter(Boolean);

  if (!value) return true;
  if (value.length > 72) return true;
  if (words.length < 4 || words.length > 14) return true;
  if (/\$[0-9][0-9.,]*(?:\.[0-9]+)?(?:m|bn|tn)\+?\b/.test(value)) return true;
  if (/\b(?:a|an|the|to|for|from|of|in|on|at|by|with|into|as|and|or|but|after|before|while|amid|among|including|through|using|than|more|less|around|roughly|nearly|over|under|about|its|their|his|her|this|that|which|who|what|where|when|why|how|would|will|could|should|has|have|had|is|are|be|was|were|being|been|called|known|also|first|new|world's|yuan|chipmaker|prime minister anwar)\s*$/i.test(value)) return true;
  if (/\$[0-9.]+$/.test(value)) return true;
  if (/\b(?:is in talks|has held talks|has started preparing|is preparing|plans to file|will show|will debut|are expected|are set to be|is previewing|is pushing|began auditing|declined to stay|opened an immigration|marked its|launched a nationwide|is building|said residents|begins trading|told staff|plans to spend|approved a manufacturing|has been supplying|has won|raised a \$|targeted a valuation|reported a |closed down|outlined several|are leaning|begins shipping|is shutting|pledged another|will feature|has closed|has told Meta|is expanding|will invest|are leading|is in talks to buy|will begin renting|launched ZCode|has narrowed|has referred|sentenced five|has passed|will pour|has laid out|is nearing|launches investor|has ramped|has stalled|jailed former|announced|has filed|has open-sourced|launched Hong|finalized rules|has accused|has signed|now account|aims to finalize|will tighten|has chosen)\b/i.test(value)) return true;
  if (/^(?:Sources:|A look at|How |More numbers|India:)/i.test(value)) return true;
  if (/\b(?:inside the story|The Economic Times|surfacing|front and center)\b/i.test(value)) return true;
  if (/(?:\$[0-9.]+ billion|[0-9]+ trillion rupees|T\$|HK\$|\bRs\s)/i.test(value)) return true;

  return false;
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
  const suffix = normalizedUnit.startsWith("t") ? "T" : normalizedUnit.startsWith("b") ? "B" : "M";
  return `$${amount}${suffix}`;
}

function normalizeHeadlineMoney(value) {
  return String(value || "")
    .replace(/\$([0-9][0-9.,]*(?:\.[0-9]+)?)bn\b/gi, "$$$1B")
    .replace(/-([0-9][0-9.,]*(?:\.[0-9]+)?)bn\b/gi, "-$1B")
    .replace(/\$([0-9][0-9.,]*(?:\.[0-9]+)?)m\b/gi, "$$$1M")
    .replace(/-([0-9][0-9.,]*(?:\.[0-9]+)?)m\b/gi, "-$1M")
    .replace(/\$([0-9][0-9.,]*(?:\.[0-9]+)?)tn\b/gi, "$$$1T");
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
    [/^India's semiconductor-device consumption is expected to rise from\s+\$?([0-9.]+)\s*(billion|million|mn|m)\s+in\s+([0-9]{4})\s+to\s+\$?([0-9.]+)\s*(billion|million|mn|m)\s+by\s+([0-9]{4})/i, (match) => `India chip demand seen hitting ${shortMoney(match[4], match[5])}`],
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
