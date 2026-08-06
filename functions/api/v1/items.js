import { clampLimit, filterItems, json, loadAllBulletinItems, loadBulletinItems, summarizeCollection, toPublicItem } from "../../_lib/public-api.js";

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const limit = clampLimit(url.searchParams.get("limit"));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  const category = url.searchParams.get("category");
  const date = url.searchParams.get("date");
  const query = url.searchParams.get("q");

  if (query) {
    const source = await loadAllBulletinItems(request, { category, date });
    const filtered = filterItems(source.items.map(toPublicItem), { query });

    return json(summarizeCollection(
      filtered.slice(offset, offset + limit),
      request,
      limit,
      filtered.length,
      offset
    ));
  }

  const source = await loadBulletinItems(request, { limit, offset, category, date });

  return json(summarizeCollection(
    source.items.map(toPublicItem),
    request,
    limit,
    source.total,
    offset
  ));
}
