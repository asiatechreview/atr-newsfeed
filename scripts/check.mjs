import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { STATIC_ITEMS } from "../functions/_data/static-items.js";
import { onRequestGet } from "../functions/api/items.js";

const root = new URL("..", import.meta.url).pathname;
const required = [
  "public/index.html",
  "public/styles.css",
  "public/app.js",
  "functions/api/items.js",
  "functions/api/health.js",
  "functions/feed.json.js",
  "functions/rss.xml.js",
  "schema.sql",
  "wrangler.toml"
];

const missing = required.filter((file) => !existsSync(join(root, file)));
if (missing.length) {
  console.error(`Missing files: ${missing.join(", ")}`);
  process.exit(1);
}

const schema = readFileSync(join(root, "schema.sql"), "utf8");
for (const column of ["blurb", "source_name", "source_url", "category", "published_at"]) {
  if (!schema.includes(column)) {
    console.error(`schema.sql missing ${column}`);
    process.exit(1);
  }
}

const appScript = readFileSync(join(root, "public/app.js"), "utf8");
if (!appScript.includes("function renderTags(target, item)") || !appScript.includes("for (const tag of item.tags)")) {
  console.error("public/app.js must render story tags, not hide the tag container");
  process.exit(1);
}

if (!appScript.includes("FEED_POLL_INTERVAL_MS") || !appScript.includes("startFeedPolling()") || !appScript.includes("document.visibilityState")) {
  console.error("public/app.js must poll for new feed items without requiring a full page refresh");
  process.exit(1);
}

const failures = [];
const sourceAliases = new Map([
  ["ft.com", "FT"],
  ["wsj.com", "WSJ"],
  ["scmp.com", "SCMP"]
]);

STATIC_ITEMS.forEach((item, index) => {
  const label = `STATIC_ITEMS[${index}] ${item.id || ""}`.trim();

  if (!item.blurb) failures.push(`${label}: missing blurb`);
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
});

if (failures.length) {
  console.error(`FAILED: ${failures.length} feed check(s) failed`);
  failures.slice(0, 25).forEach((failure) => console.error(`- ${failure}`));
  if (failures.length > 25) console.error(`- ...and ${failures.length - 25} more`);
  process.exit(1);
}

const generatedResponse = await onRequestGet({
  env: {
    ATR_FEED_DB: {
      prepare() {
        throw new Error("Skip D1 during local headline generation check");
      }
    }
  },
  request: new Request("https://local.test/api/items?limit=500")
});
const generatedPayload = await generatedResponse.json();
const generatedItems = Array.isArray(generatedPayload.items) ? generatedPayload.items : [];
const headlineFailures = generatedItems
  .map((item, index) => ({ item, index }))
  .filter(({ item, index }) => index >= 30 && isWeakHeadline(item.headline))
  .map(({ item, index }) => `${index + 1} ${item.id || item.source_url || "unknown"}: weak headline "${item.headline}"`);

if (headlineFailures.length) {
  console.error(`FAILED: ${headlineFailures.length} generated headline check(s) failed`);
  headlineFailures.slice(0, 25).forEach((failure) => console.error(`- ${failure}`));
  if (headlineFailures.length > 25) console.error(`- ...and ${headlineFailures.length - 25} more`);
  process.exit(1);
}

console.log(`OK: ATR feed checks passed (${STATIC_ITEMS.length} static items, ${generatedItems.length} generated headlines).`);

function isWeakHeadline(headline) {
  const value = String(headline || "").trim().replace(/\bU\.S\./g, "US");

  if (!value) return true;
  if (value.length > 72) return true;
  if (/\b(?:a|an|the|to|for|from|of|in|on|at|by|with|into|as|and|or|but|after|before|while|amid|among|including|through|using|than|more|less|around|roughly|nearly|over|under|about|its|their|his|her|this|that|which|who|what|where|when|why|how|would|will|could|should|has|have|had|is|are|was|were|being|been|called|known|also|first|new|world's|yuan|chipmaker|prime minister anwar)\s*$/i.test(value)) return true;
  if (/\$[0-9.]+$/.test(value)) return true;
  if (/^(?:Chinese|Indian|Singapore-based|Japanese|South Korean|Taiwanese|Malaysian|Thai|Vietnamese|Philippine|Hong Kong|UAE|US|American)\s+(?:unicorn|startup|company|firm|chipmaker|operator|chain|platform|designer|developer|maker|group|giant|authorities|regulators|lawmaker|ministry|court)\b/i.test(value)) return true;
  if (/^(?:CXMT|SK Hynix Inc|U\.S|US|Global creditors|ShareChat, positioned|Xiaohongshu, known abroad|Dongfang Suanxin, also known|Chinese AI founders|Indian AI startup Rocket)$/i.test(value)) return true;
  if (/\b(?:is in talks|has held talks|has started preparing|is preparing|plans to file|will show|will debut|are expected|is previewing|is pushing|began auditing|declined to stay|opened an immigration|marked its|launched a nationwide|is building|said residents|begins trading|told staff|plans to spend|approved a manufacturing|has been supplying|has won|raised a \$|targeted a valuation|reported a |closed down|outlined several|are leaning|begins shipping|is shutting|pledged another|will feature|has closed|has told Meta|is expanding|will invest|are leading|is in talks to buy|will begin renting|launched ZCode|has narrowed|has referred|sentenced five|has passed|will pour|has laid out|is nearing|launches investor|has ramped|has stalled|jailed former|announced|has filed|has open-sourced|launched Hong|finalized rules|has accused|has signed|now account|aims to finalize|will tighten|has chosen)\b/i.test(value)) return true;
  if (/\b(?:inside the story|The Economic Times|surfacing|directs MeitY|front and center)\b/i.test(value)) return true;
  if (/(?:\$[0-9.]+ billion|[0-9]+ trillion rupees|T\$|HK\$|\bRs\s)/i.test(value)) return true;

  return false;
}
