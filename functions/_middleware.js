import { shouldLogCrawlerPath, writeCrawlerAccessLog } from "./_lib/crawler-log.js";
import { ensureSiteContentTable, readSiteContent } from "./_lib/site-content.js";

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
    const injected = await injectLatestNewsletter(response, context.env);
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

// Replace the static fallback newsletter card in the homepage HTML with the
// stored latest post, so the first paint is already current and there is no
// flash of an older Substack post before the client-side swap.
async function injectLatestNewsletter(response, env) {
  try {
    await ensureSiteContentTable(env);
    const content = await readSiteContent(env);
    const newsletter = content.newsletter || {};
    const title = escapeHtml(newsletter.title || "");
    const blurb = escapeHtml(newsletter.blurb || "");
    const url = escapeHtml(newsletter.url || "");
    const image = escapeHtml(newsletter.image || "");
    if (!title && !url) return null;

    const html = await response.text();
    let next = html;
    if (url) {
      next = next.replaceAll("https://www.asiatechreview.com/p/grab-bets-on-fintech-to-reinforce", url);
    }
    if (image) {
      next = next.replaceAll(
        "https://substackcdn.com/image/fetch/$s_!PMQo!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F5db78b08-9f8e-4b8f-9ba1-bcdb75abfb84_1672x941.png",
        image
      );
    }
    next = next.replaceAll("Grab bets on fintech to reinforce its tech story", title);
    next = next.replaceAll("The company's bid to become a fintech heavyweight is about to face its first major test", blurb);

    if (next === html) return null;

    const headers = new Headers(response.headers);
    headers.set("content-type", "text/html; charset=utf-8");
    headers.set("cache-control", "public, max-age=60");
    return new Response(next, { status: response.status, headers });
  } catch {
    // Fall back to the static page; never break the homepage.
    return null;
  }
}
