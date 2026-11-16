// Weighted category classifier for new incoming items.
//
// The old inference returned the first regex that matched the blurb, which
// made overlapping categories (AI / Chips / Cloud / Policy) order-dependent.
// This scores every category instead: headline terms count double, blurb
// terms count once, specific vocabulary outweighs generic vocabulary, and a
// confidence margin decides whether to assign anything at all.

const SIGNALS = {
  AI: [
    ["large language model", 4], ["foundation model", 4], ["llm", 4], ["agentic", 3],
    ["openai", 4], ["anthropic", 4], ["deepseek", 4], ["moonshot", 4], ["kimi", 3],
    ["qwen", 4], ["gemini", 3], ["grok", 3], ["multimodal", 3], ["reasoning model", 3],
    ["ai model", 3], ["artificial intelligence", 3], ["ai", 1]
  ],
  Chips: [
    ["chipmaker", 4], ["semiconductor", 4], ["foundry", 4], ["wafer", 3], ["hbm", 4],
    ["tsmc", 4], ["sk hynix", 4], ["cxmt", 4], ["gpu", 3], ["nvidia", 2],
    ["memory chip", 3], ["chip", 2], ["chips", 2], ["fab", 2]
  ],
  Cloud: [
    ["hyperscaler", 4], ["data centre", 4], ["data center", 4], ["cloud region", 4],
    ["availability zone", 3], ["google cloud", 4], ["alibaba cloud", 4], ["tencent cloud", 4],
    ["aws", 3], ["azure", 3], ["cloud", 1]
  ],
  Cybersecurity: [
    ["ransomware", 4], ["data breach", 4], ["cyberattack", 4], ["hacked", 3],
    ["malware", 3], ["spyware", 3], ["zero-day", 3], ["security flaw", 3], ["surveillance", 2]
  ],
  Policy: [
    ["export controls", 4], ["export curbs", 4], ["export restrictions", 4], ["sanctions", 4],
    ["supply chains", 2], ["supply chain security", 3], ["allies agree", 3], ["regulator", 3], ["regulation", 3],
    ["antitrust", 3], ["tariff", 3], ["banned", 3], ["ministry", 3], ["parliament", 2],
    ["government", 2], ["ban", 3], ["compliance", 2]
  ],
  Deals: [
    ["acquisition", 4], ["acquire", 4], ["merger", 4], ["takeover", 4], ["buyout", 4],
    ["stake", 3], ["to buy", 3], ["divest", 3]
  ],
  Earnings: [
    ["quarterly results", 4], ["earnings", 3], ["net profit", 3], ["net income", 3],
    ["profit warning", 4], ["revenue miss", 3], ["beats estimates", 3]
  ],
  Markets: [
    ["market cap", 3], ["ipo", 3], ["listing", 2], ["shares", 2], ["stock", 2], ["valuation", 2]
  ],
  "Venture Capital": [
    ["venture capital", 4], ["vc firm", 4], ["vc fund", 4], ["fund of funds", 3],
    ["limited partner", 3], ["fund to back", 4], ["million fund", 3], ["backed by", 2], ["fund", 2]
  ],
  Funding: [
    ["raises $", 4], ["raised $", 4], ["series a", 4], ["series b", 4], ["series c", 4],
    ["seed round", 4], ["funding round", 4]
  ],
  Startups: [["startup", 4], ["start-up", 4], ["unicorn", 3]],
  Fintech: [["fintech", 4], ["digital bank", 4], ["payments", 3], ["lending", 3], ["insurance", 2], ["bank", 2]],
  Crypto: [["bitcoin", 4], ["crypto", 4], ["stablecoin", 4], ["blockchain", 3], ["token", 2], ["exchange", 2]],
  "E-commerce": [
    ["e-commerce", 4], ["ecommerce", 4], ["marketplace", 3], ["online retail", 3],
    ["shopee", 4], ["lazada", 4], ["tiktok shop", 4]
  ],
  Hardware: [
    ["smartphone", 4], ["handset", 3], ["laptop", 3], ["wearable", 3], ["headset", 3],
    ["iphone", 4], ["device", 2]
  ],
  Robotics: [["robot", 4], ["robotics", 4], ["humanoid", 4], ["robotaxi", 4], ["unitree", 4], ["agibot", 4]],
  Transportation: [
    ["logistics", 4], ["shipping", 3], ["airline", 3], ["aviation", 3], ["railway", 3],
    ["freight", 3], ["port", 2]
  ],
  Mobility: [
    ["ride-hailing", 4], ["ride hailing", 4], ["grab", 4], ["gojek", 4],
    ["autonomous", 3], ["self-driving", 3], ["ev", 2]
  ],
  Energy: [
    ["solar", 4], ["renewable", 4], ["power plant", 4], ["nuclear", 4], ["battery", 3],
    ["energy", 3], ["grid", 2]
  ],
  EVs: [
    ["electric vehicle", 4], ["ev maker", 4], ["ev battery", 4], ["charging network", 4],
    ["byd", 4], ["tesla", 4], ["nio", 4], ["xpeng", 4]
  ],
  Space: [["satellite", 4], ["rocket", 4], ["spacecraft", 4], ["orbit", 3], ["starlink", 4], ["space", 2]],
  Health: [["healthcare", 4], ["hospital", 4], ["telehealth", 4], ["medical", 3], ["patient", 3]],
  Biotech: [
    ["biotech", 4], ["biopharma", 4], ["gene therapy", 4], ["genomics", 4],
    ["clinical trial", 4], ["drug development", 4], ["vaccine", 3]
  ],
  Apps: [["app store", 4], ["superapp", 4], ["app", 1]],
  Gaming: [["esports", 4], ["gaming", 3], ["nintendo", 3], ["playstation", 3], ["game", 2]],
  Telecommunications: [
    ["telecom", 4], ["network operator", 4], ["5g", 3], ["6g", 3], ["spectrum", 3], ["broadband", 3]
  ],
  Streaming: [["streaming", 4], ["netflix", 4], ["disney+", 4], ["spotify", 3]],
  "WAIC 2026": [["waic", 4]]
};

