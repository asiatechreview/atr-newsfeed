import { ensureSiteContentTable, readSiteContent, writeSiteContent } from "./site-content.js";
import { ensureOperationalEventsTable, writeOperationalEvent } from "./operational-log.js";

const SUBSTACK_FEED_URL = "https://www.asiatechreview.com/feed";

// Shared newsletter refresh: fetches the latest Substack post and writes it to
// site-content when it differs from what is stored. Used by the scheduled
// newsletter cron (functions/_scheduled.js) and the manual admin trigger
// (POST /api/site-content/newsletter/refresh). Returns
// { updated: boolean, item: { title, subhead, blurb, url, image } }.
export async function refreshNewsletterCardFromFeed(env, request = null) {
  await ensureSiteContentTable(env);
  await ensureOperationalEventsTable(env);

  // Read this before contacting Substack. If its feed temporarily rate-limits
  // us, a manual refresh must preserve the existing verified card instead of
  // surfacing a dead-end error to Telegram.
  const content = await readSiteContent(env);
  const stored = content.newsletter || {};

  const feedResponse = await fetchFreshFeedWithRetry();
  if (!feedResponse.ok) {
    const fallbackItem = stored.url && stored.title
      ? { title: stored.title, subhead: stored.blurb || "", blurb: stored.blurb || "", link: stored.url, image: stored.image || "" }
      : null;
    await writeOperationalEvent(env, request, {
      workflow: "site_content",
      action: "newsletter_auto_refresh",
      status: fallbackItem ? "degraded" : "error",
      severity: fallbackItem ? "warning" : "error",
      http_status: feedResponse.status,
      message: fallbackItem
        ? `Newsletter refresh retained the existing card after feed returned ${feedResponse.status}.`
        : `Newsletter auto-refresh failed: feed returned ${feedResponse.status}.`
    });
    if (fallbackItem) return { updated: false, item: fallbackItem, fallback: true, feedStatus: feedResponse.status };
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
      // Substack exposes a post's subhead as the RSS item description.
      // Keep the explicit field here so a manual refresh cannot overwrite the
      // card's Subhead with the title or an old stored value.
      blurb: item.subhead || item.title,
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

async function fetchFreshFeedWithRetry() {
  // Substack can rate-limit an uncached Worker fetch. Retry only 429/5xx,
  // honouring Retry-After where available, then let the caller retain the
  // known-good card rather than claiming the update failed.
  let response;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const feedUrl = new URL(SUBSTACK_FEED_URL);
    feedUrl.searchParams.set("atr_refresh", `${Date.now()}-${attempt}`);
    response = await fetch(feedUrl.toString(), {
      cache: "no-store",
      headers: {
        accept: "application/xml",
        "cache-control": "no-cache",
        "user-agent": "Mozilla/5.0 (compatible; ATR-Newsfeed/1.0)"
      }
    });
    if (response.ok || (response.status !== 429 && response.status < 500)) return response;
    if (attempt < 2) await delay(retryDelayMs(response, attempt));
  }
  return response;
}

function retryDelayMs(response, attempt) {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1000, 8000);
  return 800 * (attempt + 1);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseFirstFeedItem(xml) {
  const blockMatch = String(xml || "").match(/<item[\s>][\s\S]*?<\/item>/i) || String(xml || "").match(/<entry[\s>][\s\S]*?<\/entry>/i);
  if (!blockMatch) return null;

  const block = blockMatch[0];
  const title = decodeEntities(stripTags(extractTag(block, "title")));
  const link = decodeEntities(extractTag(block, "link")).trim();
  // On Substack's RSS feed, <description> is the post subhead. Prefer it,
  // with itunes:subtitle as a compatibility fallback for other feed shapes.
  const subhead = decodeEntities(stripTags(
    extractTag(block, "description") || extractTag(block, "itunes:subtitle")
  ));
  const imageMatch = block.match(/<enclosure[^>]*url="([^"]+)"/i);
  const image = imageMatch ? decodeEntities(imageMatch[1]) : "";

  // `blurb` preserves the shape expected by the admin form; `subhead` makes
  // the source value explicit for callers and readbacks.
  return { title, subhead, blurb: subhead, link, image };
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
