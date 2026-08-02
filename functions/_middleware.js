import { shouldLogCrawlerPath, writeCrawlerAccessLog } from "./_lib/crawler-log.js";

export async function onRequest(context) {
  const response = await context.next();
  const pathname = new URL(context.request.url).pathname;

  if (shouldLogCrawlerPath(pathname)) {
    context.waitUntil(writeCrawlerAccessLog({
      env: context.env,
      request: context.request,
      response
    }));
  }

  return response;
}
