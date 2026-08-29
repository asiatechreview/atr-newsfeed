import { API_BASE_PATH, SITE_URL, json } from "../../_lib/public-api.js";
import { SEED_CATEGORIES } from "../../_lib/categories.js";

export async function onRequestGet({ env }) {
  const { categories, total } = await loadCategoryCounts(env);

  return json({
    type: "bulletin_category_collection",
    count: categories.length,
    total_items: total,
    generated_at: new Date().toISOString(),
    categories
  });
}

async function loadCategoryCounts(env) {
  const seeds = SEED_CATEGORIES.map((cat) => cat.name);
  if (!env?.ATR_FEED_DB) {
    return {
      total: 0,
      categories: seeds.map((name) => publicCategory(name, 0))
    };
  }

  const countRows = await env.ATR_FEED_DB.prepare(
    "SELECT category, COUNT(*) AS count FROM feed_items WHERE status = 'published' AND category IS NOT NULL AND category != '' GROUP BY category"
  ).all();

  const counts = new Map((countRows.results || []).map((row) => [row.category, Number(row.count) || 0]));
  const names = new Set(seeds);

  try {
    const tableRows = await env.ATR_FEED_DB.prepare(
      "SELECT name FROM categories ORDER BY sort_order ASC, name ASC"
    ).all();
    for (const row of tableRows.results || []) {
      if (row.name) names.add(row.name);
    }
  } catch {
    // Public category metadata should not create or migrate tables on request.
  }

  for (const name of counts.keys()) {
    names.add(name);
  }

  const categories = [...names]
    .map((name) => publicCategory(name, counts.get(name) || 0))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return {
    total: [...counts.values()].reduce((sum, count) => sum + count, 0),
    categories
  };
}

function publicCategory(name, count) {
  return {
    type: "bulletin_category",
    name,
    count,
    items_url: `${SITE_URL}${API_BASE_PATH}/items?category=${encodeURIComponent(name)}`
  };
}
