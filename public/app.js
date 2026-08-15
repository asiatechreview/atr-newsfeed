const feed = document.querySelector("#feed-list");
const status = document.querySelector("#feed-status");
const archiveNav = document.querySelector("#archive-nav") || document.createElement("nav");
const pagination = document.querySelector("#pagination");
const searchForm = document.querySelector("#search-form");
const searchInput = document.querySelector("#search-input");
const signalMetrics = document.querySelector("#signal-metrics");
const themeToggle = document.querySelector("#theme-toggle");
const newItemToast = document.querySelector("#new-item-toast");
const newItemToastTitle = document.querySelector("#new-item-toast-title");
const newItemToastMeta = document.querySelector("#new-item-toast-meta");
const newItemToastRead = document.querySelector("#new-item-toast-read");
const newItemToastClose = document.querySelector("#new-item-toast-close");
const watchlist = document.querySelector("#watchlist");
const watchlistHeadline = document.querySelector("#watchlist-headline");
const watchlistBlurb = document.querySelector("#watchlist-blurb");
const dateTemplate = document.querySelector("#date-template");
const itemTemplate = document.querySelector("#item-template");

// Stop the browser from restoring the old scroll position on reload, so
// navigation between views always starts at the top of the page.
if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

function scrollFeedToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}
const ITEMS_PER_PAGE = 15;
const VISIBLE_PAGE_BUTTONS = 8;
const ARCHIVE_DAYS = 5;
const FEED_POLL_INTERVAL_MS = 10 * 60 * 1000;
const NEW_ITEM_TOAST_TIMEOUT_MS = 9000;
const LOCAL_TIME_ZONE = getLocalTimeZone();
const THEME_STORAGE_KEY = "atr-bulletin-theme";
const SHOW_WATCHLIST = false;
const FEATURED_ITEM_ID = "manual-telegram-2026-07-17-005";
const FEATURED_SOURCE_URL = "https://www.bloomberg.com/news/newsletters/2026-07-17/china-can-still-win-the-ai-race-with-inferior-technology";
const HEADLINE_OVERRIDES = new Map(Object.entries({
  "19": "DeepSeek pushes China AI price war into enterprise adoption",
  "43": "SK warns AI memory crunch is getting political",
  "html-2026-07-16-034": "SoftBank's Son puts AI infra cost at $5tn a year",
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
  "19": "DeepSeek pushes China AI price war into enterprise adoption",
  "18": "India resets chip incentives",
  "17": "CXMT IPO draws huge retail demand",
  "16": "Kioxia hit with $229m patent verdict",
  "15": "India may revive UPI fees",
  "14": "BitShine ringleader gets 22 years",
  "13": "Coupang fine strains US-South Korea ties",
  "12": "Zepto IPO interest cools below peak",
  "11": "Indonesia AI copyright rewrite advances",
  "10": "BrainCo shows thought-controlled robots",
  "manual-telegram-2026-07-17-004": "Montage faces South Korea competition probe",
  "manual-telegram-2026-07-16-008": "CXMT and YMTC face US chip ban push",
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

let allItems = [];
let currentPage = getRequestedPage();
let currentDateFilter = getRequestedDateFilter();
let currentTagFilter = getRequestedTagFilter();
let currentSearchQuery = getRequestedSearchQuery();
let feedPollTimer = null;
let isFetchingFeed = false;
let newItemToastTimer = null;
let pendingToastItem = null;
let requestedItemId = getRequestedItemParam();

function getLocalTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch (error) {
    return "";
  }
}

function localTimeOptions(options = {}) {
  return LOCAL_TIME_ZONE ? { ...options, timeZone: LOCAL_TIME_ZONE } : options;
}

const THEMES = ["light", "dark", "amoled"];

function getStoredTheme() {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (THEMES.includes(stored)) {
      return stored;
    }
  } catch (error) {
    // localStorage unavailable; fall through to system preference.
  }
  // First visit: default to dark regardless of the reader's system theme.
  return "dark";
}

function setStoredTheme(theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    // Some privacy modes block localStorage; the toggle still works for this page load.
  }
}

function applyTheme(theme) {
  const normalizedTheme = THEMES.includes(theme) ? theme : "dark";
  document.documentElement.dataset.theme = normalizedTheme;

  if (!themeToggle) {
    return;
  }

  const nextTheme = THEMES[(THEMES.indexOf(normalizedTheme) + 1) % THEMES.length];
  themeToggle.setAttribute("aria-label", `Switch to ${nextTheme} mode`);
  themeToggle.setAttribute("aria-pressed", normalizedTheme === "light" ? "true" : "false");
}

function initThemeToggle() {
  applyTheme(getStoredTheme());

  if (!themeToggle) {
    return;
  }

  themeToggle.addEventListener("click", () => {
    const current = document.documentElement.dataset.theme;
    const nextTheme = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
    applyTheme(nextTheme);
    setStoredTheme(nextTheme);
  });
}

const FONT_SCALE_KEY = "atr-bulletin-font-scale";
const FONT_SCALE_MIN = 0.85;
const FONT_SCALE_MAX = 1.3;
const FONT_SCALE_STEP = 0.05;

function getStoredFontScale() {
  try {
    const raw = window.localStorage.getItem(FONT_SCALE_KEY);
    const value = raw ? Number(raw) : 1;
    if (Number.isFinite(value)) {
      return Math.min(Math.max(value, FONT_SCALE_MIN), FONT_SCALE_MAX);
    }
  } catch (error) {
    // ignore
  }
  return 1;
}

function setStoredFontScale(value) {
  try {
    window.localStorage.setItem(FONT_SCALE_KEY, String(value));
  } catch (error) {
    // ignore
  }
}

function applyFontScale(value) {
  document.documentElement.style.setProperty("--font-scale", String(value));
}

function initFontScale() {
  applyFontScale(getStoredFontScale());

  const decrease = document.querySelector("#font-decrease");
  const increase = document.querySelector("#font-increase");

  if (decrease) {
    decrease.addEventListener("click", () => {
      const next = Math.max(FONT_SCALE_MIN, Math.round((getStoredFontScale() - FONT_SCALE_STEP) * 100) / 100);
      setStoredFontScale(next);
      applyFontScale(next);
    });
  }

  if (increase) {
    increase.addEventListener("click", () => {
      const next = Math.min(FONT_SCALE_MAX, Math.round((getStoredFontScale() + FONT_SCALE_STEP) * 100) / 100);
      setStoredFontScale(next);
      applyFontScale(next);
    });
  }
}

