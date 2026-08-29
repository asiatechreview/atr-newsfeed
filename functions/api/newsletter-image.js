import { readSiteContent } from "../_lib/site-content.js";

const IMAGE_WIDTH = 960;
const IMAGE_HEIGHT = 540;
const IMAGE_QUALITY = 78;
const CACHE_SECONDS = 7 * 24 * 60 * 60;
const ALLOWED_HOSTS = new Set([
  "substackcdn.com",
  "substack-post-media.s3.amazonaws.com"
]);

export async function onRequestGet({ env, request }) {
  const requestUrl = new URL(request.url);
  let source = requestUrl.searchParams.get("src") || "";

  if (!source) {
    const content = await readSiteContent(env);
    source = content.newsletter?.image || "";
  }

  const sourceUrl = parseAllowedImageUrl(source);
  if (!sourceUrl) {
    return new Response("Not found", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=60"
      }
    });
  }

  const cache = caches.default;
  const cacheKey = new Request(request.url, request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  let upstream = null;
  try {
    upstream = await fetch(sourceUrl.href, {
      cf: {
        image: {
          width: IMAGE_WIDTH,
          height: IMAGE_HEIGHT,
          fit: "cover",
          quality: IMAGE_QUALITY,
          format: "webp"
        }
      }
    });
  } catch {
    upstream = null;
  }

  if (!upstream || !upstream.ok) {
    upstream = await fetch(sourceUrl.href);
  }

  if (!upstream.ok) {
    return new Response("Image fetch failed", {
      status: 502,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=60"
      }
    });
  }

  const headers = new Headers(upstream.headers);
  headers.set("cache-control", `public, max-age=${CACHE_SECONDS}, immutable`);
  headers.set("x-content-type-options", "nosniff");

  const response = new Response(upstream.body, {
    status: 200,
    headers
  });

  await cache.put(cacheKey, response.clone());
  return response;
}

function parseAllowedImageUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (url.protocol !== "https:") return null;
    if (!ALLOWED_HOSTS.has(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}
