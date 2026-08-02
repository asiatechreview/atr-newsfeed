import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { STATIC_ITEMS } from "../functions/_data/static-items.js";
import { onRequestGet, onRequestPost } from "../functions/api/items.js";
import { onRequestGet as onCrawlerLogsRequestGet } from "../functions/api/crawler-logs.js";
import { onRequestGet as onJsonFeedRequestGet } from "../functions/feed.json.js";
import { onRequestGet as onRssRequestGet } from "../functions/rss.xml.js";
import { onRequest as onMiddlewareRequest } from "../functions/_middleware.js";

const root = new URL("..", import.meta.url).pathname;
const required = [
  "public/index.html",
  "public/llms.txt",
  "public/robots.txt",
  "public/styles.css",
  "public/app.js",
  "functions/api/items.js",
  "functions/api/health.js",
  "functions/api/crawler-logs.js",
  "functions/_lib/crawler-log.js",
  "functions/_middleware.js",
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
for (const column of ["headline", "blurb", "source_name", "source_url", "category", "published_at"]) {
  if (!schema.includes(column)) {
    console.error(`schema.sql missing ${column}`);
    process.exit(1);
  }
}

for (const crawlerLogTerm of ["crawler_access_logs", "user_agent", "bot_name", "country", "colo"]) {
  if (!schema.includes(crawlerLogTerm)) {
    console.error(`schema.sql missing crawler log term ${crawlerLogTerm}`);
    process.exit(1);
  }
}

const appScript = readFileSync(join(root, "public/app.js"), "utf8");
const indexHtml = readFileSync(join(root, "public/index.html"), "utf8");
const stylesCss = readFileSync(join(root, "public/styles.css"), "utf8");
if (!appScript.includes("function renderTags(target, item)") || !appScript.includes("for (const tag of item.tags)")) {
  console.error("public/app.js must render story tags, not hide the tag container");
  process.exit(1);
}

if (!appScript.includes("function primaryTopicTag(tags)") || appScript.includes("item.tags[0] || \"tech\"")) {
  console.error("public/app.js must use a topic tag, not the first/region tag, for the main story badge");
  process.exit(1);
}

if (!appScript.includes("\"asia\"") || !appScript.includes("\"southeast-asia\"") || !appScript.includes("function isRegionTag(tag)")) {
  console.error("public/app.js must classify broad region tags so they cannot become primary story badges");
  process.exit(1);
}

if (!appScript.includes("FEED_POLL_INTERVAL_MS") || !appScript.includes("startFeedPolling()") || !appScript.includes("document.visibilityState")) {
  console.error("public/app.js must poll for new feed items without requiring a full page refresh");
  process.exit(1);
}

if (!appScript.includes("function searchText(item)") || !appScript.includes("item.headline")) {
  console.error("public/app.js search must include item headlines, not only blurbs and metadata");
  process.exit(1);
}

if (!appScript.includes("Intl.DateTimeFormat().resolvedOptions().timeZone") || appScript.includes('timeZone: "Asia/Bangkok"') || appScript.includes("LIVE ${formatTime(new Date())} BKK")) {
  console.error("public/app.js must render feed timestamps with the reader's browser timezone, not a fixed Bangkok timezone");
  process.exit(1);
}

if (!indexHtml.includes('id="theme-toggle"') || !appScript.includes("THEME_STORAGE_KEY") || !stylesCss.includes(':root[data-theme="light"]')) {
  console.error("bulletin site must include a dark-default light/dark mode toggle");
  process.exit(1);
}

if (!indexHtml.includes('id="new-item-toast"') || !appScript.includes("showNewItemToast") || !stylesCss.includes(".new-item-toast")) {
  console.error("bulletin site must show a toast notification when new feed items arrive during live polling");
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

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  if (String(url).includes("/api/items")) {
    return new Response(JSON.stringify({ items: generatedItems }), {
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }

  return originalFetch(url);
};

const jsonFeedResponse = await onJsonFeedRequestGet({
  request: new Request("https://bulletin.asiatechreview.com/feed.json")
});
const jsonFeedPayload = await jsonFeedResponse.json();
const firstGeneratedItem = generatedItems[0];
const firstJsonFeedItem = jsonFeedPayload.items?.[0];

if (jsonFeedPayload.version !== "https://jsonfeed.org/version/1.1") {
  console.error("FAILED: feed.json must use JSON Feed 1.1");
  process.exit(1);
}

if (!firstJsonFeedItem || firstJsonFeedItem.title !== firstGeneratedItem.headline || firstJsonFeedItem.content_text !== firstGeneratedItem.blurb || firstJsonFeedItem.url !== firstGeneratedItem.source_url || firstJsonFeedItem.external_url !== firstGeneratedItem.source_url) {
  console.error("FAILED: feed.json must preserve headline, blurb and source URL from /api/items");
  process.exit(1);
}

const rssFeedResponse = await onRssRequestGet({
  request: new Request("https://bulletin.asiatechreview.com/rss.xml")
});
const rssFeedText = await rssFeedResponse.text();

if (!rssFeedText.includes(`<title>${escapeXmlForCheck(firstGeneratedItem.headline)}</title>`) || !rssFeedText.includes(`<link>${escapeXmlForCheck(firstGeneratedItem.source_url)}</link>`) || !rssFeedText.includes(`href="${escapeXmlForCheck(firstGeneratedItem.source_url)}"`)) {
  console.error("FAILED: rss.xml must preserve headline and source URL from /api/items");
  process.exit(1);
}

if (rssFeedText.includes(`<link>https://bulletin.asiatechreview.com/?item=${firstGeneratedItem.id}</link>`) || firstJsonFeedItem.url?.startsWith("https://bulletin.asiatechreview.com/?item=")) {
  console.error("FAILED: feed items must use the source article as the primary public link");
  process.exit(1);
}

if (!jsonFeedResponse.headers.get("cache-control")?.includes("max-age=300") || !rssFeedResponse.headers.get("cache-control")?.includes("max-age=300")) {
  console.error("FAILED: feed endpoints must use five-minute cache headers");
  process.exit(1);
}

globalThis.fetch = originalFetch;

const existingPostItem = {
  id: 999,
  headline: "Existing duplicate guard item",
  blurb: "Existing item that should be returned instead of duplicated.",
  source_name: "FT",
  source_url: "https://www.ft.com/content/duplicate-guard-test",
  category: "Markets",
  telegram_message_id: "existing-message",
  published_at: "2026-08-02T06:00:00Z",
  created_at: "2026-08-02T06:00:00Z"
};
let insertAttempts = 0;
const duplicatePostResponse = await onRequestPost({
  env: {
    FEED_INGEST_TOKEN: "test-token",
    ATR_FEED_DB: {
      prepare(query) {
        return {
          bind() {
            return {
              async run() {},
              async first() {
                if (query.includes("INSERT INTO feed_items")) {
                  insertAttempts += 1;
                  return null;
                }
                if (query.includes("WHERE lower(source_url) = lower(?)")) {
                  return existingPostItem;
                }
                throw new Error(`Unexpected duplicate guard query: ${query}`);
              }
            };
          }
        };
      }
    }
  },
  request: new Request("https://local.test/api/items", {
    method: "POST",
    headers: {
      authorization: "Bearer test-token",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      headline: "Replay duplicate guard item",
      blurb: "Replay item that should not create a duplicate.",
      sourceName: "FT",
      sourceUrl: existingPostItem.source_url,
      category: "Markets"
    })
  })
});
const duplicatePostPayload = await duplicatePostResponse.json();

if (duplicatePostResponse.status !== 200 || duplicatePostPayload.duplicate !== true || duplicatePostPayload.item?.id !== existingPostItem.id || insertAttempts !== 1) {
  console.error("FAILED: duplicate source URL POST must return the existing item without creating a duplicate");
  process.exit(1);
}

let crawlerLogInsert = null;
const crawlerLogWaits = [];
const crawlerLogEnv = {
  FEED_INGEST_TOKEN: "test-token",
  ATR_FEED_DB: {
    prepare(query) {
      return {
        async run() {},
        bind(...params) {
          return {
            async run() {
              crawlerLogInsert = { query, params };
            },
            async all() {
              return {
                results: [
                  {
                    id: 1,
                    requested_at: "2026-08-02T06:45:00Z",
                    path: "/feed.json",
                    method: "GET",
                    status: 200,
                    user_agent: "GPTBot/1.0",
                    bot_name: "GPTBot",
                    country: "US",
                    colo: "SFO"
                  }
                ]
              };
            }
          };
        }
      };
    }
  }
};

const crawlerMiddlewareResponse = await onMiddlewareRequest({
  env: crawlerLogEnv,
  request: new Request("https://bulletin.asiatechreview.com/feed.json", {
    headers: { "user-agent": "GPTBot/1.0" }
  }),
  async next() {
    return new Response("{}", { status: 200 });
  },
  waitUntil(promise) {
    crawlerLogWaits.push(promise);
  }
});
await Promise.all(crawlerLogWaits);

if (crawlerMiddlewareResponse.status !== 200 || !crawlerLogInsert || crawlerLogInsert.params[0] !== "/feed.json" || crawlerLogInsert.params[4] !== "GPTBot") {
  console.error("FAILED: crawler middleware must log feed/robots/llms requests with bot classification");
  process.exit(1);
}

const crawlerLogsUnauthorizedResponse = await onCrawlerLogsRequestGet({
  env: crawlerLogEnv,
  request: new Request("https://local.test/api/crawler-logs")
});

if (crawlerLogsUnauthorizedResponse.status !== 401) {
  console.error("FAILED: crawler log readback must require authorization");
  process.exit(1);
}

const crawlerLogsResponse = await onCrawlerLogsRequestGet({
  env: crawlerLogEnv,
  request: new Request("https://local.test/api/crawler-logs?limit=10", {
    headers: { authorization: "Bearer test-token" }
  })
});
const crawlerLogsPayload = await crawlerLogsResponse.json();

if (crawlerLogsResponse.status !== 200 || crawlerLogsPayload.summary?.byBot?.GPTBot !== 1 || crawlerLogsPayload.logs?.[0]?.path !== "/feed.json") {
  console.error("FAILED: protected crawler log endpoint must return logs and summary");
  process.exit(1);
}

console.log(`OK: ATR feed checks passed (${STATIC_ITEMS.length} static items, ${generatedItems.length} generated headlines, RSS/JSON feed formatting, duplicate POST guard, crawler logging).`);

function isWeakHeadline(headline) {
  const value = String(headline || "").trim().replace(/\bU\.S\./g, "US");

  if (!value) return true;
  if (value.length > 72) return true;
  if (/\$[0-9][0-9.,]*(?:\.[0-9]+)?(?:m|bn|tn)\+?\b/.test(value)) return true;
  if (/\b(?:a|an|the|to|for|from|of|in|on|at|by|with|into|as|and|or|but|after|before|while|amid|among|including|through|using|than|more|less|around|roughly|nearly|over|under|about|its|their|his|her|this|that|which|who|what|where|when|why|how|would|will|could|should|has|have|had|is|are|be|was|were|being|been|called|known|also|first|new|world's|yuan|chipmaker|prime minister anwar)\s*$/i.test(value)) return true;
  if (/\$[0-9.]+$/.test(value)) return true;
  if (/^(?:Chinese|Indian|Singapore-based|Japanese|South Korean|Taiwanese|Malaysian|Thai|Vietnamese|Philippine|Hong Kong|UAE|US|American)\s+(?:unicorn|startup|company|firm|chipmaker|operator|chain|platform|designer|developer|maker|group|giant|authorities|regulators|lawmaker|ministry|court)\b/i.test(value)) return true;
  if (/^(?:CXMT|SK Hynix Inc|U\.S|US|Global creditors|ShareChat, positioned|Xiaohongshu, known abroad|Dongfang Suanxin, also known|Chinese AI founders|Indian AI startup Rocket)$/i.test(value)) return true;
  if (/\b(?:is in talks|has held talks|has started preparing|is preparing|plans to file|will show|will debut|are expected|are set to be|is previewing|is pushing|began auditing|declined to stay|opened an immigration|marked its|launched a nationwide|is building|said residents|begins trading|told staff|plans to spend|approved a manufacturing|has been supplying|has won|raised a \$|targeted a valuation|reported a |closed down|outlined several|are leaning|begins shipping|is shutting|pledged another|will feature|has closed|has told Meta|is expanding|will invest|are leading|is in talks to buy|will begin renting|launched ZCode|has narrowed|has referred|sentenced five|has passed|will pour|has laid out|is nearing|launches investor|has ramped|has stalled|jailed former|announced|has filed|has open-sourced|launched Hong|finalized rules|has accused|has signed|now account|aims to finalize|will tighten|has chosen)\b/i.test(value)) return true;
  if (/\b(?:inside the story|The Economic Times|surfacing|directs MeitY|front and center)\b/i.test(value)) return true;
  if (/(?:\$[0-9.]+ billion|[0-9]+ trillion rupees|T\$|HK\$|\bRs\s)/i.test(value)) return true;

  return false;
}

function escapeXmlForCheck(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
