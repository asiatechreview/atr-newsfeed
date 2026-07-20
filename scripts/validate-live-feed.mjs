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
  const value = String(headline || "").trim();

  if (!value) return true;
  if (value.length > 72) return true;
  if (/\b(?:says?|said)\s+(?:the|that)\b/i.test(value)) return true;
  if (/\b(?:chairman|CEO|founder|president|minister)\s+[A-Z][A-Za-z-]+\s+[A-Z][A-Za-z-]+\s+says?\b/i.test(value)) return true;
  if (/\b(?:announced|reportedly|according to)\b/i.test(value)) return true;
  if (/\b(?:that|which|while|warning|after|before|as|with|where|including|following)$/i.test(value)) return true;

  return false;
}
