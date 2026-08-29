import { json, loadAllBulletinItems, publicId, stripPublicId, toPublicItem } from "../../../_lib/public-api.js";
import { loadStaticItems, withHeadlines } from "../../items.js";

const SELECT = "id, headline, blurb, source_name, source_url, category, tags, telegram_message_id, published_at, created_at, link_key";

export async function onRequestGet({ env, params, request }) {
  const requestedId = stripPublicId(params.id);
  const isNumeric = /^\d+$/.test(requestedId);
  const item = env?.ATR_FEED_DB
    ? await lookupDirect(env, requestedId, isNumeric)
    : await lookupViaFallback(request, requestedId, isNumeric);

  if (!item) {
    return json({
      error: "Not found",
      id: publicId(requestedId)
    }, 404, 60);
  }

  return json(item);
}

async function lookupDirect(env, requestedId, isNumeric) {
  try {
    const row = await env.ATR_FEED_DB.prepare(
      `SELECT ${SELECT}
       FROM feed_items
       WHERE status = 'published'
         AND (id = ?1 OR LOWER(link_key) = LOWER(?2))
       LIMIT 1`
    )
      .bind(isNumeric ? Number(requestedId) : 0, requestedId)
      .first();
    if (row) return toPublicItem(withHeadlines([row])[0]);
  } catch {
    // Fall through to the static archive.
  }

  return lookupStatic(requestedId, isNumeric);
}

function lookupStatic(requestedId, isNumeric) {
  return loadStaticItems({ limit: 500 })
    .map((item) => toPublicItem(withHeadlines([item])[0]))
    .find((candidate) =>
      isNumeric
        ? stripPublicId(candidate.id) === requestedId || stripPublicId(candidate.raw_id) === requestedId || candidate.id === publicId(requestedId)
        : candidate.link_key === requestedId.toLowerCase() || candidate.raw_id === requestedId || candidate.id === publicId(requestedId)
    ) || null;
}

async function lookupViaFallback(request, requestedId, isNumeric) {
  const source = await loadAllBulletinItems(request);
  return source.items
    .map(toPublicItem)
    .find((candidate) =>
      isNumeric
        ? stripPublicId(candidate.id) === requestedId || stripPublicId(candidate.raw_id) === requestedId || candidate.id === publicId(requestedId)
        : candidate.link_key === requestedId.toLowerCase() || candidate.raw_id === requestedId || candidate.id === publicId(requestedId)
    ) || null;
}
