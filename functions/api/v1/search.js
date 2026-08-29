import { clampLimit, filterItems, json, summarizeCollection, toPublicItem } from "../../_lib/public-api.js";
import {
  balanceArchiveDates,
  loadSheetItems,
  loadStaticItems,
  mergeItems,
  rebalanceJulyArchiveDates,
  withHeadlines
} from "../items.js";

const SEARCH_LIMIT = 1000;
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
  let d1Total = 0;
  if (env?.ATR_FEED_DB) {
    const params = ["published"];
    const where = ["status = ?"];
    let sql = `SELECT ${SELECT} FROM feed_items WHERE status = ?`;
    if (category) {
      where.push("category = ?");
      params.push(category);
    }
    if (tag) {
      where.push("LOWER(COALESCE(tags, '') || ',' || COALESCE(category, '')) LIKE ?");
      params.push(`%${tag.toLowerCase()}%`);
    }
    for (const term of String(query || "").toLowerCase().split(/\s+/).filter(Boolean)) {
      where.push(`(
        LOWER(COALESCE(headline, '')) LIKE ?
        OR LOWER(COALESCE(blurb, '')) LIKE ?
        OR LOWER(COALESCE(source_name, '')) LIKE ?
        OR LOWER(COALESCE(source_url, '')) LIKE ?
        OR LOWER(COALESCE(category, '')) LIKE ?
        OR LOWER(COALESCE(tags, '')) LIKE ?
      )`);
      for (let i = 0; i < 6; i += 1) params.push(`%${term}%`);
    }
    sql = `SELECT ${SELECT} FROM feed_items WHERE ${where.join(" AND ")}`;
    sql += " ORDER BY published_at DESC, id DESC LIMIT ?";
    params.push(SEARCH_LIMIT);

    try {
      const result = await env.ATR_FEED_DB.prepare(sql).bind(...params).all();
      d1Items = result.results || [];
      const countSql = `SELECT COUNT(*) AS count FROM feed_items WHERE ${where.join(" AND ")}`;
      const countParams = params.slice(0, -1);
      const countRow = await env.ATR_FEED_DB.prepare(countSql).bind(...countParams).first();
      d1Total = Number(countRow?.count) || d1Items.length;
    } catch (error) {
      d1Items = [];
      d1Total = 0;
    }
  }

  // Static archive items (md-*, html-*, manual-telegram-*) live in code.
  // Drop any static item whose source_url already exists in D1, matching the
  // dedupe rule in /api/items so stale originals never surface.
  const d1SourceUrls = new Set(d1Items.map((d1) => String(d1.source_url || "").toLowerCase()).filter(Boolean));
  const staticItems = loadStaticItems({ limit: SEARCH_LIMIT, category }).filter((item) => {
    if (!item?.source_url) return true;
    const url = String(item.source_url).toLowerCase();
    return !d1SourceUrls.has(url);
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
    ...summarizeCollection(filtered.slice(offset, offset + limit), request, limit, Math.max(filtered.length, d1Total), offset),
    query,
    tag
  });
}