function getRequestedPage() {
  const match = window.location.search.match(/[?&]page=([0-9]+)/);
  const page = match ? Number(match[1]) : 1;
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function getRequestedDateFilter() {
  const value = new URLSearchParams(window.location.search).get("date");
  return dateKeyFromParam(value);
}

function getRequestedTagFilter() {
  const match = window.location.search.match(/[?&]tag=([^&]+)/);
  return match ? normalizeTag(decodeURIComponent(match[1].replace(/\+/g, " "))) : "";
}

function getRequestedSearchQuery() {
  const match = window.location.search.match(/[?&]q=([^&]+)/);
  return match ? decodeURIComponent(match[1].replace(/\+/g, " ")).trim() : "";
}

function getRequestedItemParam() {
  const value = new URLSearchParams(window.location.search).get("item");
  return value ? String(value).trim() : "";
}

function updateFeedUrl(options = {}) {
  if (!window.history || !window.history.replaceState) {
    return;
  }

  try {
    const url = new URL(window.location.href);
    const page = options.page || 1;
    const date = options.date || "";
    const tag = options.tag || "";
    const query = options.query || "";

    if (date) {
      url.searchParams.set("date", dateParamFromKey(date));
      url.searchParams.delete("page");
      url.searchParams.delete("q");
    } else {
      url.searchParams.delete("date");
    }

    if (tag) {
      url.searchParams.set("tag", tag);
      url.searchParams.delete("date");
      url.searchParams.delete("q");
    } else {
      url.searchParams.delete("tag");
    }

    if (query) {
      url.searchParams.set("q", query);
      url.searchParams.delete("date");
      url.searchParams.delete("tag");
    } else {
      url.searchParams.delete("q");
    }

    if (page > 1) {
      url.searchParams.set("page", String(page));
    } else {
      url.searchParams.delete("page");
    }

    window.history.replaceState({}, "", url);
  } catch (error) {
    // Some mobile in-app browsers expose partial URL/history APIs.
  }
}

function parseDate(item) {
  const dateValue = item.Date || item.date || item.published_at || item.publishedAt || item.created_at || "";
  const timeValue = item.Time || item.time || "";

  if (!dateValue) {
    return null;
  }

  if (timeValue && /^\d{1,2}:\d{2}/.test(timeValue)) {
    return new Date(`${dateValue}T${timeValue}:00+07:00`);
  }

  return new Date(dateValue);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || "Undated";
  }

  try {
    const month = date.toLocaleDateString("en-US", {
      ...localTimeOptions({ month: "long" })
    });
    const day = Number(date.toLocaleDateString("en-US", {
      ...localTimeOptions({ day: "numeric" })
    }));
    const year = date.toLocaleDateString("en-US", {
      ...localTimeOptions({ year: "numeric" })
    });
    return `${month} ${day}${ordinalSuffix(day)}, ${year}`;
  } catch (error) {
    return fallbackDateLabel(date, true);
  }
}

function formatDayDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || "Undated";
  }

  try {
    const weekday = date.toLocaleDateString("en-US", {
      ...localTimeOptions({ weekday: "long" })
    });
    const month = date.toLocaleDateString("en-US", {
      ...localTimeOptions({ month: "long" })
    });
    const day = Number(date.toLocaleDateString("en-US", {
      ...localTimeOptions({ day: "numeric" })
    }));
    const year = date.toLocaleDateString("en-US", {
      ...localTimeOptions({ year: "numeric" })
    });
    return `${weekday}, ${month} ${day}${ordinalSuffix(day)} ${year}`;
  } catch (error) {
    return fallbackDateLabel(date, true);
  }
}

function shortDateLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || "Undated";
  }

  try {
    return date.toLocaleDateString("en-US", {
      ...localTimeOptions({
        month: "long",
        day: "numeric"
      })
    });
  } catch (error) {
    return fallbackDateLabel(date, false);
  }
}

const TZ_ABBR = {
  "Asia/Kolkata": "IST",
  "Asia/Colombo": "IST",
  "Asia/Kathmandu": "NPT",
  "Asia/Singapore": "SGT",
  "Asia/Kuala_Lumpur": "MYT",
  "Asia/Bangkok": "ICT",
  "Asia/Ho_Chi_Minh": "ICT",
  "Asia/Phnom_Penh": "ICT",
  "Asia/Vientiane": "ICT",
  "Asia/Jakarta": "WIB",
  "Asia/Makassar": "WITA",
  "Asia/Jayapura": "WIT",
  "Asia/Shanghai": "CST",
  "Asia/Hong_Kong": "HKT",
  "Asia/Taipei": "CST",
  "Asia/Tokyo": "JST",
  "Asia/Seoul": "KST",
  "Asia/Manila": "PHT",
  "Asia/Karachi": "PKT",
  "Asia/Dhaka": "BST",
  "Asia/Yangon": "MMT",
  "Asia/Dubai": "GST",
  "Asia/Riyadh": "AST",
  "Asia/Jerusalem": "IST",
  "Asia/Tehran": "IRST",
  "Asia/Ulaanbaatar": "ULAT",
  "Asia/Brunei": "BNT",
  "Asia/Dili": "TLT",
  "Asia/Tbilisi": "GET",
  "Asia/Baku": "AZT",
  "Asia/Almaty": "ALMT",
  "Asia/Novosibirsk": "NOVT",
  "Asia/Vladivostok": "VLAT",
  "Asia/Magadan": "MAGT",
  "Asia/Kamchatka": "PETT",
  "Australia/Perth": "AWST",
  "Australia/Adelaide": "ACST",
  "Australia/Darwin": "ACST",
  "Australia/Brisbane": "AEST",
  "Australia/Sydney": "AEST",
  "Australia/Melbourne": "AEST",
  "Pacific/Auckland": "NZST",
  "Pacific/Guam": "ChST",
  "Pacific/Port_Moresby": "PGT",
  "Europe/London": "GMT",
  "Europe/Paris": "CET",
  "Europe/Berlin": "CET",
  "America/New_York": "EST",
  "America/Chicago": "CST",
  "America/Denver": "MST",
  "America/Los_Angeles": "PST",
  "America/Toronto": "EST",
  "America/Vancouver": "PST",
  "America/Sao_Paulo": "BRT",
  "UTC": "UTC",
  "Etc/UTC": "UTC",
  "GMT": "GMT"
};

function normalizeTzName(tz) {
  if (!tz) {
    return "";
  }
  const ALIASES = {
    "Asia/Calcutta": "Asia/Kolkata",
    "Asia/Katmandu": "Asia/Kathmandu",
    "Asia/Saigon": "Asia/Ho_Chi_Minh",
    "Asia/Rangoon": "Asia/Yangon",
    "Asia/Chongqing": "Asia/Shanghai",
    "Asia/Chungking": "Asia/Shanghai",
    "Asia/Ujung_Pandang": "Asia/Makassar",
    "Asia/Dacca": "Asia/Dhaka",
    "Asia/Ashkhabad": "Asia/Ashgabat",
    "Asia/Thimbu": "Asia/Thimphu",
    "Asia/Phnom_Penh": "Asia/Phnom_Penh",
    "Asia/Calcutta": "Asia/Kolkata"
  };
  return ALIASES[tz] || tz;
}

