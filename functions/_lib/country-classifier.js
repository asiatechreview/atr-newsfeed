// Weighted country classifier for new incoming items.
//
// Signals: explicit country/city names in the headline (strongest), the
// headquarters of the story's main company, then the same signals in the
// blurb. Headline hits count double. A confidence margin prevents guessing.

const COUNTRY_SIGNALS = {
  China: {
    places: ["china", "chinese", "beijing", "shanghai", "shenzhen", "hangzhou", "guangzhou", "mainland china"],
    companies: ["alibaba", "tencent", "baidu", "jd.com", "meituan", "pinduoduo", "pdd", "temu", "bytedance", "tiktok", "douyin", "huawei", "xiaomi", "catl", "byd", "nio", "xpeng", "li auto", "deepseek", "moonshot", "kimi", "qwen", "zhipu", "minimax", "unitree", "agibot", "cxmt", "sense time", "sensetime", "iflytek"]
  },
  India: {
    places: ["india", "indian", "mumbai", "bengaluru", "bangalore", "new delhi", "delhi", "hyderabad", "chennai", "pune"],
    companies: ["reliance", "jio", "airtel", "tata", "infosys", "wipro", "tcs", "paytm", "phonepe", "razorpay", "swiggy", "zomato", "flipkart", "nykaa", "meesho", "ola", "oyo", "byju", "cars24", "pine labs", "zerodha", "groww", "cred"]
  },
  Japan: {
    places: ["japan", "japanese", "tokyo", "osaka", "kyoto"],
    companies: ["sony", "nintendo", "toyota", "honda", "nissan", "rakuten", "softbank", "hitachi", "panasonic", "fujitsu"]
  },
  "South Korea": {
    places: ["south korea", "korea", "korean", "seoul"],
    companies: ["samsung", "sk hynix", "hynix", "lg electronics", "hyundai", "kia", "naver", "kakao", "coupang"]
  },
  Taiwan: {
    places: ["taiwan", "taiwanese", "taipei", "hsinchu"],
    companies: ["tsmc", "foxconn", "mediatek", "ase technology"]
  },
  Singapore: {
    places: ["singapore", "singaporean"],
    companies: ["grab", "sea limited", "sea group", "shopee", "garena", "megaspeed"]
  },
  Indonesia: {
    places: ["indonesia", "indonesian", "jakarta"],
    companies: ["goto", "gojek", "tokopedia"]
  },
  Malaysia: {
    places: ["malaysia", "malaysian", "kuala lumpur", "penang", "johor"],
    companies: []
  },
  Vietnam: {
    places: ["vietnam", "vietnamese", "hanoi", "ho chi minh"],
    companies: ["vinfast"]
  },
  Thailand: {
    places: ["thailand", "thai", "bangkok"],
    companies: []
  },
  Philippines: {
    places: ["philippines", "filipino", "manila"],
    companies: []
  },
  "Hong Kong": {
    places: ["hong kong", "hongkong"],
    companies: []
  },
  US: {
    places: ["united states", "u.s.", "american", "washington", "silicon valley", "california", "texas", "new york", "seattle"],
    companies: ["nvidia", "apple", "google", "alphabet", "microsoft", "meta", "amazon", "openai", "anthropic", "intel", "amd", "qualcomm", "broadcom", "micron", "western digital", "tesla", "netflix", "shutterstock", "openrouter", "xai", "grok", "figure ai"]
  },
  UK: {
    places: ["united kingdom", "uk", "britain", "british", "london"],
    companies: ["arm holdings", "arm ltd"]
  },
  UAE: {
    places: ["uae", "united arab emirates", "dubai", "abu dhabi"],
    companies: []
  },
  "Saudi Arabia": {
    places: ["saudi arabia", "saudi", "riyadh"],
    companies: []
  },
  Australia: {
    places: ["australia", "australian", "sydney", "melbourne"],
    companies: []
  }
};

