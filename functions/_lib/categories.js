// Canonical category store for the bulletin admin.
//
// Categories previously existed only as client-side inference rules in
// admin.js plus whatever string sat on each feed_items row. Renaming or
// deleting a category therefore could not propagate. This module gives the
// admin a durable `categories` table so the admin panel can list, create,
// rename (propagating to all items) and delete (reassigning items) categories.

export async function ensureCategoriesTable(env) {
  if (!env?.ATR_FEED_DB) return;

  await env.ATR_FEED_DB.prepare(
    `CREATE TABLE IF NOT EXISTS categories (
      name TEXT PRIMARY KEY,
      pattern TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    )`
  ).run();
}

// Seed data mirrors the inference rules that previously lived in admin.js.
// Order matters: earlier rules win when multiple patterns match.
const SEED_CATEGORIES = [
  { name: "WAIC 2026", pattern: "\\bwaic\\b" },
  { name: "Cloud", pattern: "\\b(cloud|data centre|data center|data centres|data centers|hyperscaler|hyperscalers|aws|azure|google cloud|alibaba cloud|tencent cloud|huawei cloud|cloud computing|cloud services|cloud infrastructure|infrastructure-as-a-service|iaas|saas|paas)\\b" },
  { name: "AI", pattern: "\\b(ai|artificial intelligence|llm|multimodal|foundation model|claude|openai|anthropic|deepseek|minimax|moonshot|agentic|nvidia|distillation|gpu)\\b" },
  { name: "Chips", pattern: "\\b(chip|chips|chipmaker|chipmaking|semiconductor|semiconductors|integrated circuit|tsmc|sk hynix|hynix|cxmt|silicon|photonics|fab|foundry|packaging|hbm|memory chips?)\\b" },
  { name: "Robotics", pattern: "\\b(robot|robots|robotics|humanoid|robotaxi|robotaxis|unitree|agibot|ubtech|boston dynamics|figure|digit robot)\\b" },
  { name: "EVs", pattern: "\\b(electric vehicle|electric vehicles|evs?|ev maker|ev makers|ev battery|ev charging|charging network|ev startup)\\b" },
  { name: "Transportation", pattern: "\\b(transportation|transport|logistics|shipping|airline|airlines|aviation|airport|airports|railway|railways|rail|train|trains|port|ports|freight|trucking|courier|delivery)\\b" },
  { name: "Energy", pattern: "\\b(energy|solar|wind power|renewables?|grid|power plant|power station|oil|natural gas|nuclear|battery|catl|energy storage|petrochemicals?)\\b" },
  { name: "Space", pattern: "\\b(space|satellite|satellites|rocket|rockets|launch vehicle|spacecraft|orbit|starlink|gps|gnss)\\b" },
  { name: "E-commerce", pattern: "\\b(e-commerce|ecommerce|marketplace|online retail|shopee|lazada|shein|tiktok shop|quick commerce)\\b" },
  { name: "Hardware", pattern: "\\b(smartphone|smartphones|handset|handsets|laptop|laptops|tablet|tablets|wearable|wearables|consumer electronics|headset|headsets|gadget|gadgets|iphone|airpods|pixel phone)\\b" },
  { name: "Biotech", pattern: "\\b(biotech|biotechnology|biopharma|protein design|gene therapy|genomics|genome|clinical trial|pharma|pharmaceutical|drug development|drugmaker|vaccine development|cell therapy)\\b" },
  { name: "Health", pattern: "\\b(health|healthcare|health care|hospital|hospitals|medical|medicine|doctor|doctors|nurse|nurses|patient|patients|telehealth|telemedicine|medtech|wellness|mental health|health insurance)\\b" },
  { name: "Crypto", pattern: "\\b(crypto|bitcoin|stablecoin|stablecoins|blockchain|onchain|token|digital asset|solana)\\b" },
  { name: "Fintech", pattern: "\\b(bank|banking|fintech|financial|payments?|qr payment|insurance|lending|digital bank|coinhako)\\b" },
  { name: "Venture Capital", pattern: "\\b(venture capital|venture-capital|vc firm|vc firms|vc fund|vc funds|private equity|pe firm|pe firms|pe fund|pe funds|fund of funds|limited partner|limited partners|accelerator|incubator|raises?[^.]*?\\bfund\\b|closes?[^.]*?\\bfund\\b|new\\s+fund\\b)\\b" },
  { name: "Funding", pattern: "\\b(funding|raise|raised|raises|raising|secured|secures|series [a-z]|seed round|pre-seed|backs|backed by|valuation)\\b" },
  { name: "Deals", pattern: "\\b(acquisition|acquisitions|acquire|acquires|acquired|merger|mergers|merging|buyout|buyouts|takeover|take over|stake|stakes|sell|sells|sold|divest|divesting|consolidat|restructuring)\\b" },
  { name: "Earnings", pattern: "\\b(earnings|quarterly results|quarterly report|net income|net profit|profit warning)\\b" },
  { name: "Markets", pattern: "\\b(markets?|shares?|stock|trading|revenue|profit|sales|yield|price|ipo|listing|public listing|investors?|balance sheet|tax)\\b" },
  { name: "Policy", pattern: "\\b(regulator|regulators|regulation|regulations|policy|government|ministry|customs|approval|approved|audit|probe|immigration|law|rules|compliance|incentives|public sector|sanctions|tariff|tariffs)\\b" },
  { name: "Cybersecurity", pattern: "\\b(cybersecurity|security|hack|hacked|breach|ransomware|data leak|critical infrastructure|export controls?|export-restricted|illicit finance)\\b" },
  { name: "Mobility", pattern: "\\b(mobility|electric vehicle|electric vehicles|evs?|ride-hailing|ride hailing|grab|gojek|go-jek|autonomous|self-driving|self driving|carmaker|carmakers|scooters?)\\b" },
  { name: "Gaming", pattern: "\\b(gaming|games|esports|e-sports|famitsu)\\b" },
  { name: "Telecommunications", pattern: "\\b(telecom|telecommunications|5g|6g|network operator|spectrum|broadband)\\b" },
  { name: "Startups", pattern: "\\b(startup|startups|start-up|start-ups|unicorn)\\b" },
  { name: "Apps", pattern: "\\b(apps?|app store|superapp|super-app)\\b" },
  { name: "Other news", pattern: "" }
];

