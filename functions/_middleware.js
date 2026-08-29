import { shouldLogCrawlerPath, writeCrawlerAccessLog } from "./_lib/crawler-log.js";
import { readSiteContent } from "./_lib/site-content.js";
import { ogMetaBlock, lookupItem } from "./_lib/og-preview.js";

const PUBLIC_HOST = "bulletin.asiatechreview.com";
const HOMEPAGE_PATHS = new Set(["/", "/index.html"]);
const DASHBOARD_PATHS = new Set([
  "/dashboard",
  "/dashboard/",
  "/dashboard.html",
  "/dashboard.css",
  "/dashboard.js",
  "/admin",
  "/admin/",
  "/admin.html",
  "/admin.css",
  "/admin.js",
  "/api/dashboard",
  "/api/analytics",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/auth/users"
]);

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const pathname = url.pathname;

  if (url.hostname === PUBLIC_HOST && DASHBOARD_PATHS.has(pathname)) {
    return new Response("Not found", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  }

  const response = await context.next();

  if (HOMEPAGE_PATHS.has(pathname) && isHtml(response)) {
    const injected = await injectHomepageMeta(response, context.env, url);
    if (injected) return injected;
  }

  if (shouldLogCrawlerPath(pathname)) {
    context.waitUntil(writeCrawlerAccessLog({
      env: context.env,
      request: context.request,
      response
    }));
  }

  return response;
}

function isHtml(response) {
  return (response.headers.get("content-type") || "").includes("text/html");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function newsletterImageProxyUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (url.protocol !== "https:") return "";
    if (!["substackcdn.com", "substack-post-media.s3.amazonaws.com"].includes(url.hostname)) return url.href;
    return `/api/newsletter-image?src=${encodeURIComponent(url.href)}`;
  } catch {
    return "";
  }
}

// Insert a block of meta tags just before </head>.
function insertBeforeHeadClose(html, metaBlock) {
  const marker = "</head>";
  const idx = html.indexOf(marker);
  if (idx === -1) return html + "\n  " + metaBlock;
  return html.slice(0, idx) + metaBlock + "\n  " + html.slice(idx);
}

// Compose OG/Twitter meta injection and the newsletter card swap on the same
// homepage HTML. Returns a new Response when anything changed, else null.

function formatItemTime(publishedAt) {
  try {
    const raw = String(publishedAt || "").trim().replace(" ", "T");
    const d = new Date(raw.endsWith("Z") || raw.includes("+") ? raw : raw + "Z");
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Bangkok" });
  } catch {
    return "";
  }
}

function preRenderItemCard(item) {
  if (!item) return "";
  const primaryTag = escapeHtml(item.region || item.category || "Tech");
  const headline = escapeHtml(item.headline || "");
  const blurb = escapeHtml(item.blurb || "");
  const sourceName = escapeHtml(item.source_name || "Source");
  const sourceUrl = escapeHtml(item.source_url || "#");
  const timeStr = escapeHtml(formatItemTime(item.published_at));
  const itemKey = String(item.id || item.link_key || "");

  return `
    <article class="item item-flash" data-item-key="${itemKey}">
      <div class="meta">
        <time class="item-time">${timeStr}</time>
        <a class="item-primary-tag" href="?tag=${encodeURIComponent(primaryTag)}">${primaryTag}</a>
      </div>
      <div class="item-main">
        <h3 class="headline">${headline}</h3>
        <p class="blurb">${blurb} <a href="${sourceUrl}" target="_blank" rel="noopener">[${sourceName}]</a></p>
      </div>
    </article>
  `;
}

async function injectHomepageMeta(response, env, url) {
  try {
    const original = await response.text();
    let html = original;
    let changed = false;
    let resolvedItem = null;

    const itemParam = url.searchParams.get("item");
    if (itemParam) {
      resolvedItem = await lookupItem(env, itemParam);
      if (resolvedItem) {
        const itemCardHtml = preRenderItemCard(resolvedItem);
        if (itemCardHtml) {
          html = html.replace(
            '<section id="feed-list" class="feed"></section>',
            `<section id="feed-list" class="feed">${itemCardHtml}</section>`
          );
          changed = true;
        }
      }
    }

    const ogTags = await ogMetaBlock(env, url, resolvedItem);
    if (ogTags && !html.includes('property="og:title"')) {
      html = insertBeforeHeadClose(html, ogTags);
      changed = true;
    }

    const newsletterHtml = await applyNewsletterHtml(html, env);
    if (newsletterHtml) {
      html = newsletterHtml;
      changed = true;
    }

    if (!changed) return null;

    const headers = new Headers(response.headers);
    headers.set("content-type", "text/html; charset=utf-8");
    headers.set("cache-control", itemParam
      ? "public, max-age=60, stale-while-revalidate=120"
      : "public, max-age=60");
    return new Response(html, { status: response.status, headers });
  } catch {
    // Fall back to the static page; never break the homepage.
    return null;
  }
}

// Replace the static fallback newsletter card in the homepage HTML with the
// stored latest post, so the first paint is already current and there is no
// flash of an older Substack post before the client-side swap.
async function applyNewsletterHtml(html, env) {
  try {
    const content = await readSiteContent(env);
    const newsletter = content.newsletter || {};
    const title = escapeHtml(newsletter.title || "");
    const blurb = escapeHtml(newsletter.blurb || "");
    const url = escapeHtml(newsletter.url || "");
    const image = escapeHtml(newsletterImageProxyUrl(newsletter.image) || newsletter.image || "");
    if (!title && !url) return null;

    let next = html;
    if (url) {
      next = next.replaceAll("https://www.asiatechreview.com/p/grab-bets-on-fintech-to-reinforce", url);
    }
    if (image) {
      next = next.replace(/(<img id="newsletter-image" src=")[^"]*(")/, `$1${image}$2`);
    }
    next = next.replaceAll("Grab bets on fintech to reinforce its tech story", title);
    next = next.replaceAll("The company's bid to become a fintech heavyweight is about to face its first major test", blurb);

    return next === html ? null : next;
  } catch {
    // Fall back to the static page; never break the homepage.
    return null;
  }
}