// Equal-score tie-breaks: subject categories outrank event categories, and
// hardware subjects outrank the generic AI label.
const TIE_ORDER = [
  "Chips", "AI", "Cloud", "Cybersecurity", "Policy", "Deals", "Earnings", "Markets",
  "Venture Capital", "Funding", "Fintech", "Crypto", "E-commerce", "Hardware", "Robotics",
  "Transportation", "Mobility", "Energy", "EVs", "Space", "Health", "Biotech", "Apps",
  "Gaming", "Telecommunications", "Streaming", "Startups", "WAIC 2026"
];

function normalise(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function hasTerm(text, term) {
  if (!text) return false;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
}

export function scoreCategories(headline, blurb) {
  const h = normalise(headline);
  const b = normalise(blurb);
  const scores = {};
  for (const [category, terms] of Object.entries(SIGNALS)) {
    let score = 0;
    for (const [term, weight] of terms) {
      if (hasTerm(h, term)) score += weight * 2;
      if (hasTerm(b, term)) score += weight;
    }
    if (score > 0) scores[category] = score;
  }
  return scores;
}

export function classifyCategory(headline, blurb) {
  const scores = scoreCategories(headline, blurb);
  const ranked = Object.entries(scores)
    .sort((a, b) => b[1] - a[1] || TIE_ORDER.indexOf(a[0]) - TIE_ORDER.indexOf(b[0]));
  if (!ranked.length) {
    return { category: "Other news", score: 0, margin: 0, runnerUp: null, scores };
  }
  const [category, score] = ranked[0];
  const runnerUp = ranked[1] ? { category: ranked[1][0], score: ranked[1][1] } : null;
  const margin = runnerUp ? score - runnerUp.score : score;
  if (score < 3 || margin < 2) {
    return { category: "Other news", score, margin, runnerUp, scores };
  }
  return { category, score, margin, runnerUp, scores };
}
