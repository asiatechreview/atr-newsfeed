import { clampLimit, filterItems, json, summarizeCollection, toPublicItem } from "../../_lib/public-api.js";
import {
  balanceArchiveDates,
  loadSheetItems,
  loadStaticItems,
  mergeItems,
  rebalanceJulyArchiveDates,
  withHeadlines
} from "../items.js";

const SEARCH_LIMIT = 10000;
const SELECT = "id, headline, blurb, source_name, source_url, category, tags, telegram_message_id, published_at, created_at, link_key";

export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q");
  const category = url.searchParams.get("category");
  const tag = url.searchParams.get("tag");
  const limit = clampLimit(url.searchParams.get("limit"));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

  if (!query && !tag) {
    return json({
      error: "Missing q parameter",
      example: "/api/v1/search?q=AI"
    }, 400, 60);
  }

  // Fast path: one direct D1 query over published items. The previous
  // implementation paged through /api/items via internal HTTP fetches, which
  // ran the full pipeline (migrations, static merge, date balancing) once per
  // page and took seconds on the full archive.
  let d1Items = [];
  if (env?.ATR_FEED_DB) {
    const params = ["published"];
    let sql = `SELECT ${SELECT} FROM feed_items WHERE status = ?`;
    if (category) {
      sql += " AND category = ?";
      params.push(category);
    }
    sql += " ORDER BY published_at DESC, id DESC LIMIT ?";
    params.push(SEARCH_LIMIT);

    try {
      const result = await env.ATR_FEED_DB.prepare(sql).bind(...params).all();
      d1Items = result.results || [];
    } catch (error) {
      d1Items = [];
    }
  }

  // Static archive items (md-*, html-*, manual-telegram-*) live in code.
  // Drop any static item whose source_url already exists in D1, matching the
  // dedupe rule in /api/items so stale originals never surface.
  const staticItems = loadStaticItems({ limit: SEARCH_LIMIT, category }).filter((item) => {
    if (!item?.source_url) return true;
    const url = String(item.source_url).toLowerCase();
    return !d1Items.some((d1) => String(d1.source_url || "").toLowerCase() === url);
  });

  const merged = balanceArchiveDates(rebalanceJulyArchiveDates(mergeItems(d1Items, staticItems)));

  let publicItems;
  if (merged.length) {
    publicItems = withHeadlines(merged);
  } else {
    // Fallback mirrors /api/items: the sheet CSV when D1 and static are empty.
    const sheetItems = await loadSheetItems({ category });
    publicItems = withHeadlines(sheetItems);
  }

  const filtered = filterItems(publicItems.map(toPublicItem), {
    query,
    category,
    tag
  });

  return json({
    ...summarizeCollection(filtered.slice(offset, offset + limit), request, limit, filtered.length, offset),
    query,
    tag
  });
}