// Long-name -> abbreviation fallback for zones whose short name resolves
// to a GMT offset in some engines (e.g. Asia/Kolkata -> "India Standard Time").
const TZ_LONG_ABBR = {
  "India Standard Time": "IST",
  "Sri Lanka Standard Time": "IST",
  "Nepal Time": "NPT",
  "Singapore Time": "SGT",
  "Malaysia Time": "MYT",
  "Indochina Time": "ICT",
  "Western Indonesia Time": "WIB",
  "Central Indonesia Time": "WITA",
  "Eastern Indonesia Time": "WIT",
  "China Standard Time": "CST",
  "Hong Kong Time": "HKT",
  "Japan Standard Time": "JST",
  "Korea Standard Time": "KST",
  "Philippine Time": "PHT",
  "Pakistan Standard Time": "PKT",
  "Bangladesh Standard Time": "BST",
  "Myanmar Time": "MMT",
  "Gulf Standard Time": "GST",
  "Arabia Standard Time": "AST",
  "Israel Standard Time": "IST",
  "Iran Standard Time": "IRST",
  "Ulaanbaatar Time": "ULAT",
  "Brunei Darussalam Time": "BNT",
  "East Timor Time": "TLT",
  "Georgia Standard Time": "GET",
  "Azerbaijan Time": "AZT",
  "East Kazakhstan Time": "ALMT",
  "Novosibirsk Standard Time": "NOVT",
  "Vladivostok Standard Time": "VLAT",
  "Magadan Standard Time": "MAGT",
  "Petropavlovsk-Kamchatski Time": "PETT",
  "Australian Western Standard Time": "AWST",
  "Australian Central Standard Time": "ACST",
  "Australian Eastern Standard Time": "AEST",
  "New Zealand Standard Time": "NZST",
  "Chamorro Standard Time": "ChST",
  "Papua New Guinea Time": "PGT",
  "Greenwich Mean Time": "GMT",
  "Central European Time": "CET",
  "Eastern Standard Time": "EST",
  "Central Standard Time": "CST",
  "Mountain Standard Time": "MST",
  "Pacific Standard Time": "PST",
  "Brasilia Time": "BRT",
  "Coordinated Universal Time": "UTC"
};

function localTzAbbr() {
  try {
    const tz = normalizeTzName(Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (TZ_ABBR[tz]) {
      return TZ_ABBR[tz];
    }
    const longPart = new Intl.DateTimeFormat("en-US", { timeZoneName: "long" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName");
    if (longPart && TZ_LONG_ABBR[longPart.value]) {
      return TZ_LONG_ABBR[longPart.value];
    }
    const part = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName");
    const value = (part && part.value) || "";
    if (value && !/^GMT[+-]/.test(value)) {
      return value;
    }
    return "local";
  } catch (error) {
    return "local";
  }
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  try {
    return date.toLocaleTimeString("en-GB", {
      ...localTimeOptions({
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      })
    });
  } catch (error) {
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }
}

function archiveDateLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || "Undated";
  }

  try {
    return date.toLocaleDateString("en-US", {
      ...localTimeOptions({
        month: "long",
        day: "numeric"
      })
    }) + ordinalSuffix(Number(date.toLocaleDateString("en-US", {
      ...localTimeOptions({ day: "numeric" })
    })));
  } catch (error) {
    return fallbackDateLabel(date, false) + ordinalSuffix(date.getDate());
  }
}

function ordinalSuffix(day) {
  if (day >= 11 && day <= 13) {
    return "th";
  }

  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

function dateKey(value) {
  const date = value instanceof Date ? value : typeof value === "object" ? parseDate(value) : new Date(value);
  if (!date || Number.isNaN(date.getTime())) {
    if (typeof value === "object") {
      return value.Date || value.date || "Undated";
    }
    return value || "Undated";
  }

  try {
    return new Intl.DateTimeFormat("en-CA", {
      ...localTimeOptions({
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      })
    }).format(date);
  } catch (error) {
    return [
      date.getFullYear(),
      pad2(date.getMonth() + 1),
      pad2(date.getDate())
    ].join("-");
  }
}

function dateKeyFromParam(value) {
  const cleaned = String(value || "").trim();
  const dmy = cleaned.match(/^([0-9]{2})-([0-9]{2})-([0-9]{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  }

  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(cleaned) ? cleaned : "";
}

function dateParamFromKey(value) {
  const match = String(value || "").match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
}

function pad2(value) {
  return value < 10 ? `0${value}` : String(value);
}

function fallbackDateLabel(date, includeYear) {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];
  const monthDay = `${months[date.getMonth()]} ${date.getDate()}`;
  return includeYear ? `${monthDay}${ordinalSuffix(date.getDate())}, ${date.getFullYear()}` : monthDay;
}

function localToday() {
  const now = new Date();

  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      ...localTimeOptions({
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      })
    }).formatToParts(now);
    const values = {};
    for (const part of parts) {
      values[part.type] = part.value;
    }
    return new Date(`${values.year}-${values.month}-${values.day}T00:00:00`);
  } catch (error) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
}

function recentArchiveDates() {
  const dates = [];
  const start = localToday();

  for (let index = 0; index < ARCHIVE_DAYS; index += 1) {
    const date = new Date(start.getTime());
    date.setDate(start.getDate() - index);
    dates.push(date);
  }

  return dates;
}

function isValidLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeTag(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^#/, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function explicitTags(item) {
  const value = item.Tags || item.tags || item.Tag || item.tag || "";
  // Only surface single-token stored tags. Multi-word phrase tags written
  // into the database since mid-August ("Open-weight models", "Digital
  // sovereignty") read badly as hashtags; the client-side tag inference
  // (inferTags/inferCountryTags) supplies clean generic tags instead, which
  // is how the site looked before stored phrase tags existed.
  const cleanTag = (tag) => {
    const trimmed = String(tag || "").trim();
    if (!trimmed || /\s/.test(trimmed)) return "";
    return normalizeTag(trimmed);
  };
  if (Array.isArray(value)) {
    return value.map(cleanTag).filter(Boolean);
  }

  return String(value)
    .split(/[,|#]/)
    .map(cleanTag)
    .filter(Boolean);
}

function inferTags(item, blurb) {
  const categoryTag = normalizeTag(item.Region || item.region || item.Category || item.category);
  const text = [
    blurb,
    item.Region,
    item.region,
    item.Category,
    item.category,
    item.source_name,
    item.Source,
    typeof item.source === "string" ? item.source : ""
  ].join(" ").toLowerCase();

  const tags = [];
  const add = (tag) => {
    if (!tags.includes(tag)) {
      tags.push(tag);
    }
  };

  if (categoryTag === "deals") {
    add("deals");
  } else if (categoryTag === "markets") {
    add("markets");
  } else if (categoryTag === "ai-and-chips") {
    add("ai");
    add("chips");
  } else if (categoryTag === "venture-capital") {
    add("venture-capital");
  } else if (categoryTag === "crypto") {
    add("crypto");
  } else if (categoryTag === "fintech") {
    add("fintech");
  } else if (categoryTag && !isRegionTag(categoryTag) && categoryTag !== "other-news") {
    add(categoryTag);
  }

  if (/\b(e-commerce|ecommerce|commerce|marketplace|online retail|retail|b2b e-commerce|b2b ecommerce|udaan|shein|amazon|fast-fashion|warehouses?)\b/.test(text)) {
    add("e-commerce");
  }

  if (/\b(fund|funding|raised|raise|secured|series [a-z]|seed|ipo|listing|public listing|valuation|stake|acquisition|buy|bought|deal|invest|investment|grant|equity|debt|convertible|restructuring)\b/.test(text)) {
    add("deals");
  }

  if (/\b(markets?|shares?|stock|trading|revenue|profit|sales|tax|yield|price|valuation|ipo|listing|public listing|investors?|equity|debt|convertible|balance sheet)\b/.test(text)) {
    add("markets");
  }

  if (/\b(ai|artificial intelligence|llm|large model|multimodal|foundation model|model|claude|openai|anthropic|deepseek|minimax|moonshot|agentic|nvidia|waic|persona|distillation)\b/.test(text)) {
    add("ai");
  }

  if (/\b(chip|chips|chipmaker|chipmaking|semiconductor|semiconductors|integrated-circuit|integrated circuit|circuit board|circuit boards|pcb|pcbs|tsmc|samsung|sk hynix|hynix|cxmt|umc|silicon|photonics|fab|foundry|packaging|hbm|memory-chip|memory chips|nvidia)\b/.test(text)) {
    add("chips");
  }

  if (/\b(robot|robots|robotics|humanoid|automation|factory|atlas|x[p]?eng|boston dynamics)\b/.test(text)) {
    add("robotics");
  }

  if (/\b(crypto|bitcoin|stablecoin|stablecoins|blockchain|onchain|token|digital asset|solana)\b/.test(text)) {
    add("crypto");
  }

  if (/\b(bank|banking|fintech|financial|payments?|qr payment|insurance|lending|yield|securities regulator|central bank|islamic law)\b/.test(text)) {
    add("fintech");
  }

  if (/\b(regulator|regulators|regulation|policy|government|ministry|customs|approval|approved|audit|probe|immigration|law|rules|compliance|incentives|tax|grant|public sector)\b/.test(text)) {
    add("policy");
  }

  if (/\b(cloud|data centre|data center|datacentre|datacenter|infrastructure|compute|air-gapped|oracle|aws|microsoft|google)\b/.test(text)) {
    add("cloud");
  }

  if (/\b(cybersecurity|security|intelligence-sharing|critical infrastructure|export controls?|export-restricted|illicit finance|shadow economy)\b/.test(text)) {
    add("security");
  }

  if (/\b(smartphone|iphone|device|devices|handset|huawei|apple|xiaomi|oppo|vivo|honor)\b/.test(text)) {
    add("devices");
  }

  if (/\b(gaming|games|famitsu|media|publication|newsletter|content|entertainment)\b/.test(text)) {
    add("media");
  }

  if (/\b(energy|battery|solar|inverter|power supplies|power supply|renewable)\b/.test(text)) {
    add("energy");
  }

  if (/\b(drone|drones|uav|defence|defense|military)\b/.test(text)) {
    add("defence");
  }

  if (/\b(outsourcing|bpo|jobs forecast|labour|labor|workforce)\b/.test(text)) {
    add("workforce");
  }

  if (!tags.length) {
    add("tech");
  }

  return tags;
}

function inferCountryTags(item, blurb) {
  const text = [
    blurb,
    item.Region,
    item.region,
    item.Category,
    item.category
  ].join(" ").toLowerCase();

  const tags = [];
  const add = (tag) => {
    if (!tags.includes(tag)) {
      tags.push(tag);
    }
  };

  if (/\b(china|chinese|beijing|shanghai|shenzhen|hong kong|huawei|alibaba|baidu|bytedance|deepseek|minimax|moonshot|cxmt|dfsx|dongfang suanxin|xpeng|shein)\b/.test(text)) {
    add("china");
  }

  if (/\b(india|indian|delhi|mumbai|bengaluru|bangalore|sebi|rupee|inr|sarvam|bharatgen|udaan|elevation capital|insurancedekho)\b/.test(text)) {
    add("india");
  }

  if (/\b(japan|japanese|tokyo|sbi holdings|sbi group|sbi vc trade|softbank|sony|panasonic|hitachi|famitsu|yongin)\b/.test(text)) {
    add("japan");
  }

  if (/\b(taiwan|taiwanese|taipei|tsmc|umc|chiayi)\b/.test(text)) {
    add("taiwan");
  }

  if (/\b(south korea|korea|korean|seoul|samsung|sk hynix|hynix|hyundai)\b/.test(text)) {
    add("south-korea");
  }

  if (/\b(singapore)\b/.test(text)) {
    add("singapore");
  }

  if (/\b(thailand|thai|bangkok|siam commercial bank|scb x)\b/.test(text)) {
    add("thailand");
  }

  if (/\b(malaysia|malaysian|johor)\b/.test(text)) {
    add("malaysia");
  }

  if (/\b(vietnam|vietnamese|hanoi|viettel)\b/.test(text)) {
    add("vietnam");
  }

  if (/\b(pakistan|pakistani)\b/.test(text)) {
    add("pakistan");
  }

  if (/\b(bangladesh|bangla)\b/.test(text)) {
    add("bangladesh");
  }

  if (/\b(philippines|philippine|manila)\b/.test(text)) {
    add("philippines");
  }

  if (/\b(saudi arabia|saudi)\b/.test(text)) {
    add("saudi-arabia");
  }

  if (/\b(israel|israeli)\b/.test(text)) {
    add("israel");
  }

  if (/\b(united states|u\.s\.|us|american|arizona|georgia|nasdaq)\b/.test(text)) {
    add("us");
  }

  return tags;
}

const REGION_TAGS = new Set([
  "africa",
  "americas",
  "apac",
  "asia",
  "east-asia",
  "europe",
  "global",
  "latin-america",
  "middle-east",
  "north-america",
  "sea",
  "south-asia",
  "southeast-asia",
  "west",
  "china",
  "india",
  "japan",
  "taiwan",
  "south-korea",
  "singapore",
  "thailand",
  "malaysia",
  "vietnam",
  "pakistan",
  "bangladesh",
  "philippines",
  "saudi-arabia",
  "israel",
  "us"
]);

function isRegionTag(tag) {
  return REGION_TAGS.has(normalizeTag(tag));
}

function isCountryTag(tag) {
  return isRegionTag(tag);
}

function primaryTopicTag(tags) {
  return (tags || []).find((tag) => !isRegionTag(tag)) || "tech";
}

function normalizeTagList(tags) {
  return [
    ...new Set(
      (tags || [])
        .map(normalizeTag)
        .filter(Boolean)
    )
  ];
}

function itemTags(item, blurb) {
  const explicit = normalizeTagList(explicitTags(item));
  const countries = normalizeTagList([...inferCountryTags(item, blurb), ...explicit.filter(isRegionTag)]);
  const topics = normalizeTagList([...explicit, ...inferTags(item, blurb)].filter((tag) => !isRegionTag(tag)));

  if (!countries.length) {
    countries.push("asia");
  }

  if (!topics.length) {
    topics.push("tech");
  }

  const visibleTopics = topics.slice(0, 3);
  const visibleCountries = countries.slice(0, 5 - visibleTopics.length);
  return [...visibleTopics, ...visibleCountries].slice(0, 5);
}

function titleCaseTag(tag) {
  return String(tag || "tech")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
    [/^(.+?)\s+plans to raise pre-IPO funding before a planned Hong Kong listing/i, "$1 lines up Hong Kong IPO push"],
    [/^(.+?)\s+is on pace for\s+\$?([0-9.]+)\s*(billion|million|mn|m)\s+in annual recurring revenue/i, (match) => `${match[1]} nears ${shortMoney(match[2], match[3])} ARR`],
    [/^(.+?)\s+has held talks with banks about a potential listing/i, "$1 weighs IPO"],
    [/^SK Group chairman Chey Tae-won\s+says\s+the global AI memory-chip shortage.*?foreign governments are intervening.*$/i, "SK warns AI memory crunch is getting political"],
    [/^SoftBank founder Masayoshi Son\s+says?\s+global AI infrastructure will require\s+\$?([0-9.]+)\s*trillion a year/i, (match) => `SoftBank's Son puts AI infra cost at $${match[1]}tn a year`],
    [/^Xi Jinping\s+used .*?World AI Conference.*?to praise\s+China.*$/i, "Xi uses WAIC to pitch China AI"],
    [/^(.+?)\s+plans to produce India's first semiconductor wafers on ([0-9]+nm).*$/i, "$1 plans India's first $2 wafers"],
    [/^(.+?)\s+plans to launch (.+?),\s+a\s+([0-9]+tn-[0-9]+tn|[0-9.]+-trillion)[^,]*model/i, "$1 readies $2 model launch"],
    [/^(.+?)\s+unveiled\s+(.+?),\s+(?:a|an|billed as)/i, "$1 unveils $2"],
    [/^(.+?)\s+launches?\s+(.+?),\s+(?:a|an|billed as)/i, "$1 launches $2"],
    [/^(.+?)\s+raises?\s+(?:nearly\s+|more than\s+)?(?:a\s+)?\$?([0-9.]+)\s*(billion|million|mn|m)\b/i, (match) => `${match[1]} raises ${shortMoney(match[2], match[3])}`],
    [/^(.+?)\s+secured\s+(?:a\s+)?\$?([0-9.]+)\s*(billion|million|mn|m)\b/i, (match) => `${match[1]} secures ${shortMoney(match[2], match[3])}`],
    [/^(.+?)\s+completed its majority acquisition of\s+(.+?)\s+after/i, "$1 completes $2 deal"],
    [/^(.+?)\s+wins approval .*? for its IPO/i, "$1 clears IPO review"],
    [/^(.+?)\s+targeted a valuation of more than\s+\$?([0-9.]+)\s*(billion|million|mn|m)\b/i, (match) => `${match[1]} targets ${shortMoney(match[2], match[3])} valuation`],
    [/^(.+?)\s+closed down more than\s+([0-9.]+%)/i, "$1 shares fall $2"],
    [/^(.+?)\s+fell as much as\s+([0-9.]+%).*$/i, "$1 shares fall $2"],
    [/^(.+?)\s+ordered\s+(.+?)\s+to pay\s+\$?([0-9.]+)\s*(billion|million|mn|m)\b/i, (match) => `${match[2]} hit with ${shortMoney(match[3], match[4])} verdict`],
    [/^(.+?)\s+asked\s+(.+?)\s+for a meeting.*$/i, "$1 seeks $2 meeting"],
    [/^(.+?)\s+used .*? to promote\s+(.+?)$/i, "$1 promotes $2"],
    [/^(.+?)\s+is turning\s+(.+?)\s+into\s+(.+?)$/i, "$1 turns $2 into $3"],
    [/^(.+?)\s+are turning\s+(.+?)\s+into\s+(.+?)$/i, "$1 turn $2 into $3"],
    [/^(.+?)\s+found\s+(.+?)\s+now perform/i, "$1 finds open models closing gap"],
    [/^(.+?)\s+rejects allegations.*?Chinese rivals/i, "$1 rejects model-distillation claims"],
    [/^(.+?)\s+will expand collaboration on\s+(.+?)$/i, "$1 expands $2 push"],
    [/^(.+?)\s+teamed up to build\s+(.+?)$/i, "$1 team on $2"],
    [/^(.+?)\s+reported a\s+([0-9.]+%)\s+jump/i, "$1 reports $2 sales jump"],
    [/^(.+?)\s+pledged .*? to invest another\s+\$?([0-9.]+)\s*(billion|million|mn|m)\b/i, (match) => `${match[1]} adds ${shortMoney(match[2], match[3])} investment pledge`],
    [/^(.+?)\s+and four Japanese industrial automation companies\s+will expand collaboration on robotics/i, "$1 expands Japan robotics push"],
    [/^Representatives from\s+([0-9]+)\s+countries signed an agreement to establish\s+(?:a\s+)?(?:global\s+)?(.+?)(?:\s+body|\s+headquartered|,|$).*$/i, "$1 countries back $2"],
    [/^US House China committee chair John Moolenaar urged .*? to ban\s+US companies from buying\s+(.+?)\s+chips.*$/i, "US lawmaker pushes $1 chip ban"],
    [/^(.+?)\s+plans to file draft IPO papers/i, "$1 prepares IPO filing"],
    [/^(.+?)\s+is in early talks .*? about\s+(.+?)$/i, "$1 weighs $2"],
    [/^(.+?)\s+exports nearly doubled/i, "$1 exports nearly double"],
    [/^(.+?)\s+has started preparing for an IPO/i, "$1 starts IPO prep"]
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
  const headline = clauses[0].trim();

  return limitHeadline(headline);
}

function normalizeItem(item) {
  const blurb = String(item.Blurb || item.blurb || "").trim();
  if (!blurb) {
    return null;
  }

  const parsedDate = parseDate(item);
  const sourceUrl = String(item.URL || item.Url || item.url || item.source_url || item.sourceUrl || "").trim();
  const id = String(item.id || item.ID || item.ItemID || item.item_id || "").trim();

  return {
    id,
    link_key: String(item.link_key || "").trim(),
    blurb,
    published_at: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : new Date().toISOString(),
    region: String(item.Region || item.region || item.Category || item.category || "").trim(),
    source_name: String(
      item.source_name ||
      item.sourceName ||
      item.Source ||
      (typeof item.source === "string" ? item.source : "") ||
      (item.source && typeof item.source.name === "string" ? item.source.name : "") ||
      ""
    ).trim(),
    source_url: isValidLink(sourceUrl) ? sourceUrl : "",
    headline: HEADLINE_OVERRIDES.get(id) || editorialHeadline(item) || deriveHeadline(blurb),
    tags: itemTags(item, blurb)
  };
}

function editorialHeadline(item) {
  if (item.headline_source === "stored") {
    return String(item.headline || "").trim();
  }

  return String(item.Headline || item.title || "").trim();
}

function sortItems(items) {
  return items.sort((a, b) => {
    const aTime = new Date(a.published_at).getTime() || 0;
    const bTime = new Date(b.published_at).getTime() || 0;
    return bTime - aTime;
  });
}

function stableItemKey(item) {
  return String(item.id || item.source_url || `${item.blurb}-${item.published_at}`).toLowerCase();
}

function appendItemText(target, item) {
  target.appendChild(document.createTextNode(item.blurb));

  if (!item.source_name) {
    return;
  }

  target.appendChild(document.createTextNode(" ["));

  if (item.source_url) {
    const source = document.createElement("a");
    source.href = item.source_url;
    source.target = "_blank";
    source.rel = "noopener";
    source.textContent = item.source_name;
    target.appendChild(source);
  } else {
    target.appendChild(document.createTextNode(item.source_name));
  }

  target.appendChild(document.createTextNode("]"));
}

function renderTags(target, item) {
  target.textContent = "";

  if (!item.tags.length) {
    target.hidden = true;
    return;
  }

  target.hidden = false;

  for (const tag of item.tags) {
    const link = document.createElement("a");
    link.href = `?tag=${encodeURIComponent(tag)}`;
    link.textContent = `#${tag}`;

    if (tag === currentTagFilter) {
      link.className = "current";
      link.setAttribute("aria-current", "page");
    }

    target.appendChild(link);
  }
}

function renderArchive() {
  archiveNav.textContent = "";

  for (const date of recentArchiveDates()) {
    const key = dateKey(date);
    const link = document.createElement("a");
    link.href = `?date=${dateParamFromKey(key)}`;
    link.textContent = archiveDateLabel(date);
    link.dataset.date = key;

    if (key === currentDateFilter) {
      link.className = "current";
      link.setAttribute("aria-current", "page");
    }

    archiveNav.appendChild(link);
  }
}

function setFeedStatus(label = "") {
  if (!status) {
    return;
  }

  if (label) {
    status.textContent = label;
    return;
  }

  status.textContent = `Live · ${formatTime(new Date())} ${localTzAbbr()} · ${formatDayDate(new Date())}`;
}

function renderSignal(items) {
  if (!signalMetrics) {
    return;
  }

  signalMetrics.textContent = "";

  const topicCounts = new Map();
  for (const item of items) {
    const topic = item.region || item.category || primaryTopicTag(item.tags);
    topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
  }

  const metrics = [
    ["Active stories", String(items.length)],
    ...[...topicCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 4)
      .map(([tag, count]) => [titleCaseTag(tag), String(count)])
  ];

  for (const [label, value] of metrics) {
    const metric = document.createElement("div");
    metric.className = "metric";

    const labelNode = document.createElement("span");
    labelNode.textContent = label;
    const valueNode = document.createElement("span");
    valueNode.textContent = value;

    metric.append(labelNode, valueNode);
    signalMetrics.appendChild(metric);
  }
}

function hideNewItemToast() {
  if (newItemToastTimer) {
    window.clearTimeout(newItemToastTimer);
    newItemToastTimer = null;
  }

  pendingToastItem = null;

  if (newItemToast) {
    newItemToast.hidden = true;
  }
}

function showNewItemToast(item, count = 1) {
  if (!newItemToast || !newItemToastTitle || !newItemToastMeta) {
    return;
  }

  pendingToastItem = item || null;
  newItemToastTitle.textContent = item?.headline || "New update available";
  newItemToastMeta.textContent = count > 1
    ? `${count} new updates · just now`
    : `${titleCaseTag(item?.region || item?.category || primaryTopicTag(item?.tags))} · just now`;
  newItemToast.hidden = false;

  if (newItemToastTimer) {
    window.clearTimeout(newItemToastTimer);
  }

  newItemToastTimer = window.setTimeout(() => {
    hideNewItemToast();
  }, NEW_ITEM_TOAST_TIMEOUT_MS);
}

function readPendingToastItem() {
  const target = pendingToastItem;
  hideNewItemToast();

  currentDateFilter = "";
  currentTagFilter = "";
  currentSearchQuery = "";
  currentPage = 1;
  renderPage(1);

  window.requestAnimationFrame(() => {
    if (target) {
      const key = stableItemKey(target);
      const firstMatchingItem = [...feed.querySelectorAll(".item")].find((node) => node.dataset.itemKey === key);
      if (firstMatchingItem) {
        firstMatchingItem.scrollIntoView({ block: "start", behavior: "smooth" });
        return;
      }
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

async function handleRequestedItem() {
  const itemId = requestedItemId;
  if (!itemId) return;

  let item = allItems.find((candidate) => String(candidate.id) === String(itemId) || (candidate.link_key && candidate.link_key.toLowerCase() === String(itemId).toLowerCase()));

  if (!item) {
    // Beyond the 500-item window: resolve by id through the API.
    try {
      const response = await fetch(`/api/v1/items/${encodeURIComponent(itemId)}`, {
        cache: "no-store",
        headers: { Accept: "application/json" }
      });
      if (!response.ok) return;
      const payload = await response.json();
      if (!payload || !(payload.raw_id || payload.id)) return;
      const resolved = normalizeItem({ ...payload, id: payload.raw_id || payload.id });
      if (!resolved) return;
      allItems = sortItems([...allItems, resolved].filter(Boolean));
      item = resolved;
    } catch {
      return;
    }
  }

  const key = stableItemKey(item);
  let node = [...feed.querySelectorAll(".item")].find((el) => el.dataset.itemKey === key);
  if (node) {
    flashItem(node);
    return;
  }

  const targetDate = dateKey(item.published_at);
  const dateItems = allItems.filter((candidate) => dateKey(candidate.published_at) === targetDate);
  const index = dateItems.findIndex((candidate) => String(candidate.id) === String(itemId));
  const page = index >= 0 ? Math.floor(index / ITEMS_PER_PAGE) + 1 : 1;

  currentDateFilter = targetDate;
  currentTagFilter = "";
  currentSearchQuery = "";
  renderDate(targetDate, page);

  window.requestAnimationFrame(() => {
    const found = [...feed.querySelectorAll(".item")].find((el) => el.dataset.itemKey === key);
    if (found) flashItem(found);
  });
}

function flashItem(node) {
  node.scrollIntoView({ block: "start", behavior: "smooth" });
  node.classList.add("item-flash");
  window.setTimeout(() => node.classList.remove("item-flash"), 3200);
}

if (newItemToastRead) {
  newItemToastRead.addEventListener("click", readPendingToastItem);
}

if (newItemToastClose) {
  newItemToastClose.addEventListener("click", hideNewItemToast);
}

function isFeaturedItem(item) {
  return item.id === FEATURED_ITEM_ID ||
    item.source_url === FEATURED_SOURCE_URL ||
    /\bDeepSeek\b.*\bAI price war\b.*\benterprise adoption\b/i.test(item.blurb);
}

function featuredItems() {
  if (!SHOW_WATCHLIST) {
    return allItems;
  }

  return allItems.filter((item) => !isFeaturedItem(item));
}

function renderWatchlist() {
  if (!watchlist || !watchlistHeadline || !watchlistBlurb) {
    return;
  }

  if (!SHOW_WATCHLIST) {
    watchlist.hidden = true;
    return;
  }

  const item = allItems.find(isFeaturedItem);
  if (!item) {
    watchlist.hidden = true;
    return;
  }

  watchlist.hidden = false;
  watchlistHeadline.textContent = item.headline;
  watchlistBlurb.textContent = "";
  appendItemText(watchlistBlurb, item);
}

function hideWatchlist() {
  if (watchlist) {
    watchlist.hidden = true;
  }
}

function createPageButton(label, page, options = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.disabled = options.disabled || false;
  if (options.className) {
    button.className = options.className;
  }

  if (options.current) {
    button.classList.add("current");
    button.setAttribute("aria-current", "page");
  }

  button.addEventListener("click", () => {
    if (currentDateFilter) {
      renderDate(currentDateFilter, page);
    } else if (currentSearchQuery) {
      renderSearch(currentSearchQuery, page);
    } else if (currentTagFilter) {
      renderTag(currentTagFilter, page);
    } else {
      renderPage(page);
    }
    scrollFeedToTop();
  });
  return button;
}

function renderPagination(totalItems) {
  pagination.textContent = "";

  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  if (totalPages <= 1) {
    pagination.hidden = true;
    return;
  }

  pagination.hidden = false;
  if (currentPage > 1) {
    pagination.appendChild(createPageButton("Previous", currentPage - 1, {
      className: "page-nav"
    }));
  }

  const visiblePages = Math.min(totalPages, VISIBLE_PAGE_BUTTONS);
  const halfWindow = Math.floor(visiblePages / 2);
  let firstPage = currentPage - halfWindow + 1;
  firstPage = Math.max(1, Math.min(firstPage, totalPages - visiblePages + 1));
  const lastPage = firstPage + visiblePages - 1;

  for (let page = firstPage; page <= lastPage; page += 1) {
    pagination.appendChild(createPageButton(String(page), page, {
      current: page === currentPage
    }));
  }

  pagination.appendChild(createPageButton("Next", Math.min(totalPages, currentPage + 1), {
    className: "page-nav",
    disabled: currentPage === totalPages
  }));
}

function renderPage(page = currentPage) {
  currentDateFilter = "";
  currentTagFilter = "";
  currentSearchQuery = "";
  syncSearchInput();
  const homepageItems = featuredItems();
  const totalPages = Math.max(1, Math.ceil(homepageItems.length / ITEMS_PER_PAGE));
  currentPage = Math.min(Math.max(1, page), totalPages);
  updateFeedUrl({ page: currentPage });

  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageItems = homepageItems.slice(start, start + ITEMS_PER_PAGE);

  feed.textContent = "";
  archiveNav.textContent = "";
  setFeedStatus();
  renderWatchlist();

  if (!pageItems.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No updates yet.";
    feed.appendChild(empty);
    renderPagination(0);
    return;
  }

  renderArchive();
  renderItems(pageItems);
  renderPagination(homepageItems.length);
}

function renderDate(date, page = currentPage) {
  currentDateFilter = date;
  currentTagFilter = "";
  currentSearchQuery = "";
  syncSearchInput();

  const dateItems = allItems.filter((item) => dateKey(item.published_at) === date);
  const totalPages = Math.max(1, Math.ceil(dateItems.length / ITEMS_PER_PAGE));
  currentPage = Math.min(Math.max(1, page), totalPages);
  updateFeedUrl({ date, page: currentPage });

  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageItems = dateItems.slice(start, start + ITEMS_PER_PAGE);

  feed.textContent = "";
  archiveNav.textContent = "";
  setFeedStatus();
  hideWatchlist();

  renderArchive();

  if (!pageItems.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No updates for this date.";
    feed.appendChild(empty);
    renderPagination(0);
    return;
  }

  renderItems(pageItems);
  renderPagination(dateItems.length);
}

function renderTag(tag, page = currentPage) {
  currentDateFilter = "";
  currentTagFilter = normalizeTag(tag);
  currentSearchQuery = "";
  syncSearchInput();

  const tagItems = allItems.filter((item) => item.tags.includes(currentTagFilter));
  const totalPages = Math.max(1, Math.ceil(tagItems.length / ITEMS_PER_PAGE));
  currentPage = Math.min(Math.max(1, page), totalPages);
  updateFeedUrl({ tag: currentTagFilter, page: currentPage });

  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageItems = tagItems.slice(start, start + ITEMS_PER_PAGE);

  feed.textContent = "";
  archiveNav.textContent = "";
  setFeedStatus();
  hideWatchlist();

  renderArchive();

  if (!pageItems.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = `No updates tagged #${currentTagFilter}.`;
    feed.appendChild(empty);
    renderPagination(0);
    return;
  }

  renderItems(pageItems);
  renderPagination(tagItems.length);
}

function normalizeSearchQuery(query) {
  return String(query || "").trim().replace(/\s+/g, " ");
}

function parseSearchQuery(query) {
  const terms = String(query || "").toLowerCase().split(/\s+/).filter(Boolean);
  const tagTerms = [];
  const textTerms = [];
  for (const term of terms) {
    if (term.startsWith("tag:")) {
      const tag = term.slice(4);
      if (tag) tagTerms.push(tag);
    } else if (term.startsWith("#") && term.length > 1) {
      tagTerms.push(term.slice(1));
    } else {
      textTerms.push(term);
    }
  }
  return { tagTerms, textTerms };
}

function itemMatchesTags(item, tagTerms) {
  const itemTags = (item.tags || []).map((tag) => String(tag).toLowerCase());
  return tagTerms.every((term) => itemTags.some((tag) => tag.includes(term)));
}

function searchText(item) {
  return [
    item.headline,
    item.blurb,
    item.source_name,
    item.source_url,
    item.category,
    item.published_at,
    formatDate(item.published_at),
    ...(item.tags || [])
  ].join(" ").toLowerCase();
}

function renderSearch(query, page = currentPage) {
  currentDateFilter = "";
  currentTagFilter = "";
  currentSearchQuery = normalizeSearchQuery(query);
  syncSearchInput();

  if (!currentSearchQuery) {
    renderPage(1);
    return;
  }

  const { tagTerms, textTerms } = parseSearchQuery(currentSearchQuery);

  // Instant local results over the loaded window (fast path).
  const localItems = allItems.filter((item) => {
    if (!itemMatchesTags(item, tagTerms)) return false;
    if (!textTerms.length) return true;
    const text = searchText(item);
    return textTerms.every((term) => text.includes(term));
  });
  renderSearchResults(localItems, page, localItems.length ? "No matching updates." : "Searching full archive…");

  // Full-archive search: the backend /api/v1/search covers every item (D1
  // rows + static archive), so searches are not limited to the newest 500
  // loaded client-side. Results replace the local ones when they arrive.
  searchFullArchive(currentSearchQuery, tagTerms, textTerms, page);
}

// Sequence guard so a slow archive response never overwrites a newer query.
let searchRequestSeq = 0;

async function searchFullArchive(query, tagTerms, textTerms, page) {
  const seq = ++searchRequestSeq;
  const params = new URLSearchParams();
  if (textTerms.length) params.set("q", textTerms.join(" "));
  else if (tagTerms.length) params.set("tag", tagTerms[0]);
  params.set("limit", "500");

  try {
    const response = await fetch(`/api/v1/search?${params.toString()}`, {
      headers: { accept: "application/json" }
    });
    if (!response.ok) throw new Error(`Search API returned ${response.status}`);
    const payload = await response.json();
    if (seq !== searchRequestSeq) return; // stale response, newer query in flight

    const archiveItems = (payload.items || [])
      .map((item) => normalizeItem({ ...item, id: item.raw_id || item.id }))
      .filter(Boolean)
      .filter((item) => {
        if (!itemMatchesTags(item, tagTerms)) return false;
        if (!textTerms.length) return true;
        const text = searchText(item);
        return textTerms.every((term) => text.includes(term));
      });
    renderSearchResults(archiveItems, page);
  } catch {
    // Archive search is a progressive enhancement; local results stand.
  }
}

function renderSearchResults(searchItems, page, emptyMessage = "No matching updates.") {
  const totalPages = Math.max(1, Math.ceil(searchItems.length / ITEMS_PER_PAGE));
  currentPage = Math.min(Math.max(1, page), totalPages);
  updateFeedUrl({ query: currentSearchQuery, page: currentPage });

  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageItems = searchItems.slice(start, start + ITEMS_PER_PAGE);

  feed.textContent = "";
  archiveNav.textContent = "";
  setFeedStatus();
  hideWatchlist();

  renderArchive();

  if (!pageItems.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = emptyMessage;
    feed.appendChild(empty);
    renderPagination(0);
    return;
  }

  renderItems(pageItems);
  renderPagination(searchItems.length);
}

function renderItems(items) {
  let currentDate = "";

  for (const item of items) {
    const nextDate = dateKey(item.published_at);

    if (nextDate !== currentDate) {
      currentDate = nextDate;
      const dateNode = dateTemplate.content.cloneNode(true);
      const date = dateNode.querySelector(".date");
      date.id = currentDate;
      date.textContent = formatDate(item.published_at);
      feed.appendChild(dateNode);
    }

    const itemNode = itemTemplate.content.cloneNode(true);
    const primaryTag = item.region || item.category || primaryTopicTag(item.tags);
    const primaryTagLink = itemNode.querySelector(".item-primary-tag");

    itemNode.querySelector(".item-time").textContent = formatTime(item.published_at);
    itemNode.querySelector(".item").dataset.itemKey = stableItemKey(item);
    primaryTagLink.href = `?tag=${encodeURIComponent(primaryTag)}`;
    primaryTagLink.textContent = titleCaseTag(primaryTag);
    itemNode.querySelector(".headline").textContent = item.headline;
    appendItemText(itemNode.querySelector(".blurb"), item);
    renderTags(itemNode.querySelector(".tags"), item);

    const meta = itemNode.querySelector(".meta");
    if (meta && item.link_key) {
      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.className = "item-copy-link";
      copyButton.setAttribute("aria-label", "Copy link to this story");
      copyButton.title = "Copy link";
      copyButton.textContent = "Copy link";
      copyButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        copyItemLink(item, copyButton);
      });
      meta.appendChild(copyButton);
    }

    feed.appendChild(itemNode);
  }
}

function copyItemLink(item, button) {
  const url = `${window.location.origin}/?item=${encodeURIComponent(item.link_key || item.id)}`;
  const done = () => {
    const original = button.textContent;
    button.textContent = "Copied ✓";
    button.classList.add("copied");
    window.setTimeout(() => {
      button.textContent = original;
      button.classList.remove("copied");
    }, 1800);
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(done, () => fallbackCopy(url, done));
  } else {
    fallbackCopy(url, done);
  }
}

function fallbackCopy(text, done) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand("copy");
    done();
  } catch {
    // Clipboard unavailable; leave the button unchanged.
  }
  textarea.remove();
}

function render(items, options = {}) {
  allItems = sortItems(items.map(normalizeItem).filter(Boolean));
  syncSearchInput();
  renderSignal(allItems);

  if (options.statusText) {
    feed.textContent = "";
    archiveNav.textContent = "";
    pagination.textContent = "";
    pagination.hidden = true;
    hideWatchlist();
    setFeedStatus(options.statusText);
    return;
  }

  if (currentSearchQuery) {
    renderSearch(currentSearchQuery);
  } else if (currentTagFilter) {
    renderTag(currentTagFilter);
  } else if (currentDateFilter) {
    renderDate(currentDateFilter);
  } else {
    renderPage(currentPage);
  }
}

function renderCurrentView() {
  renderSignal(allItems);

  if (currentSearchQuery) {
    renderSearch(currentSearchQuery, currentPage);
  } else if (currentTagFilter) {
    renderTag(currentTagFilter, currentPage);
  } else if (currentDateFilter) {
    renderDate(currentDateFilter, currentPage);
  } else {
    renderPage(currentPage);
  }
}

function isLiveHomepageTop() {
  return !currentSearchQuery && !currentTagFilter && !currentDateFilter && currentPage === 1;
}

function mergeIncomingItems(items) {
  const normalizedItems = items.map(normalizeItem).filter(Boolean);
  const existingKeys = new Set(allItems.map(stableItemKey));
  const mergedByKey = new Map();
  let newItemCount = 0;
  const newItems = [];

  for (const item of allItems) {
    mergedByKey.set(stableItemKey(item), item);
  }

  for (const item of normalizedItems) {
    const key = stableItemKey(item);
    if (!existingKeys.has(key)) {
      newItemCount += 1;
      newItems.push(item);
    }
    mergedByKey.set(key, item);
  }

  allItems = sortItems([...mergedByKey.values()]);
  return {
    newItemCount,
    newestItem: sortItems(newItems)[0] || null
  };
}

async function fetchFeedItems() {
  const response = await fetch(`/api/items?limit=500&_=${Date.now()}`, {
    cache: "no-store",
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error(`Feed API returned ${response.status}`);
  }

  const payload = await response.json();
  return payload.items || [];
}

async function refreshFeed(options = {}) {
  if (isFetchingFeed) {
    return;
  }

  isFetchingFeed = true;

  try {
    const items = await fetchFeedItems();

    if (options.initial) {
      render(items, { statusText: "" });
      handleRequestedItem();
      return;
    }

    const { newItemCount, newestItem } = mergeIncomingItems(items);
    if (newItemCount && isLiveHomepageTop()) {
      renderCurrentView();
      showNewItemToast(newestItem, newItemCount);
    } else if (newItemCount) {
      renderSignal(allItems);
      setFeedStatus(`${newItemCount} new update${newItemCount === 1 ? "" : "s"} available`);
      showNewItemToast(newestItem, newItemCount);
    } else {
      renderSignal(allItems);
      setFeedStatus();
    }
  } catch (error) {
    if (options.initial) {
      render([], {
        statusText: "Feed unavailable. Try again shortly."
      });
    }
  } finally {
    isFetchingFeed = false;
  }
}

function startFeedPolling() {
  if (feedPollTimer) {
    window.clearInterval(feedPollTimer);
  }

  feedPollTimer = window.setInterval(() => {
    if (document.visibilityState === "hidden") {
      return;
    }

    refreshFeed();
  }, FEED_POLL_INTERVAL_MS);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      refreshFeed();
    }
  });
}

function syncSearchInput() {
  if (searchInput && document.activeElement === searchInput) {
    return;
  }

  if (searchInput && searchInput.value !== currentSearchQuery) {
    searchInput.value = currentSearchQuery;
  }

  if (mobileSearchInput && document.activeElement !== mobileSearchInput && mobileSearchInput.value !== currentSearchQuery) {
    mobileSearchInput.value = currentSearchQuery;
  }
}

if (searchForm && searchInput) {
  searchInput.value = currentSearchQuery;

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    renderSearch(searchInput.value, 1);
    scrollFeedToTop();
  });

  searchInput.addEventListener("input", () => {
    renderSearch(searchInput.value, 1);
  });
}

