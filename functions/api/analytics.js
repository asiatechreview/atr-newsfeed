import { isAdmin } from "../_lib/admin-auth.js";

const CF_GRAPHQL = "https://api.cloudflare.com/client/v4/graphql";
const DEFAULT_ACCOUNT_ID = "3e7885d961646e313d2e1a50ec33d62d";
const DEFAULT_SITE_TAG = "70c51d1d7a294d70af9aa1512f678135";

export async function onRequestGet({ env, request }) {
  if (!isAuthorized(env, request)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const token = env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    return json({
      error: "Cloudflare analytics not configured",
      hint: "Add CLOUDFLARE_API_TOKEN as a secret on the Cloudflare Pages project"
    }, 503);
  }

  const accountId = env.CLOUDFLARE_ACCOUNT_ID || DEFAULT_ACCOUNT_ID;
  const siteTag = env.CLOUDFLARE_SITE_TAG || DEFAULT_SITE_TAG;

  const url = new URL(request.url);
  const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 7, 1), 90);
  const dateTo = new Date();
  const dateFrom = new Date(dateTo.getTime() - days * 864e5);
  const iso = (d) => d.toISOString().slice(0, 10);

  const dailyQuery = `query {
    viewer {
      accounts(filter: { accountTag: "${accountId}" }) {
        rumPageloadEventsAdaptiveGroups(
          limit: 500
          filter: { date_geq: "${iso(dateFrom)}", date_leq: "${iso(dateTo)}", siteTag: "${siteTag}" }
          orderBy: [date_ASC]
        ) {
          count
          dimensions { date }
          sum { visits }
        }
      }
    }
  }`;

  const DIMENSIONS = [
    { key: "countries", field: "countryName" },
    { key: "referrers", field: "refererHost" },
    { key: "pages", field: "path" },
    { key: "devices", field: "deviceType" }
  ];

  const dimensionQueries = DIMENSIONS.map(({ field }) => `query {
    viewer {
      accounts(filter: { accountTag: "${accountId}" }) {
        rumPageloadEventsAdaptiveGroups(
          limit: 10
          filter: { date_geq: "${iso(dateFrom)}", date_leq: "${iso(dateTo)}", siteTag: "${siteTag}" }
          orderBy: [count_DESC]
        ) {
          count
          dimensions { ${field} }
          sum { visits }
        }
      }
    }
  }`);

  const allQueries = [dailyQuery, ...dimensionQueries];

  let payloads;
  try {
    const responses = await Promise.all(allQueries.map((q) =>
      fetch(CF_GRAPHQL, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({ query: q })
      })
    ));
    payloads = await Promise.all(responses.map((response) => response.json()));
  } catch (error) {
    return json({ error: "Cloudflare analytics request failed", detail: error.message }, 502);
  }

  const dailyPayload = payloads[0];
  if (dailyPayload.errors?.length) {
    return json({
      error: "Cloudflare analytics request failed",
      detail: dailyPayload.errors[0].message
    }, 502);
  }

  const groups = dailyPayload.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups || [];
  const daily = groups.map((group) => ({
    date: group.dimensions?.date || null,
    visits: group.sum?.visits || 0,
    pageViews: group.count || 0
  }));

  const totals = daily.reduce(
    (acc, day) => ({
      visits: acc.visits + day.visits,
      pageViews: acc.pageViews + day.pageViews
    }),
    { visits: 0, pageViews: 0 }
  );

  const breakdowns = {};
  DIMENSIONS.forEach(({ key, field }, index) => {
    const dimPayload = payloads[index + 1];
    const rows = dimPayload?.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups || [];
    const values = {};
    for (const row of rows) {
      const label = row.dimensions?.[field];
      const value = row.sum?.visits ?? row.count ?? 0;
      if (label) values[label] = (values[label] || 0) + value;
    }
    breakdowns[key] = values;
  });

  return json({
    type: "atr_bulletin_analytics",
    generated_at: new Date().toISOString(),
    window: { days, from: iso(dateFrom), to: iso(dateTo) },
    totals,
    daily,
    breakdowns
  });
}

function isAuthorized(env, request) {
  return isAdmin(env, request);
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
