import { ensureSiteContentTable, readSiteContent, writeSiteContent } from "../_lib/site-content.js";
import { isAdmin, getActor } from "../_lib/admin-auth.js";
import { writeOperationalEvent } from "../_lib/operational-log.js";

// Public read for the homepage. Admin writes via PUT with a session cookie
// or the ingest bearer token.

export async function onRequestGet({ env }) {
  await ensureSiteContentTable(env);
  const content = await readSiteContent(env);

  return new Response(JSON.stringify(content), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60"
    }
  });
}

export async function onRequestPut({ env, request }) {
  if (!(await isAdmin(env, request))) {
    return json({ error: "Unauthorized" }, 401);
  }

  const actor = await getActor(env, request);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const updates = {};
  if (body.newsletter !== undefined) updates.newsletter = normalizeNewsletter(body.newsletter);
  if (body.sponsors !== undefined) updates.sponsors = normalizeSponsors(body.sponsors);
  if (!Object.keys(updates).length) {
    return json({ error: "Nothing to update" }, 400);
  }

  await ensureSiteContentTable(env);
  await writeSiteContent(env, updates, actor);

  await writeOperationalEvent(env, request, {
    workflow: "site_content",
    action: "update",
    status: "success",
    severity: "info",
    http_status: 200,
    message: `Site content updated: ${Object.keys(updates).join(", ")}.`,
    details: { keys: Object.keys(updates) }
  });

  return json({ ok: true, ...(await readSiteContent(env)) });
}

function normalizeNewsletter(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    title: clean(source.title),
    blurb: clean(source.blurb),
    url: clean(source.url),
    image: clean(source.image)
  };
}

function normalizeSponsors(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((sponsor) => ({
      name: clean(sponsor?.name),
      blurb: clean(sponsor?.blurb),
      url: clean(sponsor?.url),
      logo: clean(sponsor?.logo),
      enabled: Boolean(sponsor?.enabled)
    }))
    .filter((sponsor) => sponsor.name);
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
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
