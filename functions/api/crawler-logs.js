import { classifyBot, ensureCrawlerAccessLogTable } from "../_lib/crawler-log.js";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export async function onRequestGet({ env, request }) {
  if (!isAuthorized(env, request)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || DEFAULT_LIMIT, MAX_LIMIT);
  const path = clean(url.searchParams.get("path"));
  const bot = clean(url.searchParams.get("bot"));
  const since = clean(url.searchParams.get("since"));
  const params = [];
  const filters = [];

  await ensureCrawlerAccessLogTable(env);

  if (path) {
    filters.push("path = ?");
    params.push(path);
  }

  if (bot) {
    filters.push("bot_name = ?");
    params.push(bot);
  }

  if (since) {
    filters.push("requested_at >= ?");
    params.push(since);
  }

  let query = "SELECT id, requested_at, path, method, status, user_agent, bot_name, country, colo FROM crawler_access_logs";
  if (filters.length) {
    query += ` WHERE ${filters.join(" AND ")}`;
  }
  query += " ORDER BY requested_at DESC, id DESC LIMIT ?";
  params.push(limit);

  const result = await env.ATR_FEED_DB.prepare(query).bind(...params).all();
  const logs = result.results || [];

  return json({
    logs,
    summary: summarize(logs)
  });
}

function summarize(logs) {
  const byPath = {};
  const byBot = {};

  for (const log of logs) {
    byPath[log.path] = (byPath[log.path] || 0) + 1;
    const botName = log.bot_name || classifyBot(log.user_agent) || "Unclassified";
    byBot[botName] = (byBot[botName] || 0) + 1;
  }

  return {
    total: logs.length,
    byPath,
    byBot
  };
}

function isAuthorized(env, request) {
  const auth = request.headers.get("authorization") || "";
  const expected = env.FEED_INGEST_TOKEN ? `Bearer ${env.FEED_INGEST_TOKEN}` : "";

  return Boolean(expected && auth === expected);
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
