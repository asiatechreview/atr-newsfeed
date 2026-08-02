import { API_BASE_PATH, API_VERSION, SITE_NAME, SITE_URL, json } from "../../_lib/public-api.js";

export async function onRequestGet({ request }) {
  const origin = new URL(request.url).origin || SITE_URL;

  return json({
    name: SITE_NAME,
    type: "api_version",
    version: API_VERSION,
    base_url: `${origin}${API_BASE_PATH}`,
    resources: {
      items: `${origin}${API_BASE_PATH}/items`,
      categories: `${origin}${API_BASE_PATH}/categories`,
      search: `${origin}${API_BASE_PATH}/search`
    },
    schema: {
      item_type: "bulletin_item",
      fields: [
        "id",
        "title",
        "blurb",
        "source_name",
        "source_url",
        "category",
        "tags",
        "published_at"
      ]
    }
  });
}
