// story-match.js — entity-based duplicate guard for the ATR bulletin.
//
// Catches "same story, different outlet": when two items share the same
// company and the same event type (e.g. "Alibaba misses revenue estimates"
// from Reuters and "Alibaba earnings miss" from Bloomberg), they are likely
// the same story posted twice. URL dedupe cannot see this; this module can.
//
// Single source of truth for both the admin publish form and the ingest
// helper. Matching is deterministic (no LLM): curated company aliases plus
// keyword-based event classification, compared over a time window.

// Curated company aliases -> canonical key. Add companies ATR actually
// covers. Matching is case-insensitive substring on the headline + blurb,
// so aliases are the distinct spellings worth recognising.
const COMPANY_ALIASES = [
  ["alibaba", "Alibaba"],
  ["taobao", "Alibaba"],
  ["tmall", "Alibaba"],
  ["tencent", "Tencent"],
  ["wechat", "Tencent"],
  ["baidu", "Baidu"],
  ["jd.com", "JD.com"],
  ["jd logistics", "JD.com"],
  ["meituan", "Meituan"],
  ["pinduoduo", "PDD"],
  ["temu", "PDD"],
  ["bytedance", "ByteDance"],
  ["tiktok", "ByteDance"],
  ["douyin", "ByteDance"],
  ["huawei", "Huawei"],
  ["xiaomi", "Xiaomi"],
  ["oppo", "OPPO"],
  ["vivo", "Vivo"],
  ["honor", "Honor"],
  ["samsung", "Samsung"],
  ["sk hynix", "SK Hynix"],
  ["hynix", "SK Hynix"],
  ["lg electronics", "LG Electronics"],
  ["tsmc", "TSMC"],
  ["intel", "Intel"],
  ["nvidia", "Nvidia"],
  ["amd", "AMD"],
  ["qualcomm", "Qualcomm"],
  ["apple", "Apple"],
  ["google", "Google"],
  ["alphabet", "Google"],
  ["microsoft", "Microsoft"],
  ["meta", "Meta"],
  ["amazon", "Amazon"],
  ["netflix", "Netflix"],
  ["openai", "OpenAI"],
  ["anthropic", "Anthropic"],
  ["deepseek", "DeepSeek"],
  ["moonshot", "Moonshot AI"],
  ["kimi", "Moonshot AI"],
  ["zhipu", "Zhipu AI"],
  ["glm", "Zhipu AI"],
  ["minimax", "MiniMax"],
  ["qwen", "Alibaba"],
  ["sense time", "SenseTime"],
  ["sensetime", "SenseTime"],
  ["iflytek", "iFlytek"],
  ["baidu ernie", "Baidu"],
  ["nuro", "Nuro"],
  ["unitree", "Unitree"],
  ["agibot", "Agibot"],
  ["figure ai", "Figure AI"],
  ["grab", "Grab"],
  ["gojek", "GoTo"],
  ["gotravel", "GoTo"],
  ["tokopedia", "GoTo"],
  ["sea limited", "Sea"],
  ["sea group", "Sea"],
  ["shopee", "Sea"],
  ["garena", "Sea"],
  ["lazada", "Lazada"],
  ["flipkart", "Flipkart"],
  ["paytm", "Paytm"],
  ["phonepe", "PhonePe"],
  ["razorpay", "Razorpay"],
  ["swiggy", "Swiggy"],
  ["zomato", "Zomato"],
  ["nykaa", "Nykaa"],
  ["meesho", "Meesho"],
  ["ola", "Ola"],
  ["oyro", "OYO"],
  ["oyo", "OYO"],
  ["byju", "Byju's"],
  ["byjus", "Byju's"],
  ["cars24", "Cars24"],
  ["pine labs", "Pine Labs"],
  ["zerodha", "Zerodha"],
  ["groww", "Groww"],
  ["cred", "CRED"],
  ["softbank", "SoftBank"],
  ["peak xv", "Peak XV"],
  ["sequoia", "Sequoia"],
  ["tiger global", "Tiger Global"],
  ["temasek", "Temasek"],
  ["gic", "GIC"],
  ["kakao", "Kakao"],
  ["naver", "Naver"],
  ["coupang", "Coupang"],
  ["line app", "LY Corp"],
  ["ly corp", "LY Corp"],
  ["rakuten", "Rakuten"],
  ["sony", "Sony"],
  ["nintendo", "Nintendo"],
  ["toyota", "Toyota"],
  ["honda", "Honda"],
  ["nissan", "Nissan"],
  ["hyundai", "Hyundai"],
  ["kia", "Kia"],
  ["tesla", "Tesla"],
  ["byd", "BYD"],
  ["nio", "NIO"],
  ["xpeng", "XPeng"],
  ["li auto", "Li Auto"],
  ["geely", "Geely"],
  ["zeekr", "Zeekr"],
  ["catl", "CATL"],
  ["contemporary amperex", "CATL"],
  ["vinfast", "VinFast"],
  ["grab", "Grab"],
  ["reliance", "Reliance"],
  ["jio", "Reliance Jio"],
  ["airtel", "Airtel"],
  ["tata", "Tata"],
  ["infosys", "Infosys"],
  ["wipro", "Wipro"],
  ["tc s", "TCS"],
  ["lenovo", "Lenovo"],
  ["zte", "ZTE"],
  ["arm holdings", "Arm"],
  ["arm ltd", "Arm"],
  ["broadcom", "Broadcom"],
  ["micron", "Micron"],
  ["western digital", "Western Digital"],
  ["asml", "ASML"],
  ["hitachi", "Hitachi"],
  ["panasonic", "Panasonic"],
  ["fujitsu", "Fujitsu"],
  ["nintendo", "Nintendo"],
  ["ubisoft", "Ubisoft"],
  ["shutterstock", "Shutterstock"],
  ["openrouter", "OpenRouter"],
  ["mistral", "Mistral AI"],
  ["cohere", "Cohere"],
  ["xai", "xAI"],
  ["grok", "xAI"]
];

