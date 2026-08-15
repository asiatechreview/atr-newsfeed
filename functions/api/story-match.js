// /api/story-match — entity-based duplicate guard endpoint.
//
// POST/GET with headline + blurb (and optional sourceUrl) returns probable
// duplicates: existing items sharing the same company AND event type within
// the match window. Used by the admin publish form (session auth) and the
// ingest helper (FEED_INGEST_TOKEN bearer auth).
//
//   GET  /api/story-match?headline=...&blurb=...
//   POST /api/story-match  { headline, blurb, sourceUrl? }
//
// Response: { matches: [{ id, company, event, headline, source_name,
// source_url, category, published_at, days_ago }] }

import { isAdmin, isValidBearer } from "../_lib/admin-auth.js";
import { findStoryMatches } from "../_lib/story-match.js";

const MATCH_LIMIT = 5000;

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

async function isAllowed(env, request) {
  try {
    if (await isAdmin(env, request)) return true;
  } catch {
    // fall through to bearer check
  }
  return isValidBearer(env, request);
}

function readInput(request) {
  const url = new URL(request.url);
  const headline = url.searchParams.get("headline") || "";
  const blurb = url.searchParams.get("blurb") || "";
  if (headline || blurb) return { headline, blurb };

  return request
    .json()
    .then((body) => ({
      headline: String(body.headline || ""),
      blurb: String(body.blurb || "")
    }))
    .catch(() => ({ headline: "", blurb: "" }));
}

export async function onRequestGet({ env, request }) {
  return handle({ env, request });
}

export async function onRequestPost({ env, request }) {
  return handle({ env, request });
}

async function handle({ env, request }) {
  if (!(await isAllowed(env, request))) {
    return json({ error: "Unauthorized" }, 401);
  }
  if (!env?.ATR_FEED_DB) {
    return json({ error: "database unavailable" }, 500);
  }

  const { headline, blurb } = await readInput(request);
  if (!headline && !blurb) {
    return json({ error: "headline or blurb is required" }, 400);
  }

  try {
    // Match against published items in the window. Items are ordered newest
    // first; findStoryMatches applies the 7-day window itself.
    const result = await env.ATR_FEED_DB.prepare(
      `SELECT id, headline, blurb, source_name, source_url, category, published_at
       FROM feed_items
       WHERE status = 'published'
       ORDER BY published_at DESC, id DESC
       LIMIT ?`
    )
      .bind(MATCH_LIMIT)
      .all();

    const matches = findStoryMatches(result.results || [], { headline, blurb });
    return json({ matches });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}
