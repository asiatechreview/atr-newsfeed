import { ensureSiteContentTable, readSiteContent, writeSiteContent } from "./site-content.js";
import { ensureOperationalEventsTable, writeOperationalEvent } from "./operational-log.js";

const SUBSTACK_FEED_URL = "https://www.asiatechreview.com/feed";

// Shared newsletter refresh: fetches the latest Substack post and writes it to
// site-content when it differs from what is stored. Used by the scheduled
// newsletter cron (functions/_scheduled.js) and the manual admin trigger
// (POST /api/site-content/newsletter/refresh). Returns
// { updated: boolean, item: { title, blurb, url, image } }.
export async function refreshNewsletterCardFromFeed(env, request = null) {
  await ensureSiteContentTable(env);
  await ensureOperationalEventsTable(env);

  const feedResponse = await fetch(SUBSTACK_FEED_URL, {
    headers: { accept: "application/xml" }
  });
  if (!feedResponse.ok) {
    await writeOperationalEvent(env, request, {
      workflow: "site_content",
      action: "newsletter_auto_refresh",
      status: "error",
      severity: "error",
      http_status: feedResponse.status,
      message: `Newsletter auto-refresh failed: feed returned ${feedResponse.status}.`
    });
    throw new Error(`Feed returned ${feedResponse.status}`);
  }

  const xml = await feedResponse.text();
  const item = parseFirstFeedItem(xml);
  if (!item || !item.link || !item.title) {
    await writeOperationalEvent(env, request, {
      workflow: "site_content",
      action: "newsletter_auto_refresh",
      status: "error",
      severity: "error",
      message: "Newsletter auto-refresh failed: no usable item in feed."
    });
    throw new Error("No usable item in feed");
  }

  const content = await readSiteContent(env);
  const stored = content.newsletter || {};

  if (item.link === stored.url) {
    await writeOperationalEvent(env, request, {
      workflow: "site_content",
      action: "newsletter_auto_refresh",
      status: "success",
      severity: "info",
      message: "Newsletter card already current; no update needed.",
      details: { url: item.link }
    });
    return { updated: false, item };
  }

  await writeSiteContent(env, {
    newsletter: {
      title: item.title,
      blurb: item.description || item.title,
      url: item.link,
      image: item.image || stored.image || ""
    }
  }, request ? "admin:newsletter-refresh" : "scheduled:substack-refresh");

  await writeOperationalEvent(env, request, {
    workflow: "site_content",
    action: "newsletter_auto_refresh",
    status: "success",
    severity: "info",
    message: "Newsletter card updated to the latest Substack post.",
    details: { title: item.title, url: item.link }
  });

  return { updated: true, item };
}

export function parseFirstFeedItem(xml) {
  const blockMatch = String(xml || "").match(/<item[\s>][\s\S]*?<\/item>/i) || String(xml || "").match(/<entry[\s>][\s\S]*?<\/entry>/i);
  if (!blockMatch) return null;

  const block = blockMatch[0];
  const title = decodeEntities(stripTags(extractTag(block, "title")));
  const link = decodeEntities(extractTag(block, "link")).trim();
  const description = decodeEntities(stripTags(extractTag(block, "description")));
  const imageMatch = block.match(/<enclosure[^>]*url="([^"]+)"/i);
  const image = imageMatch ? decodeEntities(imageMatch[1]) : "";

  return { title, link, description, image };
}

function extractTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? match[1].trim() : "";
}

function stripTags(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(value) {
  const named = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: "\"",
    apos: "'",
    nbsp: " ",
    mdash: "—",
    ndash: "–",
    hellip: "…",
    rsquo: "’",
    lsquo: "‘",
    rdquo: "”",
    ldquo: "“"
  };
  return String(value || "")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (match, name) => (name in named ? named[name] : match));
}