function normalise(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function hasTerm(text, term) {
  if (!text) return false;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
}

const SEA_TERMS = ["southeast asia", "south-east asia", "south east asia", "southeast asian", "asean"];
const SEA_COUNTRIES = ["Singapore", "Indonesia", "Malaysia", "Vietnam", "Thailand", "Philippines"];

function earliestCountryIndex(text, country) {
  const signals = COUNTRY_SIGNALS[country];
  if (!signals) return -1;
  let earliest = -1;
  for (const term of [...signals.places, ...signals.companies]) {
    const index = text.indexOf(term);
    if (index === -1) continue;
    if (earliest === -1 || index < earliest) earliest = index;
  }
  return earliest;
}

function hasUsCountry(raw) {
  return /(^|[^A-Za-z])(US|U\.S\.)([^A-Za-z]|$)/.test(String(raw || ""));
}

export function scoreCountries(headline, blurb) {
  const h = normalise(headline);
  const b = normalise(blurb);
  const usHeadline = hasUsCountry(headline);
  const usBlurb = hasUsCountry(blurb);

  // The lead company in the headline identifies the story's subject. Later
  // companies are often comparators ("Alibaba challenges US AI leaders"), so
  // only the earliest company match contributes a company signal.
  let lead = null;
  for (const [country, { companies }] of Object.entries(COUNTRY_SIGNALS)) {
    for (const company of companies) {
      const index = h.indexOf(company);
      if (index === -1) continue;
      if (!lead || index < lead.index || (index === lead.index && company.length > lead.company.length)) {
        lead = { country, index, company };
      }
    }
  }

  const scores = {};
  for (const [country, { places, companies }] of Object.entries(COUNTRY_SIGNALS)) {
    let score = 0;
    for (const place of places) {
      if (hasTerm(h, place)) score += 6;
      else if (hasTerm(b, place)) score += 3;
    }
    for (const company of companies) {
      if (lead && lead.country === country && lead.company === company) score += 8;
      else if (hasTerm(b, company)) score += 1;
    }
    if (country === "US") {
      if (usHeadline) score += 6;
      else if (usBlurb) score += 3;
    }
    if (score > 0) scores[country] = score;
  }
  return scores;
}

export function classifyCountry(headline, blurb) {
  const scores = scoreCountries(headline, blurb);
  const h = normalise(headline);
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  // Regional stories: "Southeast Asia" is a valid region tag. A named
  // country still wins when it is the grammatical subject (appears before
  // the regional phrase in the headline).
  const seaIndexes = SEA_TERMS.map((term) => h.indexOf(term)).filter((index) => index >= 0);
  const seaIndex = seaIndexes.length ? Math.min(...seaIndexes) : -1;
  const seaMentioned = seaIndex >= 0;
  const regionalCountries = SEA_COUNTRIES.filter((country) => (scores[country] || 0) > 0);

  if (seaMentioned) {
    const top = ranked[0] ? ranked[0][0] : "";
    const topIndex = top ? earliestCountryIndex(h, top) : -1;
    const countryLeads = top && topIndex >= 0 && topIndex < seaIndex && (scores[top] || 0) >= 6;
    if (!countryLeads) {
      return { country: "Southeast Asia", score: 8, margin: 8, runnerUp: null, scores };
    }
  } else if (regionalCountries.length >= 2) {
    return { country: "Southeast Asia", score: 8, margin: 8, runnerUp: null, scores };
  }

  if (!ranked.length) {
    // Every story gets a region. When nothing specific is detectable, the
    // broad regional tag is used rather than leaving the field empty.
    return { country: "", score: 0, margin: 0, runnerUp: null, scores, fallback: true };
  }
  const [country, score] = ranked[0];
  const runnerUp = ranked[1] ? { country: ranked[1][0], score: ranked[1][1] } : null;
  const margin = runnerUp ? score - runnerUp.score : score;
  if (score < 4 || margin < 2) {
    return { country: "", score, margin, runnerUp, scores, fallback: true };
  }
  return { country, score, margin, runnerUp, scores };
}
