import { refreshNewsletterCardFromFeed } from "../../../_lib/newsletter-refresh.js";

// Manual trigger for the newsletter card: fetches the latest Substack post and
// updates site-content immediately. Same logic as the scheduled newsletter
// cron (functions/_scheduled.js). Intentionally unauthenticated: the endpoint
// takes no user input and only mirrors the public Substack feed, so it cannot
// be used to inject content. The "Save card" write endpoint stays admin-only.

export async function onRequestPost({ env, request }) {
  try {
    const result = await refreshNewsletterCardFromFeed(env, request);
    return json({ ok: true, ...result });
  } catch (error) {
    return json({ error: error.message }, 502);
  }
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
