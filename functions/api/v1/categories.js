import { categoriesFromItems, json, loadAllBulletinItems, toPublicItem } from "../../_lib/public-api.js";

export async function onRequestGet({ request }) {
  const source = await loadAllBulletinItems(request);
  const items = source.items.map(toPublicItem);
  const categories = categoriesFromItems(items);

  return json({
    type: "bulletin_category_collection",
    count: categories.length,
    total_items: source.total,
    generated_at: new Date().toISOString(),
    categories
  });
}
