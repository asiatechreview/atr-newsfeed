import { categoriesFromItems, json, loadBulletinItems, toPublicItem } from "../../_lib/public-api.js";

export async function onRequestGet({ request }) {
  const items = (await loadBulletinItems(request, { limit: 500 })).map(toPublicItem);

  return json({
    type: "bulletin_category_collection",
    count: categoriesFromItems(items).length,
    generated_at: new Date().toISOString(),
    categories: categoriesFromItems(items)
  });
}
