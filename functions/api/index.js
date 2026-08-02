import { API_BASE_PATH, API_VERSION, SITE_NAME, SITE_URL, json } from "../_lib/public-api.js";

export async function onRequestGet({ request }) {
  const origin = new URL(request.url).origin || SITE_URL;

  return json({
    name: SITE_NAME,
    type: "api_index",
    version: API_VERSION,
    description: "Machine-readable access to published Asia Tech Review Bulletin items.",
    base_url: `${origin}${API_BASE_PATH}`,
    endpoints: {
      items: `${origin}${API_BASE_PATH}/items`,
      item: `${origin}${API_BASE_PATH}/items/{id}`,
      categories: `${origin}${API_BASE_PATH}/categories`,
      search: `${origin}${API_BASE_PATH}/search?q=semiconductors`,
      openapi: `${origin}/api/openapi.json`,
      json_feed: `${origin}/feed.json`,
      rss: `${origin}/rss.xml`,
      llms: `${origin}/llms.txt`
    },
    guidance: {
      preferred_for_agents: `${origin}${API_BASE_PATH}/items`,
      cite: "Use source_url as the primary citation for each bulletin item.",
      access: "Public, read-only, published bulletin data only. Protected crawler logs are not included."
    }
  });
}
