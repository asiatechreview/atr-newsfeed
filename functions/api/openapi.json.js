import { API_BASE_PATH, API_VERSION, SITE_NAME, SITE_URL, json } from "../_lib/public-api.js";

export async function onRequestGet({ request }) {
  const origin = new URL(request.url).origin || SITE_URL;

  return json({
    openapi: "3.1.0",
    info: {
      title: `${SITE_NAME} API`,
      version: API_VERSION,
      description: "Read-only machine-readable API for published Asia Tech Review Bulletin items."
    },
    servers: [
      {
        url: `${origin}${API_BASE_PATH}`
      }
    ],
    paths: {
      "/items": {
        get: {
          summary: "List latest bulletin items",
          parameters: [
            limitParam(),
            categoryParam(),
            dateParam(),
            queryParam()
          ],
          responses: collectionResponse()
        }
      },
      "/items/{id}": {
        get: {
          summary: "Fetch one bulletin item by ID",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
              example: "bulletin-247"
            }
          ],
          responses: {
            "200": {
              description: "Bulletin item",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/BulletinItem" }
                }
              }
            },
            "404": {
              description: "Item not found"
            }
          }
        }
      },
      "/categories": {
        get: {
          summary: "List bulletin categories",
          responses: {
            "200": {
              description: "Category collection"
            }
          }
        }
      },
      "/search": {
        get: {
          summary: "Search bulletin items",
          parameters: [
            {
              name: "q",
              in: "query",
              required: false,
              schema: { type: "string" },
              example: "AI"
            },
            {
              name: "tag",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "Filter by tag; matches items whose tags include this value",
              example: "chips"
            },
            limitParam(),
            categoryParam()
          ],
          responses: collectionResponse()
        }
      }
    },
    components: {
      schemas: {
        BulletinItem: {
          type: "object",
          required: ["type", "id", "title", "blurb", "source_url", "category", "published_at"],
          properties: {
            type: { const: "bulletin_item" },
            id: { type: "string", example: "bulletin-247" },
            raw_id: { type: "string", example: "247" },
            title: { type: "string" },
            blurb: { type: "string" },
            source_name: { type: "string" },
            source_url: { type: "string", format: "uri" },
            source: {
              type: "object",
              properties: {
                name: { type: "string" },
                url: { type: "string", format: "uri" }
              }
            },
            url: { type: "string", format: "uri" },
            category: { type: "string" },
            tags: {
              type: "array",
              items: { type: "string" }
            },
            published_at: { type: "string", format: "date-time" },
            date_published: { type: "string", format: "date-time" }
          }
        }
      }
    }
  });
}

function limitParam() {
  return {
    name: "limit",
    in: "query",
    required: false,
    schema: { type: "integer", default: 100, maximum: 500 }
  };
}

function categoryParam() {
  return {
    name: "category",
    in: "query",
    required: false,
    schema: { type: "string" }
  };
}

function dateParam() {
  return {
    name: "date",
    in: "query",
    required: false,
    schema: { type: "string", format: "date" },
    example: "2026-08-02"
  };
}

function queryParam() {
  return {
    name: "q",
    in: "query",
    required: false,
    schema: { type: "string" }
  };
}

function collectionResponse() {
  return {
    "200": {
      description: "Bulletin item collection",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              type: { const: "bulletin_item_collection" },
              count: { type: "integer" },
              limit: { type: "integer" },
              generated_at: { type: "string", format: "date-time" },
              items: {
                type: "array",
                items: { $ref: "#/components/schemas/BulletinItem" }
              }
            }
          }
        }
      }
    }
  };
}