export async function seedCategories(env) {
  if (!env?.ATR_FEED_DB) return;

  const row = await env.ATR_FEED_DB.prepare("SELECT COUNT(*) AS count FROM categories").first();
  if (row && Number(row.count) > 0) {
    // Table already seeded. Backfill any seed categories added later
    // (e.g. Funding) without touching existing rows, so the live table
    // picks up new canonical categories on next request.
    const existing = await env.ATR_FEED_DB.prepare("SELECT name FROM categories").all();
    const known = new Set((existing.results || []).map((r) => r.name));
    const insert = env.ATR_FEED_DB.prepare(
      "INSERT OR IGNORE INTO categories (name, pattern, sort_order) VALUES (?, ?, ?)"
    );
    const missing = SEED_CATEGORIES
      .map((cat, index) => ({ cat, index }))
      .filter(({ cat }) => !known.has(cat.name));
    if (missing.length) {
      await env.ATR_FEED_DB.batch(
        missing.map(({ cat, index }) => insert.bind(cat.name, cat.pattern, index))
      );
    }
    return;
  }

  const insert = env.ATR_FEED_DB.prepare(
    "INSERT INTO categories (name, pattern, sort_order) VALUES (?, ?, ?)"
  );
  const batch = SEED_CATEGORIES.map((cat, index) =>
    insert.bind(cat.name, cat.pattern, index)
  );
  await env.ATR_FEED_DB.batch(batch);
}

