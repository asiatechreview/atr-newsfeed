import { clampLimit, filterItems, json, loadBulletinItems, summarizeCollection, toPublicItem } from "../../_lib/public-api.js";

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q");
  const category = url.searchParams.get("category");
  const limit = clampLimit(url.searchParams.get("limit"));

  if (!query) {
    return json({
      error: "Missing q parameter",
      example: "/api/v1/search?q=AI"
    }, 400, 60);
  }

  const items = filterItems((await loadBulletinItems(request, { limit: 500 })).map(toPublicItem), {
    query,
    category
  }).slice(0, limit);

  return json({
    ...summarizeCollection(items, request, limit),
    query
  });
}
