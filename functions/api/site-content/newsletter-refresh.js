import { refreshNewsletterCardFromFeed } from "../../_lib/newsletter-refresh.js";
import { isAdmin } from "../../_lib/admin-auth.js";

// Manual trigger for the newsletter card: fetches the latest Substack post and
// updates site-content immediately. Same logic as the scheduled newsletter
// cron (functions/_scheduled.js). Admin-only.

export async function onRequestPost({ env, request }) {
  if (!(await isAdmin(env, request))) {
    return json({ error: "Unauthorized" }, 401);
  }

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
