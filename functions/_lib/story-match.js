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
  ["line", "LY Corp"],
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
  ["sea", "Sea"],
  ["reliance", "Reliance"],
  ["jio", "Reliance Jio"],
  ["airtel", "Airtel"],
  ["tata", "Tata"],
  ["infosys", "Infosys"],
  ["wipro", "Wipro"],
  ["tc s", "TCS"],
  ["lenovo", "Lenovo"],
  ["zte", "ZTE"],
  ["arm", "Arm"],
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
const EVENT_KEYWORDS = {
  earnings: ["earnings", "quarterly results", "quarterly report", "net income", "net profit", "profit warning", "revenue miss", "revenue beat", "misses revenue", "beats revenue"],
  funding: ["raises", "raised", "funding", "round", "series a", "series b", "series c", "series d", "series e", "seed round", "pre-seed", "secures", "invests", "investment", "backed by", "valuation", "led by"],
  ipo: ["ipo", "initial public offering", "public listing", "lists on", "debuts on", "float", "listing"],
  manda: ["acquires", "acquisition", "merger", "merges", "buyout", "takeover", "takes over", "stake", "buys", "sells", "divests", "to acquire"],
  launch: ["launches", "launched", "unveils", "unveiled", "debuts", "debuted", "releases", "released", "introduces", "rolls out", "starts selling", "goes on sale"],
  ban: ["bans", "ban on", "blocks", "blocked", "restricts", "restriction", "prohibits", "crackdown", "outlaw"],
  probe: ["probe", "probes", "investigation", "investigates", "regulator", "antitrust", "competition watchdog", "lawsuit", "sues", "sued", "fine", "fined"],
  partner: ["partnership", "partners with", "collaborates", "alliance", "joint venture", "teams up", "deal with"],
  layoffs: ["layoffs", "lays off", "cuts jobs", "job cuts", "redundancies", "restructures", "downsizes"],
  cloud: ["data centre", "data center", "cloud", "hyperscaler", "infrastructure"]
};

// Time window for story matching (days). Same company + same event inside
// this window is flagged as a probable duplicate.
const MATCH_WINDOW_DAYS = 7;

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
    // with spaces are matched as phrases; single words get boundaries.
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = alias.includes(" ")
      ? new RegExp(`\\b${escaped}\\b`, "i")
      : new RegExp(`\\b${escaped}`, "i");
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

// Extract (company, event) keys from headline + blurb.
export function extractStoryKeys(headline, blurb) {
  const text = `${headline || ""} ${blurb || ""}`;
  const companies = extractCompanies(text);
  const events = extractEvents(text);
  const keys = [];
  for (const company of companies) {
    for (const event of events) {
      keys.push({ company, event });
    }
  }
  return keys;
}

// Given candidate items (with headline, blurb, published_at, id, source_name)
// and a new story's headline/blurb, return probable duplicates: same company
// AND same event within MATCH_WINDOW_DAYS. Sorted by closeness (days ago).
export function findStoryMatches(items, { headline, blurb }) {
  const incomingKeys = extractStoryKeys(headline, blurb);
  if (!incomingKeys.length) return [];

  const now = Date.now();
  const matches = [];
  const seen = new Set();

  for (const item of items || []) {
    const id = String(item.id || "");
    if (!id) continue;
    const published = item.published_at ? new Date(item.published_at).getTime() : 0;
    if (!published) continue;
    const daysAgo = (now - published) / 86400000;
    if (daysAgo > MATCH_WINDOW_DAYS) continue;

    const itemKeys = extractStoryKeys(item.headline || item.title, item.blurb);
    for (const incoming of incomingKeys) {
      for (const existing of itemKeys) {
        if (incoming.company !== existing.company || incoming.event !== existing.event) continue;
        const dedupeKey = `${id}:${incoming.company}:${incoming.event}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        matches.push({
          id: item.id,
          company: incoming.company,
          event: incoming.event,
          headline: item.headline || item.title || "",
          source_name: item.source_name || "",
          source_url: item.source_url || "",
          category: item.category || "",
          published_at: item.published_at,
          days_ago: Math.round(daysAgo * 10) / 10
        });
      }
    }
  }

  return matches.sort((a, b) => a.days_ago - b.days_ago);
}

// Backend /api/story-match handler data: fetch recent items is done by the
// caller; this keeps the module pure and testable.
export function storyMatchPayload(matches) {
  return { matches };
}
