import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { STATIC_ITEMS } from "../functions/_data/static-items.js";

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

console.log(`OK: ATR feed checks passed (${STATIC_ITEMS.length} static items).`);
