import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

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

console.log("ATR feed scaffold check passed.");
