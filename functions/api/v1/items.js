import { clampLimit, filterItems, json, loadBulletinItems, summarizeCollection, toPublicItem } from "../../_lib/public-api.js";

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const limit = clampLimit(url.searchParams.get("limit"));
  const category = url.searchParams.get("category");
  const date = url.searchParams.get("date");
  const query = url.searchParams.get("q");

  const sourceItems = await loadBulletinItems(request, {
    limit: 500,
    category,
    date
  });
  const items = filterItems(sourceItems.map(toPublicItem), { query })
    .slice(0, limit);

  return json(summarizeCollection(items, request, limit));
}
