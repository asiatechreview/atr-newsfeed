const LOGGED_PATHS = new Set([
  "/robots.txt",
  "/llms.txt",
  "/feed.json",
  "/rss.xml"
]);

const BOT_PATTERNS = [
  ["GPTBot", /GPTBot/i],
  ["ChatGPT-User", /ChatGPT-User/i],
  ["OpenAI-SearchBot", /OpenAI-SearchBot/i],
  ["ClaudeBot", /ClaudeBot/i],
  ["Claude-User", /Claude-User/i],
  ["PerplexityBot", /PerplexityBot/i],
  ["Perplexity-User", /Perplexity-User/i],
  ["Google-Extended", /Google-Extended/i],
  ["Googlebot", /Googlebot/i],
  ["Bingbot", /bingbot/i],
  ["CCBot", /CCBot/i],
  ["Bytespider", /Bytespider/i],
  ["Applebot", /Applebot/i],
  ["Meta-ExternalAgent", /Meta-ExternalAgent/i]
];

export function shouldLogCrawlerPath(pathname) {
  return LOGGED_PATHS.has(pathname);
}

export function classifyBot(userAgent) {
  const value = String(userAgent || "");
  const match = BOT_PATTERNS.find(([, pattern]) => pattern.test(value));
  return match ? match[0] : null;
}

export async function writeCrawlerAccessLog({ env, request, response }) {
  if (!env?.ATR_FEED_DB) return;

  const url = new URL(request.url);
  if (!shouldLogCrawlerPath(url.pathname)) return;

  const userAgent = (request.headers.get("user-agent") || "").slice(0, 500);
  const cf = request.cf || {};

  try {
    await ensureCrawlerAccessLogTable(env);
    await env.ATR_FEED_DB.prepare(
      `INSERT INTO crawler_access_logs
        (path, method, status, user_agent, bot_name, country, colo)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        url.pathname,
        request.method,
        response?.status || null,
        userAgent,
        classifyBot(userAgent),
        typeof cf.country === "string" ? cf.country : null,
        typeof cf.colo === "string" ? cf.colo : null
      )
      .run();
  } catch {
    // Logging must never break the public bulletin, feeds, or crawler files.
  }
}

export async function ensureCrawlerAccessLogTable(env) {
  if (!env?.ATR_FEED_DB) return;

  await env.ATR_FEED_DB.prepare(
    `CREATE TABLE IF NOT EXISTS crawler_access_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requested_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      path TEXT NOT NULL,
      method TEXT NOT NULL,
      status INTEGER,
      user_agent TEXT NOT NULL DEFAULT '',
      bot_name TEXT,
      country TEXT,
      colo TEXT
    )`
  ).run();

  await env.ATR_FEED_DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_crawler_access_logs_requested_at ON crawler_access_logs (requested_at DESC)"
  ).run();

  await env.ATR_FEED_DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_crawler_access_logs_path ON crawler_access_logs (path, requested_at DESC)"
  ).run();
}
