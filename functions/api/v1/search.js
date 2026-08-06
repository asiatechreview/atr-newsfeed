import { clampLimit, filterItems, json, loadAllBulletinItems, summarizeCollection, toPublicItem } from "../../_lib/public-api.js";

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q");
  const category = url.searchParams.get("category");
  const limit = clampLimit(url.searchParams.get("limit"));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

  if (!query) {
    return json({
      error: "Missing q parameter",
      example: "/api/v1/search?q=AI"
    }, 400, 60);
  }

  const source = await loadAllBulletinItems(request, { category });
  const filtered = filterItems(source.items.map(toPublicItem), {
    query,
    category
  });

  return json({
    ...summarizeCollection(filtered.slice(offset, offset + limit), request, limit, filtered.length, offset),
    query
  });
}
