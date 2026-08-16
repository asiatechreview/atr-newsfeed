// qwen-assist.js — shared Qwen (Workers AI) helpers for admin AI-assist.
//
// Used by /api/ai-assist. Same model and call pattern as the Rapid Transit
// webhook headline generator, kept here so admin features do not duplicate
// the fetch logic. All calls are advisory: the human approves before any
// value is written.

const QWEN_MODEL = "@cf/qwen/qwen2.5-coder-32b-instruct";
const AI_ASSIST_TIMEOUT_MS = 30000;

// Canonical category list for the suggest-category prompt. Mirrors
// SEED_CATEGORIES names plus the standard fallback. Kept in sync with the
// admin's category management table.
const CATEGORY_NAMES = [
  "WAIC 2026", "Cloud", "AI", "Chips", "Robotics", "EVs", "Transportation",
  "Energy", "Space", "E-commerce", "Hardware", "Biotech", "Health", "Crypto",
  "Fintech", "Venture Capital", "Funding", "Deals", "Earnings", "Markets",
  "Policy", "Cybersecurity", "Mobility", "Gaming", "Telecommunications",
  "Startups", "Apps", "Other news"
];

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

// Run one Qwen completion. Returns the trimmed text or null on any failure.
export async function runQwen(env, systemPrompt, userContent, maxTokens = 200) {
  const account = env?.WORKERS_AI_ACCOUNT_ID;
  const token = env?.WORKERS_AI_TOKEN;
  if (!account || !token) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_ASSIST_TIMEOUT_MS);
  try {
    const body = JSON.stringify({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent }
      ],
      max_tokens: maxTokens,
      temperature: 0.3
    });
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${QWEN_MODEL}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`
        },
        body,
        signal: controller.signal
      }
    );
    if (!response.ok) return null;
    const payload = await response.json();
    const result = payload?.result || {};
    const choices = result.choices || [];
    const text = choices.length ? choices[0].message?.content : result.response;
    return String(text || "").trim() || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Pull a JSON array out of a model response that may contain prose around it.
function extractJsonArray(text) {
  if (!text) return [];
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Pull a JSON object out of a model response.
function extractJsonObject(text) {
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function cleanAssistText(text) {
  return String(text || "")
    .replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, "")
    .replace(/^[A-Za-z]+:\s*/i, "")
    .replace(/\.+$/g, "")
    .trim();
}

// Suggest a scan-first headline for a blurb.
export async function suggestHeadline(env, blurb) {
  const system = `You write scan-first headlines for ATR (Asia Tech Review), a daily Asia tech news bulletin. Match this style: telegraphic, lead with the actor and action, keep the key figure or subject noun, use the blurb's own verb where it works, never add facts not in the blurb, no trailing period. Output ONLY the title, 4-14 words.`;
  const text = await runQwen(env, system, `Blurb: ${blurb}\nTitle:`, 80);
  return cleanAssistText(text);
}

// Suggest a single canonical category for a blurb.
export async function suggestCategory(env, blurb, headline) {
  const list = CATEGORY_NAMES.join(", ");
  const system = `You assign bulletin categories for ATR (Asia Tech Review). Pick exactly ONE category from this list: ${list}. Rules: Funding = money moving into a company (rounds, raises, seed, Series A-Z). Venture Capital = VC/PE firms raising their own funds, LPs, funds. Deals = M&A only (acquisitions, mergers, buyouts, stakes). When a story spans AI and chips, pick the dominant angle. Avoid "Other news" unless nothing fits. Output ONLY the category name.`;
  const text = await runQwen(env, system, `Headline: ${headline || "—"}\nBlurb: ${blurb}\nCategory:`, 20);
  const cleaned = cleanAssistText(text);
  if (CATEGORY_NAMES.includes(cleaned)) return cleaned;
  return null;
}

// Suggest 2-5 single-word tags for a blurb.
export async function suggestTags(env, blurb, headline) {
  const system = `You suggest tags for ATR (Asia Tech Review) bulletin items. Rules: tags are short, single-topic words only. Max two words, no phrases, no descriptive clauses. 2-5 tags per item: country/region, company, sector, event type. Good: China, AI, Earnings, IPO, DeepSeek, Semiconductors, South Korea, SK Hynix. Bad: "Open-weight models", "Digital sovereignty", "Tech stocks", "Valuations". Output ONLY a JSON array of strings, e.g. ["China", "AI", "DeepSeek"].`;
  const text = await runQwen(env, system, `Headline: ${headline || "—"}\nBlurb: ${blurb}\nTags:`, 80);
  return extractJsonArray(text)
    .map((t) => String(t).trim())
    .filter((t) => t && t.length <= 40)
    .slice(0, 5);
}

// Tighten a blurb into concise newsroom copy while preserving every fact.
export async function tightenBlurb(env, blurb) {
  const system = `You tighten news blurbs for ATR (Asia Tech Review). Keep every fact, name, number and date from the original. Remove padding and vague framing. Keep it to one short paragraph, roughly 35-60 words. Plain English, no hype, no "this matters" phrasing. Output ONLY the rewritten blurb.`;
  const text = await runQwen(env, system, `Blurb: ${blurb}`, 180);
  return cleanAssistText(text);
}

// Semantic duplicate check: compare a new story against candidate items and
// return the ids that appear to be the same story.
export async function checkSemanticDuplicates(env, headline, blurb, candidates) {
  if (!Array.isArray(candidates) || !candidates.length) return [];
  const lines = candidates
    .map((c) => `${c.id} | ${c.headline || c.title || ""} | ${String(c.blurb || "").slice(0, 220)}`)
    .join("\n");
  const system = `You detect duplicate news stories for ATR (Asia Tech Review). A duplicate means the same underlying story: same company/person/country AND same event (a raise, an earnings report, an acquisition, a launch, a regulatory action). Different outlets covering the same story are duplicates. Similar but genuinely different events are not. The new story is listed first as NEW. Output ONLY a JSON array of the candidate ids that are the same story as NEW. Empty array if none.`;
  const user = `NEW: ${headline || "—"} | ${blurb || ""}\n\nCANDIDATES:\n${lines}`;
  const text = await runQwen(env, system, user, 120);
  const ids = extractJsonArray(text)
    .map((id) => String(id))
    .filter((id) => candidates.some((c) => String(c.id) === id));
  return ids;
}
