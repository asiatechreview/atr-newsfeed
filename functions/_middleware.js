import { shouldLogCrawlerPath, writeCrawlerAccessLog } from "./_lib/crawler-log.js";

const PUBLIC_HOST = "bulletin.asiatechreview.com";
const DASHBOARD_PATHS = new Set([
  "/dashboard",
  "/dashboard/",
  "/dashboard.html",
  "/dashboard.css",
  "/dashboard.js",
  "/api/dashboard"
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

  if (shouldLogCrawlerPath(pathname)) {
    context.waitUntil(writeCrawlerAccessLog({
      env: context.env,
      request: context.request,
      response
    }));
  }

  return response;
}