// List canonical categories plus any legacy categories found on items that
// are not yet in the table, each with a published-item count.
export async function listCategories(env) {
  await ensureCategoriesTable(env);
  await seedCategories(env);

  const [tableRows, countRows, legacyRows] = await Promise.all([
    env.ATR_FEED_DB.prepare(
      "SELECT name, pattern, sort_order FROM categories ORDER BY sort_order ASC, name ASC"
    ).all(),
    env.ATR_FEED_DB.prepare(
      "SELECT category, COUNT(*) AS count FROM feed_items WHERE status = 'published' AND category IS NOT NULL AND category != '' GROUP BY category"
    ).all(),
    env.ATR_FEED_DB.prepare(
      "SELECT DISTINCT category FROM feed_items WHERE status = 'published' AND category IS NOT NULL AND category != ''"
    ).all()
  ]);

  const counts = new Map((countRows.results || []).map((row) => [row.category, Number(row.count)]));
  const known = new Set((tableRows.results || []).map((row) => row.name));

  const canonical = (tableRows.results || []).map((row) => ({
    name: row.name,
    pattern: row.pattern || "",
    count: counts.get(row.name) || 0,
    legacy: false
  }));

  const legacy = (legacyRows.results || [])
    .map((row) => row.category)
    .filter((name) => !known.has(name))
    .sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0) || a.localeCompare(b))
    .map((name) => ({
      name,
      pattern: "",
      count: counts.get(name) || 0,
      legacy: true
    }));

  return [...canonical, ...legacy];
}

export async function createCategory(env, { name, pattern }) {
  const cleanName = String(name || "").trim();
  if (!cleanName) throw new Error("name is required");

  const existing = await env.ATR_FEED_DB.prepare(
    "SELECT name FROM categories WHERE name = ?"
  ).bind(cleanName).first();
  if (existing) throw new Error("category already exists");

  const sortRow = await env.ATR_FEED_DB.prepare(
    "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM categories"
  ).first();
  await env.ATR_FEED_DB.prepare(
    "INSERT INTO categories (name, pattern, sort_order) VALUES (?, ?, ?)"
  ).bind(cleanName, String(pattern || "").trim(), Number(sortRow?.next || 0)).run();
}

export async function updateCategory(env, { name, newName, pattern }) {
  const cleanName = String(name || "").trim();
  if (!cleanName) throw new Error("name is required");

  const current = await env.ATR_FEED_DB.prepare(
    "SELECT name FROM categories WHERE name = ?"
  ).bind(cleanName).first();
  if (!current) throw new Error("category not found");

  const cleanNewName = newName === undefined ? cleanName : String(newName).trim();
  if (!cleanNewName) throw new Error("newName is required");

  if (cleanNewName !== cleanName) {
    const clash = await env.ATR_FEED_DB.prepare(
      "SELECT name FROM categories WHERE name = ?"
    ).bind(cleanNewName).first();
    if (clash) throw new Error("target category already exists");
  }

  // Rename propagates to every published/hidden item that used the old label.
  await env.ATR_FEED_DB.prepare(
    "UPDATE feed_items SET category = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE category = ?"
  ).bind(cleanNewName, cleanName).run();

  await env.ATR_FEED_DB.prepare(
    "UPDATE categories SET name = ?, pattern = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE name = ?"
  ).bind(cleanNewName, pattern === undefined ? current.pattern : String(pattern).trim(), cleanName).run();
}

export async function deleteCategory(env, { name, reassignTo }) {
  const cleanName = String(name || "").trim();
  if (!cleanName) throw new Error("name is required");

  const current = await env.ATR_FEED_DB.prepare(
    "SELECT name FROM categories WHERE name = ?"
  ).bind(cleanName).first();
  if (!current) throw new Error("category not found");

  const target = String(reassignTo || "Other news").trim();
  if (target === cleanName) throw new Error("cannot reassign to the category being deleted");

  // Reassign items first, then remove the category definition.
  await env.ATR_FEED_DB.prepare(
    "UPDATE feed_items SET category = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE category = ?"
  ).bind(target, cleanName).run();

  await env.ATR_FEED_DB.prepare("DELETE FROM categories WHERE name = ?").bind(cleanName).run();
}