const searchToggle = document.querySelector("#search-toggle");
const mobileSearchForm = document.querySelector("#mobile-search-form");
const mobileSearchInput = document.querySelector("#mobile-search-input");

if (searchToggle && mobileSearchForm && mobileSearchInput) {
  mobileSearchInput.value = currentSearchQuery;

  searchToggle.addEventListener("click", () => {
    const open = mobileSearchForm.classList.toggle("open");
    searchToggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      mobileSearchInput.focus();
    }
  });

  mobileSearchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    renderSearch(mobileSearchInput.value, 1);
    scrollFeedToTop();
  });

  mobileSearchInput.addEventListener("input", () => {
    renderSearch(mobileSearchInput.value, 1);
  });
}

async function loadNewsletterCard() {
  try {
    const response = await fetch("/api/site-content", { cache: "no-store" });
    if (!response.ok) return;
    const content = await response.json();
    const newsletter = content.newsletter || {};
    const promo = document.querySelector("#newsletter-promo");
    if (!promo) return;

    const title = document.querySelector("#newsletter-title");
    const blurb = document.querySelector("#newsletter-blurb");
    const imageLink = document.querySelector("#newsletter-image-link");
    const image = document.querySelector("#newsletter-image");
    const readLink = document.querySelector("#newsletter-read-link");

    if (newsletter.url) {
      if (imageLink) imageLink.href = newsletter.url;
      if (readLink) readLink.href = newsletter.url;
    }
    if (newsletter.image && image) image.src = newsletter.image;
    if (title && newsletter.title) title.textContent = newsletter.title;
    if (blurb && newsletter.blurb) blurb.textContent = newsletter.blurb;
  } catch {
    // Keep the static fallback card.
  }
}

initThemeToggle();
initFontScale();
refreshFeed({ initial: true });
startFeedPolling();
loadNewsletterCard();
