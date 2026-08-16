// /api/ai-assist — admin AI-assist endpoint backed by Qwen (Workers AI).
//
// Advisory only: every result must be reviewed by the human before saving.
// Actions:
//   suggest_headline  { blurb }                     -> { result }
//   suggest_category  { blurb, headline? }          -> { result }
//   suggest_tags      { blurb, headline? }          -> { tags: [] }
//   tighten_blurb     { blurb }                     -> { result }
//   check_duplicates  { blurb, headline?, sourceUrl? } -> { matches: [...] }
//
// Auth mirrors /api/story-match: admin session or FEED_INGEST_TOKEN bearer.

import { isAdmin, isValidBearer } from "../_lib/admin-auth.js";
import {
  runQwen,
  suggestHeadline,
  suggestCategory,
  suggestTags,
  tightenBlurb,
  checkSemanticDuplicates
} from "../_lib/qwen-assist.js";

const DUPLICATE_CANDIDATE_LIMIT = 40;

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

async function readInput(request) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());
  if (Object.keys(params).length) return params;

  return request
    .json()
    .then((body) => ({
      action: String(body.action || ""),
      blurb: String(body.blurb || ""),
      headline: String(body.headline || ""),
      sourceUrl: String(body.sourceUrl || "")
    }))
    .catch(() => ({}));
}

async function loadDuplicateCandidates(env) {
  if (!env?.ATR_FEED_DB) return [];
  const result = await env.ATR_FEED_DB.prepare(
    `SELECT id, headline, blurb, source_name, source_url, category, published_at
     FROM feed_items
     WHERE status = 'published'
     ORDER BY published_at DESC, id DESC
     LIMIT ?`
  )
    .bind(DUPLICATE_CANDIDATE_LIMIT)
    .all();
  return (result.results || []).map((row) => ({
    id: String(row.id),
    headline: row.headline || row.title || "",
    blurb: row.blurb || "",
    source_name: row.source_name || "",
    source_url: row.source_url || ""
  }));
}

async function handle({ env, request }) {
  if (!(await isAllowed(env, request))) {
    return json({ error: "Unauthorized" }, 401);
  }

  const input = await readInput(request);
  const action = String(input.action || "").trim();
  const blurb = String(input.blurb || "").trim();
  const headline = String(input.headline || "").trim();
  const sourceUrl = String(input.sourceUrl || "").trim();

  if (!action) {
    return json({ error: "action is required (suggest_headline, suggest_category, suggest_tags, tighten_blurb, check_duplicates)" }, 400);
  }

  try {
    switch (action) {
      case "suggest_headline": {
        if (!blurb) return json({ error: "blurb is required" }, 400);
        const result = await suggestHeadline(env, blurb);
        if (!result) return json({ error: "AI assist unavailable or produced no headline" }, 502);
        return json({ result });
      }

      case "suggest_category": {
        if (!blurb) return json({ error: "blurb is required" }, 400);
        const result = await suggestCategory(env, blurb, headline);
        if (!result) return json({ error: "AI assist unavailable or produced no category" }, 502);
        return json({ result });
      }

      case "suggest_tags": {
        if (!blurb) return json({ error: "blurb is required" }, 400);
        const tags = await suggestTags(env, blurb, headline);
        return json({ tags });
      }

      case "tighten_blurb": {
        if (!blurb) return json({ error: "blurb is required" }, 400);
        const result = await tightenBlurb(env, blurb);
        if (!result) return json({ error: "AI assist unavailable or produced no blurb" }, 502);
        return json({ result });
      }

      case "check_duplicates": {
        if (!blurb && !headline) return json({ error: "blurb or headline is required" }, 400);
        const candidates = await loadDuplicateCandidates(env);
        const ids = await checkSemanticDuplicates(env, headline, blurb, candidates);
        const matches = candidates
          .filter((c) => ids.includes(c.id))
          .map((c) => ({
            id: c.id,
            headline: c.headline,
            source_name: c.source_name,
            source_url: c.source_url
          }));
        return json({ matches, checked: candidates.length });
      }

      default:
        return json({ error: `unknown action: ${action}` }, 400);
    }
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}

export async function onRequestGet({ env, request }) {
  return handle({ env, request });
}

export async function onRequestPost({ env, request }) {
  return handle({ env, request });
}
