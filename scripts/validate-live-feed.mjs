const DEFAULT_URL = "https://bulletin.asiatechreview.com/api/items?limit=500";
const url = process.argv[2] || DEFAULT_URL;

const sourceAliases = new Map([
  ["ft.com", "FT"],
  ["wsj.com", "WSJ"],
  ["scmp.com", "SCMP"]
]);

function fail(message, details = []) {
  console.error(`FAILED: ${message}`);
  details.slice(0, 25).forEach((detail) => console.error(`- ${detail}`));
  if (details.length > 25) console.error(`- ...and ${details.length - 25} more`);
  process.exit(1);
}

function normalizeTags(item) {
  if (Array.isArray(item.tags)) return item.tags;
  if (typeof item.tags === "string") return item.tags.split(",").map((tag) => tag.trim()).filter(Boolean);
  return [];
}

let payload;
try {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) fail(`feed API returned HTTP ${response.status}`);
  payload = await response.json();
} catch (error) {
  fail(`could not fetch or parse feed API: ${error.message}`);
}

const items = Array.isArray(payload.items) ? payload.items : [];
if (!items.length) fail("feed API returned no items");

const failures = [];
for (const item of items) {
  const label = item.id || item.source_url || item.blurb?.slice(0, 40) || "unknown item";
  if (!item.blurb) failures.push(`${label}: missing blurb`);
  if (!item.headline) failures.push(`${label}: missing headline`);
  if (isWeakHeadline(item.headline)) failures.push(`${label}: weak headline "${item.headline}"`);
  if (!item.source_name) failures.push(`${label}: missing source_name`);
  if (!item.source_url) failures.push(`${label}: missing source_url`);
  if (!item.published_at || Number.isNaN(new Date(item.published_at).getTime())) {
    failures.push(`${label}: invalid published_at`);
  }

  for (const [domain, expectedLabel] of sourceAliases) {
    if (String(item.source_url || "").includes(domain) && item.source_name !== expectedLabel) {
      failures.push(`${label}: ${domain} must use source_name "${expectedLabel}", got "${item.source_name}"`);
    }
  }

  const tags = normalizeTags(item);
  if (tags.length > 5) failures.push(`${label}: has ${tags.length} tags, max is 5`);
}

if (failures.length) {
  fail(`${failures.length} live feed check(s) failed`, failures);
}

console.log(`OK: live feed validated (${items.length} items).`);

function isWeakHeadline(headline) {
  const value = String(headline || "").trim().replace(/\bU\.S\./g, "US");

  if (!value) return true;
  if (value.length > 72) return true;
  if (/\b(?:a|an|the|to|for|from|of|in|on|at|by|with|into|as|and|or|but|after|before|while|amid|among|including|through|using|than|more|less|around|roughly|nearly|over|under|about|its|their|his|her|this|that|which|who|what|where|when|why|how|would|will|could|should|has|have|had|is|are|was|were|being|been|called|known|also|first|new|world's|yuan|chipmaker|prime minister anwar)\s*$/i.test(value)) return true;
  if (/\$[0-9.]+$/.test(value)) return true;
  if (/^(?:Chinese|Indian|Singapore-based|Japanese|South Korean|Taiwanese|Malaysian|Thai|Vietnamese|Philippine|Hong Kong|UAE|US|American)\s+(?:unicorn|startup|company|firm|chipmaker|operator|chain|platform|designer|developer|maker|group|giant|authorities|regulators|lawmaker|ministry|court)\b/i.test(value)) return true;
  if (/^(?:CXMT|SK Hynix Inc|U\.S|US|Global creditors|ShareChat, positioned|Xiaohongshu, known abroad|Dongfang Suanxin, also known|Chinese AI founders|Indian AI startup Rocket)$/i.test(value)) return true;
  if (/\b(?:says?|said)\s+(?:the|that)\b/i.test(value)) return true;
  if (/\b(?:chairman|CEO|founder|president|minister)\s+[A-Z][A-Za-z-]+\s+[A-Z][A-Za-z-]+\s+says?\b/i.test(value)) return true;
  if (/\b(?:announced|reportedly|according to)\b/i.test(value)) return true;
  if (/\b(?:that|which|while|warning|after|before|as|with|where|including|following)$/i.test(value)) return true;
  if (/\b(?:is in talks|has held talks|has started preparing|is preparing|plans to file|will show|will debut|are expected|is previewing|is pushing|began auditing|declined to stay|opened an immigration|marked its|launched a nationwide|is building|said residents|begins trading|told staff|plans to spend|approved a manufacturing|has been supplying|has won|raised a \$|targeted a valuation|reported a |closed down|outlined several|are leaning|begins shipping|is shutting|pledged another|will feature|has closed|has told Meta|is expanding|will invest|are leading|is in talks to buy|will begin renting|launched ZCode|has narrowed|has referred|sentenced five|has passed|will pour|has laid out|is nearing|launches investor|has ramped|has stalled|jailed former|announced|has filed|has open-sourced|launched Hong|finalized rules|has accused|has signed|now account|aims to finalize|will tighten|has chosen)\b/i.test(value)) return true;
  if (/\b(?:inside the story|The Economic Times|surfacing|directs MeitY|front and center)\b/i.test(value)) return true;
  if (/(?:\$[0-9.]+ billion|[0-9]+ trillion rupees|T\$|HK\$|\bRs\s)/i.test(value)) return true;

  return false;
}