// Event classification: keyword sets per event type. Match any keyword.
// Each keyword must be a specific, unambiguous news event, not a generic
// business term that bleeds across topics. False positives from overly
// broad matching (e.g. "valuation" matching everything from an IPO delay
// to a product launch) are worse than missing a few true duplicates.
const EVENT_KEYWORDS = {
  earnings_miss: ["misses estimates", "missed estimates", "misses revenue estimates", "misses profit estimates", "earnings miss", "profit warning", "cuts forecast", "lowers guidance"],
  earnings_beat: ["beats estimates", "beat estimates", "beats revenue estimates", "raises guidance", "raised guidance", "profit jumps", "profit surges"],
  ipo: ["files for ipo", "filed for ipo", "plans ipo", "planning an ipo", "ipo pricing", "prices ipo", "public listing", "market debut", "stock market debut"],
  funding: ["raises $", "raised $", "series a", "series b", "series c", "series d", "seed round", "funding round"],
  acquisition: ["to acquire", "acquires", "acquired", "takeover", "merger with", "to buy", "buys"],
  layoffs: ["lays off", "cuts jobs", "job cuts", "cuts staff", "redundancies"],
  ban: ["bans ", "banned", "blocks access", "export controls", "blacklists"],
  probe: ["antitrust", "investigation into", "sues ", "lawsuit", "raided by"],
  partnership: ["partnership", "joint venture", "teams up", "join forces", "partners with"],
  launch: ["unveils", "launches", "introduces", "releases"]
};

// Time window for story matching (days). Same company + same event inside
// this window is flagged as a probable duplicate.
const MATCH_WINDOW_DAYS = 4;

function normalise(text) {
  return String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

// Return canonical company keys found in the text.
export function extractCompanies(text) {
  const value = normalise(text);
  const found = new Set();
  if (!value) return found;
  for (const [alias, canonical] of COMPANY_ALIASES) {
    // Word-ish boundary match: alias must appear as a whole word. Aliases
    // with spaces are matched as phrases; single words get boundaries on
    // both sides so "cred" does not match "credit" and "arm" does not
    // match "farm". Possessives ("Alibaba's") still hit via the leading
    // boundary + apostrophe.
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "i");
    if (re.test(value)) found.add(canonical);
  }
  return found;
}

// Return event types found in the text.
export function extractEvents(text) {
  const value = normalise(text);
  const found = new Set();
  if (!value) return found;
  for (const [event, keywords] of Object.entries(EVENT_KEYWORDS)) {
    for (const keyword of keywords) {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`\\b${escaped}`, "i").test(value)) {
        found.add(event);
        break;
      }
    }
  }
  return found;
}

// Distinctive tokens: words that actually identify a story. Generic tech
// vocabulary, geography and the company name itself are excluded so that
// "Nvidia data centre" cannot collide with every other Nvidia data-centre
// story in the window.
const STOPWORDS = new Set([
  "the","and","for","with","from","that","this","these","those","are","was","were","has","have","had",
  "will","would","could","should","its","their","his","her","they","them","into","over","after","before",
  "about","more","than","said","says","new","one","two","three","first","last","next","also","but","not",
  "you","your","our","out","up","down","off","on","in","at","by","as","of","to","a","an","is","be","it",
  "we","he","she","i","or","if","so","no","do","did","does","can","may","might","must","just","now","then",
  "when","where","which","who","whom","what","how","why","while","amid","among","including","through",
  "using","under","between","across","around","per","via","vs","company","companies","firm","firms",
  "report","reports","reported","according","documents","billion","million","percent","deal","deals"
]);

const GENERIC_TERMS = new Set([
  "artificial","intelligence","chip","chips","semiconductor","semiconductors","data","centre","center",
  "centres","centers","computing","compute","cloud","tech","technology","industry","business","news",
  "market","markets","asia","asian","china","chinese","american","global","world","region","regional",
  "southeast","south","east","north","overseas","international","platform","platforms","services"
]);

function significantTokens(text, companyKeys) {
  const companyWords = new Set();
  for (const key of companyKeys) {
    for (const word of normalise(key).split(/\s+/)) companyWords.add(word);
  }
  const tokens = new Set();
  for (const raw of normalise(text).split(/\s+/)) {
    const token = raw.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
    if (token.length < 4) continue;
    if (STOPWORDS.has(token) || GENERIC_TERMS.has(token) || companyWords.has(token)) continue;
    tokens.add(token);
  }
  return tokens;
}

function sharedTokenCount(a, b) {
  let count = 0;
  for (const token of a) if (b.has(token)) count += 1;
  return count;
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  const shared = sharedTokenCount(a, b);
  return shared / (a.size + b.size - shared);
}

// Legacy shape kept for callers that only need (company, event) keys.
export function extractStoryKeys(headline, blurb) {
  const companies = extractCompanies(normalise(headline));
  const events = extractEvents(normalise(headline));
  const keys = [];
  for (const company of companies) {
    for (const event of events) keys.push({ company, event });
  }
  return keys;
}

// Strict duplicate match:
//   - the same company must appear in BOTH headlines;
//   - a specific event must appear in BOTH headlines;
//   - the headlines must share at least two distinctive tokens (or 0.35 Jaccard).
// Blurb-only mentions no longer count: they were the main source of false
// positives on broad stories about a company.
export function findStoryMatches(items, { headline, blurb }) {
  const incomingCompanies = extractCompanies(normalise(headline));
  const incomingEvents = extractEvents(normalise(headline));
  if (!incomingCompanies.size || !incomingEvents.size) return [];

  const incomingTokens = significantTokens(headline, incomingCompanies);
  const now = Date.now();
  const matches = [];

  for (const item of items || []) {
    const id = String(item.id || "");
    if (!id) continue;
    const published = item.published_at ? new Date(item.published_at).getTime() : 0;
    if (!published) continue;
    const daysAgo = (now - published) / 86400000;
    if (daysAgo > MATCH_WINDOW_DAYS) continue;

    const itemHeadline = normalise(item.headline || item.title);
    const itemCompanies = extractCompanies(itemHeadline);
    if (![...incomingCompanies].some((company) => itemCompanies.has(company))) continue;

    const itemEvents = extractEvents(itemHeadline);
    const sharedEvents = [...incomingEvents].filter((event) => itemEvents.has(event));
    if (!sharedEvents.length) continue;

    const itemTokens = significantTokens(itemHeadline, itemCompanies);
    const sharedTokens = sharedTokenCount(incomingTokens, itemTokens);
    const similarity = jaccard(incomingTokens, itemTokens);
    if (sharedTokens < 2 && similarity < 0.35) continue;

    matches.push({
      id: item.id,
      company: sharedEvents.length ? [...incomingCompanies].find((c) => itemCompanies.has(c)) : "",
      event: sharedEvents[0],
      score: sharedTokens + sharedEvents.length,
      headline: item.headline || item.title || "",
      source_name: item.source_name || "",
      source_url: item.source_url || "",
      category: item.category || "",
      published_at: item.published_at,
      days_ago: Math.round(daysAgo * 10) / 10
    });
  }

  return matches
    .sort((a, b) => b.score - a.score || a.days_ago - b.days_ago)
    .slice(0, 3);
}

export function storyMatchPayload(matches) {
  return { matches };
}
