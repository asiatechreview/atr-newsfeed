const DEFAULT_CATEGORY = "Other news";

// Category inference for manual entries (mirrors the public site's tag inference,
// mapped to the category labels ATR actually uses). Pure client-side, no LLM.
const CATEGORY_RULES = [
  { label: "WAIC 2026", pattern: /\bwaic\b/ },
  { label: "AI and Chips", pattern: /\b(ai|artificial intelligence|llm|multimodal|foundation model|claude|openai|anthropic|deepseek|minimax|moonshot|agentic|nvidia|distillation|chip|chips|chipmaker|chipmaking|semiconductor|semiconductors|integrated circuit|tsmc|sk hynix|hynix|cxmt|silicon|photonics|fab|foundry|packaging|hbm|gpu|memory chips?)\b/ },
  { label: "Crypto", pattern: /\b(crypto|bitcoin|stablecoin|stablecoins|blockchain|onchain|token|digital asset|solana)\b/ },
  { label: "Fintech", pattern: /\b(bank|banking|fintech|financial|payments?|qr payment|insurance|lending|digital bank|coinhako)\b/ },
  { label: "Deals", pattern: /\b(fund|funding|raised|raise|secured|series [a-z]|seed|stake|acquisition|buy|bought|deal|invest|investment|grant|equity|debt|convertible|restructuring)\b/ },
  { label: "Markets", pattern: /\b(markets?|shares?|stock|trading|revenue|profit|sales|yield|price|ipo|listing|public listing|investors?|balance sheet|tax)\b/ },
  { label: "Policy", pattern: /\b(regulator|regulators|regulation|regulations|policy|government|ministry|customs|approval|approved|audit|probe|immigration|law|rules|compliance|incentives|public sector|sanctions|tariff|tariffs)\b/ },
  { label: "Cybersecurity", pattern: /\b(cybersecurity|security|hack|hacked|breach|ransomware|data leak|critical infrastructure|export controls?|export-restricted|illicit finance)\b/ },
  { label: "Mobility", pattern: /\b(mobility|electric vehicle|electric vehicles|evs?|ride-hailing|ride hailing|grab|gojek|go-jek|autonomous|self-driving|self driving|carmaker|carmakers|scooters?)\b/ },
  { label: "Gaming", pattern: /\b(gaming|games|esports|e-sports|famitsu)\b/ },
  { label: "Telecommunications", pattern: /\b(telecom|telecommunications|5g|6g|network operator|spectrum|broadband)\b/ }
];

function inferCategory(text) {
  const lower = String(text || "").toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(lower)) return rule.label;
  }
  return "";
}

let lastAutoCategory = "";

function maybeAutoFillCategory() {
  if (state.mode !== "new") return;
  const current = els.category.value.trim();
  const untouched = current === "" || current === DEFAULT_CATEGORY || current === lastAutoCategory;
  if (!untouched) return;
  const text = [els.blurb.value, els.headline.value, els.sourceName.value].join(" ");
  const inferred = inferCategory(text);
  if (!inferred) return;
  lastAutoCategory = inferred;
  els.category.value = inferred;
}

// Source name inference: derive the outlet from the source URL domain.
const SOURCE_NAME_MAP = {
  "reuters.com": "Reuters",
  "bloomberg.com": "Bloomberg",
  "nytimes.com": "NYTimes",
  "wsj.com": "WSJ",
  "ft.com": "Financial Times",
  "techcrunch.com": "TechCrunch",
  "techmeme.com": "Techmeme",
  "economist.com": "The Economist",
  "theverge.com": "The Verge",
  "theinformation.com": "The Information",
  "nikkei.com": "Nikkei",
  "asia.nikkei.com": "Nikkei",
  "nikkei.asia": "Nikkei",
  "economictimes.indiatimes.com": "The Economic Times",
  "entrackr.com": "Entrackr",
  "theblock.co": "The Block",
  "coindesk.com": "CoinDesk",
  "cointelegraph.com": "CoinTelegraph",
  "technode.global": "TNGlobal",
  "techinasia.com": "Tech in Asia",
  "dealstreetasia.com": "DealStreetAsia",
  "thehindu.com": "The Hindu",
  "livemint.com": "Mint",
  "moneycontrol.com": "Moneycontrol",
  "businesstoday.in": "Business Today",
  "indianexpress.com": "The Indian Express",
  "straitstimes.com": "The Straits Times",
  "channelnewsasia.com": "CNA",
  "scmp.com": "South China Morning Post",
  "japantimes.co.jp": "The Japan Times",
  "koreaherald.com": "The Korea Herald",
  "yonhapnews.co.kr": "Yonhap",
  "cnbc.com": "CNBC",
  "cnn.com": "CNN",
  "bbc.com": "BBC",
  "bbc.co.uk": "BBC",
  "apnews.com": "AP",
  "theguardian.com": "The Guardian",
  "wired.com": "Wired",
  "restofworld.org": "Rest of World",
  "semafor.com": "Semafor",
  "axios.com": "Axios",
  "thefintechtimes.com": "The Fintech Times",
  "finews.asia": "finews.asia",
  "pymnts.com": "PYMNTS",
  "thenextweb.com": "TNW",
  "sifted.eu": "Sifted",
  "campaignasia.com": "Campaign Asia",
  "marketing-interactive.com": "Marketing Interactive",
  "digiday.com": "Digiday",
  "gizmochina.com": "Gizmochina",
  "xda-developers.com": "XDA Developers"
};

function domainOf(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    try {
      return new URL(`https://${value}`).hostname.toLowerCase();
    } catch {
      return "";
    }
  }
}

const COMPOUND_TLDS = ["co.uk", "org.uk", "gov.uk", "com.au", "org.au", "com.sg", "com.cn", "org.cn", "co.jp", "co.kr", "com.hk", "co.in", "com.my", "com.tw", "com.br", "co.nz", "com.ph", "com.vn", "com.th", "com.id", "co.za"];

function registrableName(parts) {
  const host = parts.join(".");
  for (const suffix of COMPOUND_TLDS) {
    if (host === suffix || host.endsWith(`.${suffix}`)) {
      const base = host.slice(0, -(suffix.length + 1));
      const baseParts = base.split(".");
      return baseParts[baseParts.length - 1];
    }
  }
  return parts.length > 2 ? parts[parts.length - 2] : parts[0];
}

function inferSourceName(url) {
  const host = domainOf(url);
  if (!host) return "";
  const parts = host.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    const candidate = parts.slice(i).join(".");
    if (SOURCE_NAME_MAP[candidate]) return SOURCE_NAME_MAP[candidate];
  }
  return registrableName(parts)
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

let lastAutoSourceName = "";

function maybeAutoFillSourceName() {
  if (state.mode !== "new") return;
  const current = els.sourceName.value.trim();
  if (current !== "" && current !== lastAutoSourceName) return;
  const inferred = inferSourceName(els.sourceUrl.value);
  if (!inferred) return;
  lastAutoSourceName = inferred;
  els.sourceName.value = inferred;
}

const state = {
  items: [],
  filtered: [],
  selected: null,
  mode: "edit",
  sponsors: []
};

const els = {
  authPanel: document.querySelector("#auth-panel"),
  authMessage: document.querySelector("#auth-message"),
  usernameInput: document.querySelector("#username-input"),
  passwordInput: document.querySelector("#password-input"),
  saveTokenButton: document.querySelector("#save-token-button"),
  tokenButton: document.querySelector("#token-button"),
  whoami: document.querySelector("#whoami"),
  whoamiAvatar: document.querySelector("#whoami-avatar"),
  whoamiRole: document.querySelector("#whoami-role"),
  tabProfile: document.querySelector("#tab-profile"),
  profileView: document.querySelector("#profile-view"),
  profileStatus: document.querySelector("#profile-status"),
  profileDisplayName: document.querySelector("#profile-display-name"),
  profileUsername: document.querySelector("#profile-username"),
  profileRole: document.querySelector("#profile-role"),
  profileCreated: document.querySelector("#profile-created"),
  profileCurrentPassword: document.querySelector("#profile-current-password"),
  profileNewPassword: document.querySelector("#profile-new-password"),
  profileConfirmPassword: document.querySelector("#profile-confirm-password"),
  profileSave: document.querySelector("#profile-save"),
  profilePasswordSave: document.querySelector("#profile-password-save"),
  refreshButton: document.querySelector("#refresh-button"),
  newButton: document.querySelector("#new-button"),
  statusTitle: document.querySelector("#status-title"),
  statusDetail: document.querySelector("#status-detail"),
  loadedCount: document.querySelector("#loaded-count"),
  filteredCount: document.querySelector("#filtered-count"),
  selectedId: document.querySelector("#selected-id"),
  selectedDetail: document.querySelector("#selected-detail"),
  listCount: document.querySelector("#list-count"),
  searchInput: document.querySelector("#search-input"),
  itemList: document.querySelector("#item-list"),
  editorTitle: document.querySelector("#editor-title"),
  editorMode: document.querySelector("#editor-mode"),
  form: document.querySelector("#item-form"),
  itemId: document.querySelector("#item-id"),
  category: document.querySelector("#category-input"),
  headline: document.querySelector("#headline-input"),
  blurb: document.querySelector("#blurb-input"),
  sourceName: document.querySelector("#source-name-input"),
  sourceUrl: document.querySelector("#source-url-input"),
  publishedAt: document.querySelector("#published-at-input"),
  saveButton: document.querySelector("#save-button"),
  removeButton: document.querySelector("#remove-button"),
  resetButton: document.querySelector("#reset-button"),
  readbackStatus: document.querySelector("#readback-status"),
  readbackOutput: document.querySelector("#readback-output"),
  deploySha: document.querySelector("#deploy-sha"),
  deployDetail: document.querySelector("#deploy-detail"),
  ingestFailures: document.querySelector("#ingest-failures"),
  strandedDetail: document.querySelector("#stranded-detail"),
  ingestSuccesses: document.querySelector("#ingest-successes"),
  successDetail: document.querySelector("#success-detail"),
  opsCount: document.querySelector("#ops-count"),
  opsBody: document.querySelector("#ops-body"),
  opsSuccessCount: document.querySelector("#ops-success-count"),
  opsSuccessBody: document.querySelector("#ops-success-body"),
  tabPublish: document.querySelector("#tab-publish"),
  tabLive: document.querySelector("#tab-live"),
  tabOps: document.querySelector("#tab-ops"),
  tabAnalytics: document.querySelector("#tab-analytics"),
  tabNewsletter: document.querySelector("#tab-newsletter"),
  tabSponsors: document.querySelector("#tab-sponsors"),
  tabDashboard: document.querySelector("#tab-dashboard"),
  publishView: document.querySelector("#publish-view"),
  liveView: document.querySelector("#live-view"),
  opsView: document.querySelector("#ops-view"),
  analyticsView: document.querySelector("#analytics-view"),
  newsletterView: document.querySelector("#newsletter-view"),
  sponsorsView: document.querySelector("#sponsors-view"),
  dashboardView: document.querySelector("#dashboard-view"),
  dashboardWindow: document.querySelector("#dashboard-window"),
  overallStatus: document.querySelector("#overall-status"),
  overallDetail: document.querySelector("#overall-detail"),
  publicItems: document.querySelector("#public-items"),
  latestItem: document.querySelector("#latest-item"),
  apiHits: document.querySelector("#api-hits"),
  hitErrors: document.querySelector("#hit-errors"),
  postingErrors: document.querySelector("#posting-errors"),
  postingTotal: document.querySelector("#posting-total"),
  trafficTotal: document.querySelector("#traffic-total"),
  trafficBreakdown: document.querySelector("#traffic-breakdown"),
  botTotal: document.querySelector("#bot-total"),
  botBreakdown: document.querySelector("#bot-breakdown"),
  eventsTotal: document.querySelector("#events-total"),
  eventsBody: document.querySelector("#events-body"),
  logsTotal: document.querySelector("#logs-total"),
  logsBody: document.querySelector("#logs-body"),
  analyticsVisits: document.querySelector("#analytics-visits"),
  analyticsWindow: document.querySelector("#analytics-window"),
  analyticsPageviews: document.querySelector("#analytics-pageviews"),
  analyticsPvDetail: document.querySelector("#analytics-pv-detail"),
  analyticsSince: document.querySelector("#analytics-since"),
  analyticsSinceDetail: document.querySelector("#analytics-since-detail"),
  analyticsDays: document.querySelector("#analytics-days"),
  analyticsBreakdown: document.querySelector("#analytics-breakdown"),
  analyticsWindowSelect: document.querySelector("#analytics-window-select"),
  newsletterStatus: document.querySelector("#newsletter-status"),
  newsletterForm: document.querySelector("#newsletter-form"),
  newsletterTitle: document.querySelector("#newsletter-title"),
  newsletterBlurb: document.querySelector("#newsletter-blurb"),
  newsletterUrl: document.querySelector("#newsletter-url"),
  newsletterImage: document.querySelector("#newsletter-image"),
  newsletterSave: document.querySelector("#newsletter-save"),
  newsletterReload: document.querySelector("#newsletter-reload"),
  newsletterReadbackStatus: document.querySelector("#newsletter-readback-status"),
  newsletterReadbackOutput: document.querySelector("#newsletter-readback-output"),
  sponsorsList: document.querySelector("#sponsors-list"),
  sponsorAdd: document.querySelector("#sponsor-add"),
  sponsorsSave: document.querySelector("#sponsors-save"),
  sponsorsReadbackStatus: document.querySelector("#sponsors-readback-status"),
  sponsorsReadbackOutput: document.querySelector("#sponsors-readback-output")
};

function switchTab(name) {
  const publish = name === "publish";
  const live = name === "live";
  const ops = name === "ops";
  const analytics = name === "analytics";
  const newsletter = name === "newsletter";
  const sponsors = name === "sponsors";
  const dashboard = name === "dashboard";
  const profile = name === "profile";
  els.publishView.hidden = !publish;
  els.liveView.hidden = !live;
  els.opsView.hidden = !ops;
  els.analyticsView.hidden = !analytics;
  els.newsletterView.hidden = !newsletter;
  els.sponsorsView.hidden = !sponsors;
  els.dashboardView.hidden = !dashboard;
  els.profileView.hidden = !profile;
  els.tabPublish.classList.toggle("active", publish);
  els.tabLive.classList.toggle("active", live);
  els.tabOps.classList.toggle("active", ops);
  els.tabAnalytics.classList.toggle("active", analytics);
  els.tabNewsletter.classList.toggle("active", newsletter);
  els.tabSponsors.classList.toggle("active", sponsors);
  els.tabDashboard.classList.toggle("active", dashboard);

  const pageTitles = {
    publish: ["Publish", "Create and manage bulletin items"],
    live: ["Live Items", "Browse and search published items"],
    ops: ["Ingest Log", "Automation and manual runs"],
    analytics: ["Analytics", "Traffic and engagement"],
    newsletter: ["Newsletter", "Homepage latest-post card"],
    sponsors: ["Sponsors", "Sponsor blurbs and placements"],
    dashboard: ["Dashboard", "Deploys, traffic and operational health"],
    profile: ["Profile", "Account settings"]
  };
  const pageTitle = document.querySelector("#page-title");
  const pageSub = document.querySelector("#page-sub");
  if (pageTitle) pageTitle.textContent = pageTitles[name][0];
  if (pageSub) pageSub.textContent = pageTitles[name][1];

  closeSidebar();
}

document.addEventListener("DOMContentLoaded", () => {
  checkSession();
});

els.saveTokenButton.addEventListener("click", () => {
  // Native form submit handles login; nothing else needed.
});

async function checkSession() {
  try {
    const response = await fetch("/api/auth/me", { credentials: "same-origin" });
    if (response.status === 200) {
      const payload = await response.json();
      document.body.classList.remove("logged-out");
      const shownName = payload.display_name || payload.username || "";
      els.whoami.textContent = shownName;
      els.whoami.hidden = false;
      els.whoamiAvatar.textContent = (shownName || "?").charAt(0).toUpperCase();
      els.whoamiAvatar.hidden = false;
      if (payload.role) els.whoamiRole.textContent = payload.role;
      els.authPanel.hidden = true;
      loadItems();
      startNewItem();
      loadOps();
      loadAnalytics();
      loadSiteContent();
      loadDashboard();
      loadProfile();
      return;
    }
  } catch {
    // Fall through to the login panel.
  }

  document.body.classList.add("logged-out");
  els.authPanel.hidden = false;
  els.usernameInput.focus();
  const errorParam = new URLSearchParams(window.location.search).get("error");
  setAuthMessage(errorParam ? "Invalid username or password." : "Sign in with your admin account.");
}

async function logout() {
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
  } catch {
    // Best effort; the panel shows either way.
  }
  document.body.classList.add("logged-out");
  els.whoami.hidden = true;
  els.whoami.textContent = "";
  els.authPanel.hidden = false;
  els.usernameInput.focus();
  setAuthMessage("Signed out.");
}

els.tokenButton.addEventListener("click", () => {
  logout();
});

els.tabPublish.addEventListener("click", () => switchTab("publish"));
els.tabLive.addEventListener("click", () => switchTab("live"));
els.tabDashboard.addEventListener("click", () => switchTab("dashboard"));
els.tabProfile.addEventListener("click", () => switchTab("profile"));
els.tabOps.addEventListener("click", () => switchTab("ops"));
els.tabAnalytics.addEventListener("click", () => switchTab("analytics"));
els.tabNewsletter.addEventListener("click", () => switchTab("newsletter"));
els.tabSponsors.addEventListener("click", () => switchTab("sponsors"));

els.newsletterForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveNewsletter();
});
els.newsletterReload.addEventListener("click", loadLatestSubstackPost);
els.sponsorAdd.addEventListener("click", () => {
  state.sponsors.push({ name: "", blurb: "", url: "", logo: "", enabled: false });
  renderSponsors();
});
els.sponsorsSave.addEventListener("click", saveSponsors);
els.profileSave.addEventListener("click", saveProfile);
els.profilePasswordSave.addEventListener("click", changePassword);

els.refreshButton.addEventListener("click", () => {
  loadItems();
  loadOps();
  loadAnalytics();
  loadDashboard();
});

const mobileRefreshButton = document.querySelector("#mobile-refresh-button");
const mobileNewButton = document.querySelector("#mobile-new-button");
const itemsToggle = document.querySelector("#items-toggle");
const itemPanel = document.querySelector("#live-view .card");

if (mobileRefreshButton) {
  mobileRefreshButton.addEventListener("click", () => {
    loadItems();
    loadOps();
    loadAnalytics();
    loadDashboard();
  });
}

if (mobileNewButton) {
  mobileNewButton.addEventListener("click", () => {
    startNewItem();
    switchTab("publish");
  });
}

if (itemsToggle && itemPanel) {
  itemsToggle.addEventListener("click", () => {
    const list = document.querySelector("#item-list");
    const open = list ? !list.hidden : true;
    if (list) list.hidden = open;
    itemsToggle.textContent = open ? "Show list" : "Hide list";
    itemsToggle.setAttribute("aria-expanded", open ? "false" : "true");
  });
}
els.analyticsWindowSelect.addEventListener("change", () => loadAnalytics());
els.dashboardWindow.addEventListener("change", () => loadDashboard());
els.searchInput.addEventListener("input", filterItems);
els.blurb.addEventListener("input", maybeAutoFillCategory);
els.headline.addEventListener("input", maybeAutoFillCategory);
els.sourceName.addEventListener("input", maybeAutoFillCategory);
els.sourceUrl.addEventListener("input", maybeAutoFillSourceName);
els.newButton.addEventListener("click", () => {
  startNewItem();
  switchTab("publish");
});
els.resetButton.addEventListener("click", () => {
  if (state.mode === "new") startNewItem();
  else if (state.selected) selectItem(state.selected.id);
});

els.removeButton.addEventListener("click", async () => {
  if (!state.selected || state.mode === "new") return;
  const ok = window.confirm(`Remove bulletin item ${state.selected.id}? This hides it from the public site, API, RSS and JSON feed.`);
  if (!ok) return;

  await mutateItem("DELETE", { id: Number(state.selected.id) }, "Removed");
});

els.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = collectForm();

  if (!payload.blurb || !payload.sourceName || !payload.sourceUrl || !payload.category) {
    setStatus("Missing fields", "Blurb, source, URL and category are required.");
    return;
  }

  if (state.mode === "new") {
    await mutateItem("POST", payload, "Created");
    return;
  }

  if (!state.selected) return;
  payload.id = Number(state.selected.id);
  await mutateItem("PATCH", payload, "Saved");
});

async function loadItems() {
  setStatus("Loading", "Fetching live D1 items");

  try {
    const pageSize = 500;
    const allItems = [];
    let offset = 0;
    for (;;) {
      const response = await fetch(`/api/items?limit=${pageSize}&offset=${offset}&_=${Date.now()}`, {
        headers: { accept: "application/json", "cache-control": "no-cache" }
      });
      if (!response.ok) throw new Error(`/api/items returned ${response.status}`);
      const payload = await response.json();
      const page = Array.isArray(payload.items) ? payload.items : [];
      allItems.push(...page);
      const total = payload.total != null ? payload.total : allItems.length;
      if (!page.length || allItems.length >= total) break;
      offset += pageSize;
    }
    state.items = allItems;
    filterItems();
    setStatus("Ready", `Loaded ${state.items.length} public items`);
  } catch (error) {
    setStatus("Error", error.message);
  }
}

async function loadOps() {
  try {
    const since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    const response = await fetch(`/api/dashboard?since=${encodeURIComponent(since)}&limit=50`, {
      headers: { accept: "application/json" },
      credentials: "same-origin"
    });
    if (!response.ok) throw new Error(`/api/dashboard returned ${response.status}`);
    const payload = await response.json();
    renderOps(payload);
  } catch (error) {
    els.deployDetail.textContent = error.message;
  }
}

async function loadAnalytics() {
  try {
    const days = els.analyticsWindowSelect.value || "7";
    const response = await fetch(`/api/analytics?days=${days}&_=${Date.now()}`, {
      headers: { accept: "application/json" },
      credentials: "same-origin"
    });    if (!response.ok) throw new Error(`/api/analytics returned ${response.status}`);
    const payload = await response.json();
    renderAnalytics(payload);
  } catch (error) {
    els.analyticsVisits.textContent = "Error";
    els.analyticsWindow.textContent = error.message;
  }
}

function renderAnalytics(payload) {  const totals = payload.totals || {};
  const daily = Array.isArray(payload.daily) ? payload.daily : [];
  const window = payload.window || {};

  els.analyticsVisits.textContent = formatNumber(totals.visits);
  els.analyticsWindow.textContent = `${window.days || 7} day window`;
  els.analyticsPageviews.textContent = formatNumber(totals.pageViews);
  els.analyticsPvDetail.textContent = `${daily.length} days with data`;

  const firstDate = daily.find((day) => day.visits > 0);
  const lastDate = daily.length ? daily[daily.length - 1].date : null;
  els.analyticsSince.textContent = firstDate ? firstDate.date : "-";
  els.analyticsSinceDetail.textContent = lastDate ? `through ${lastDate}` : "No traffic yet";

  els.analyticsDays.textContent = `${daily.length} days shown`;
  els.analyticsBreakdown.replaceChildren();

  if (!daily.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No analytics data yet. The beacon went live today, so check back in a day or two.";
    els.analyticsBreakdown.append(empty);
    return;
  }

  const max = Math.max(...daily.map((day) => day.visits), 1);
  for (const day of daily) {
    const row = document.createElement("div");
    row.className = "bar-row";

    const label = document.createElement("span");
    label.textContent = day.date || "-";
    row.append(label);

    const track = document.createElement("div");
    track.className = "bar-track";
    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.width = `${Math.max(4, (day.visits / max) * 100)}%`;
    track.append(fill);
    row.append(track);

    const value = document.createElement("span");
    value.className = "bar-value";
    value.textContent = `${formatNumber(day.visits)} visits / ${formatNumber(day.pageViews)} views`;
    row.append(value);
    els.analyticsBreakdown.append(row);
  }
}

function renderOps(payload) {
  const deploy = payload.deploy || {};
  const ingest = payload.ingest || {};
  const status = payload.status || {};

  els.deploySha.textContent = deploy.commit_sha ? deploy.commit_sha.slice(0, 7) : "-";
  els.deployDetail.textContent = deploy.deployed_at
    ? `${deploy.branch || "main"} / ${formatTime(deploy.deployed_at)}`
    : "No deploy recorded";

  els.ingestFailures.textContent = formatNumber(ingest.failure_count != null ? ingest.failure_count : status.ingest_failures || 0);
  const stranded = ingest.stranded != null ? ingest.stranded : status.stranded_items;
  els.strandedDetail.textContent = `${formatNumber(stranded || 0)} draft-but-not-posted`;

  const failures = Array.isArray(ingest.failures) ? ingest.failures : [];
  els.opsCount.textContent = `${failures.length} shown`;
  els.opsBody.replaceChildren();

  if (!failures.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 7;
    td.className = "muted";
    td.textContent = "No ingest failures in this window.";
    tr.append(td);
    els.opsBody.append(tr);
  } else {
    for (const failure of failures) {
      const tr = document.createElement("tr");
      tr.append(cell(formatTime(failure.occurred_at), "nowrap", "Time"));
      tr.append(cell(failure.action || "-", "", "Action"));
      tr.append(cell(failure.status || "-", `status-${failure.status || ""}`, "Status"));
      tr.append(cell(failure.http_status != null ? String(failure.http_status) : "-", Number(failure.http_status) >= 400 ? "status-error" : "status-ok", "HTTP"));
      tr.append(cell(failure.message || "-", "truncate", "Message"));
      tr.append(cell(failure.source_name || failure.source_url || "-", "truncate", "Source"));
      tr.append(cell(failure.posted === true ? "yes" : failure.posted === false ? "no" : "-", "", "Posted"));
      els.opsBody.append(tr);
    }
  }

  els.ingestSuccesses.textContent = formatNumber(ingest.success_count != null ? ingest.success_count : 0);
  const successes = Array.isArray(ingest.successes) ? ingest.successes : [];
  els.successDetail.textContent = `${successes.length} latest events`;
  els.opsSuccessCount.textContent = `${successes.length} shown`;
  els.opsSuccessBody.replaceChildren();

  if (!successes.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 7;
    td.className = "muted";
    td.textContent = "No successful ingest events in this window.";
    tr.append(td);
    els.opsSuccessBody.append(tr);
  } else {
    for (const event of successes) {
      const tr = document.createElement("tr");
      tr.append(cell(formatTime(event.occurred_at), "nowrap", "Time"));
      tr.append(cell(event.action || "-", "", "Action"));
      tr.append(cell(event.status || "-", `status-${event.status || ""}`, "Status"));
      tr.append(cell(event.http_status != null ? String(event.http_status) : "-", "status-ok", "HTTP"));
      tr.append(cell(event.message || "-", "truncate", "Message"));
      tr.append(cell(event.source_name || event.source_url || "-", "truncate", "Source"));
      tr.append(cell(event.posted === true ? "yes" : event.posted === false ? "no" : "-", "", "Posted"));
      els.opsSuccessBody.append(tr);
    }
  }
}

async function loadDashboard() {
  els.overallStatus.textContent = "Loading";
  els.overallDetail.textContent = "Refreshing dashboard";
  const since = new Date(Date.now() - Number(els.dashboardWindow.value) * 60 * 60 * 1000).toISOString();

  try {
    const response = await fetch(`/api/dashboard?since=${encodeURIComponent(since)}&limit=120`, {
      credentials: "same-origin"
    });
    if (response.status === 401) {
      els.authPanel.hidden = false;
      setAuthMessage("Session expired, sign in again.");
      return;
    }
    if (!response.ok) throw new Error(`Dashboard API returned ${response.status}`);
    const payload = await response.json();
    renderDashboard(payload);
  } catch (error) {
    els.overallStatus.textContent = "Error";
    els.overallDetail.textContent = error.message;
  }
}

function renderDashboard(payload) {
  const status = payload.status || {};
  const traffic = payload.traffic || {};
  const operations = payload.operations || {};
  const items = payload.items || {};

  els.overallStatus.classList.toggle("stat-ok", status.overall === "ok");
  els.overallStatus.classList.toggle("stat-attention", status.overall !== "ok");
  els.overallStatus.textContent = status.overall === "ok" ? "OK" : "Attention";
  els.overallDetail.textContent = `Generated ${formatTime(payload.generated_at)}`;
  els.publicItems.textContent = formatNumber(status.public_items);
  els.latestItem.textContent = items.latest_published ? `Latest ${formatTime(items.latest_published.published_at)}` : "No published item";
  els.apiHits.textContent = formatNumber(status.api_hits);
  els.hitErrors.textContent = `${formatNumber(traffic.totals?.errors || 0)} HTTP errors`;
  els.postingErrors.textContent = formatNumber(operations.totals?.errors || 0);
  els.postingTotal.textContent = `${formatNumber(operations.totals?.total || 0)} operational events`;

  els.trafficTotal.textContent = `${formatNumber(traffic.totals?.total || 0)} hits`;
  els.botTotal.textContent = `${formatNumber(traffic.totals?.total || 0)} hits`;
  els.eventsTotal.textContent = `${formatNumber(operations.events?.length || 0)} shown`;
  els.logsTotal.textContent = `${formatNumber(traffic.logs?.length || 0)} shown`;

  renderBreakdown(els.trafficBreakdown, traffic.totals?.byPath || {});
  renderBreakdown(els.botBreakdown, traffic.totals?.byBot || {});
  renderEvents(operations.events || []);
  renderLogs(traffic.logs || []);
}

function renderBreakdown(target, values) {
  target.replaceChildren();
  const entries = Object.entries(values).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const max = Math.max(...entries.map(([, count]) => count), 1);

  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No hits in this window.";
    target.append(empty);
    return;
  }

  for (const [label, count] of entries) {
    const row = document.createElement("div");
    row.className = "bar-row";

    const name = document.createElement("span");
    name.textContent = label || "Unclassified";
    row.append(name);

    const track = document.createElement("div");
    track.className = "bar-track";
    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.width = `${Math.max(4, (count / max) * 100)}%`;
    track.append(fill);
    row.append(track);

    const value = document.createElement("span");
    value.className = "bar-value";
    value.textContent = formatNumber(count);
    row.append(value);
    target.append(row);
  }
}

function renderEvents(events) {
  els.eventsBody.replaceChildren();
  if (!events.length) {
    els.eventsBody.append(emptyTableRow(8, "No operational events in this window."));
    return;
  }
  for (const event of events) {
    const tr = document.createElement("tr");
    tr.append(cell(formatTime(event.occurred_at), "nowrap", "Time"));
    tr.append(cell(event.severity || "info", `severity-${event.severity || "info"}`, "Severity"));
    tr.append(cell(event.workflow || "-", "", "Workflow"));
    tr.append(cell(event.action || "-", "", "Action"));
    tr.append(cell(event.status || "-", `status-${event.status || ""}`, "Status"));
    tr.append(cell(event.details?.actor || "-", "", "Actor"));
    tr.append(cell(event.message || "-", "truncate", "Message"));
    tr.append(cell(event.source_name || event.source_url || "-", "truncate", "Source"));
    els.eventsBody.append(tr);
  }
}

function renderLogs(logs) {
  els.logsBody.replaceChildren();
  if (!logs.length) {
    els.logsBody.append(emptyTableRow(6, "No API/feed/crawler hits in this window."));
    return;
  }
  for (const log of logs) {
    const tr = document.createElement("tr");
    tr.append(cell(formatTime(log.requested_at), "nowrap", "Time"));
    tr.append(cell(log.path || "-", "nowrap", "Path"));
    tr.append(cell(log.status || "-", Number(log.status) >= 400 ? "status-error" : "status-ok", "Status"));
    tr.append(cell(log.bot_name || "Unclassified", "", "Bot"));
    tr.append(cell([log.country, log.colo].filter(Boolean).join(" / ") || "-", "", "Country"));
    tr.append(cell(log.user_agent || "-", "truncate", "User Agent"));
    els.logsBody.append(tr);
  }
}

function emptyTableRow(colspan, message) {
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = colspan;
  td.className = "muted";
  td.textContent = message;
  tr.append(td);
  return tr;
}

async function loadProfile() {
  try {
    const response = await fetch("/api/auth/profile", { credentials: "same-origin" });
    if (!response.ok) throw new Error(`Profile API returned ${response.status}`);
    const payload = await response.json();
    els.profileUsername.value = payload.username || "";
    els.profileRole.value = payload.role || "";
    els.profileCreated.value = formatDateOnly(payload.created_at);
    els.profileDisplayName.value = payload.display_name || "";
    els.profileStatus.textContent = "Loaded";
    if (payload.role) els.whoamiRole.textContent = payload.role;
  } catch (error) {
    els.profileStatus.textContent = "Error";
    els.profileStatus.title = error.message;
  }
}

async function saveProfile() {
  const displayName = els.profileDisplayName.value.trim();
  els.profileStatus.textContent = "Saving";
  try {
    const response = await fetch("/api/auth/profile", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ displayName })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `PATCH returned ${response.status}`);
    const shownName = displayName || els.profileUsername.value || "";
    els.whoami.textContent = shownName;
    els.whoamiAvatar.textContent = (shownName || "?").charAt(0).toUpperCase();
    els.whoamiAvatar.hidden = false;
    els.profileStatus.textContent = "Saved";
  } catch (error) {
    els.profileStatus.textContent = "Error";
    els.profileStatus.title = error.message;
  }
}

async function changePassword() {
  const currentPassword = els.profileCurrentPassword.value;
  const newPassword = els.profileNewPassword.value;
  const confirm = els.profileConfirmPassword.value;
  if (newPassword.length < 8) {
    els.profileStatus.textContent = "8+ chars";
    els.profileStatus.title = "New password must be at least 8 characters.";
    return;
  }
  if (newPassword !== confirm) {
    els.profileStatus.textContent = "Mismatch";
    els.profileStatus.title = "New passwords do not match.";
    return;
  }
  els.profileStatus.textContent = "Saving";
  try {
    const response = await fetch("/api/auth/profile", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `PATCH returned ${response.status}`);
    els.profileCurrentPassword.value = "";
    els.profileNewPassword.value = "";
    els.profileConfirmPassword.value = "";
    els.profileStatus.textContent = "Password updated";
  } catch (error) {
    els.profileStatus.textContent = "Error";
    els.profileStatus.title = error.message;
  }
}

function formatDateOnly(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function cell(value, className = "", label = "") {
  const td = document.createElement("td");
  td.textContent = value;
  if (className) td.className = className;
  if (label) td.dataset.label = label;
  return td;
}

function filterItems() {
  const query = els.searchInput.value.trim().toLowerCase();
  state.filtered = state.items.filter((item) => {
    if (!query) return true;
    return [
      item.id,
      item.headline,
      item.title,
      item.blurb,
      item.source_name,
      item.source_url,
      item.category,
      item.published_at
    ].some((value) => String(value || "").toLowerCase().includes(query));
  });

  renderList();
  renderCounts();
}

function renderList() {
  els.itemList.replaceChildren();
  els.listCount.textContent = `${state.filtered.length} shown`;

  if (!state.filtered.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No matching items.";
    els.itemList.append(empty);
    return;
  }

  const wrap = document.createElement("div");
  wrap.className = "table-wrap";
  const table = document.createElement("table");

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const label of ["ID", "Title", "Publisher", "Category", "Tags", "Published"]) {
    const th = document.createElement("th");
    th.textContent = label;
    if (label === "ID") th.className = "id-cell";
    headRow.append(th);
  }
  thead.append(headRow);
  table.append(thead);

  const tbody = document.createElement("tbody");
  for (const item of state.filtered) {
    const tr = document.createElement("tr");
    tr.className = "item-row";
    tr.tabIndex = 0;
    tr.addEventListener("click", () => {
      selectItem(item.id);
      switchTab("publish");
    });
    tr.append(cell(String(item.id), "nowrap id-cell", "ID"));
    tr.append(cell(item.headline || item.title || firstWords(item.blurb, 12), "truncate", "Title"));
    tr.append(cell(item.source_name || "Source", "truncate", "Publisher"));
    tr.append(cell(item.category || "Other news", "", "Category"));
    tr.append(cell(formatTags(item.tags), "", "Tags"));
    tr.append(cell(formatDateTime(item.published_at), "nowrap", "Published"));
    tbody.append(tr);
  }
  table.append(tbody);
  wrap.append(table);
  els.itemList.append(wrap);
}

function formatTags(value) {
  if (!value) return "-";
  let tags = value;
  if (typeof tags === "string") {
    const trimmed = tags.trim();
    if (trimmed.startsWith("[")) {
      try {
        tags = JSON.parse(trimmed);
      } catch {
        return trimmed;
      }
    } else {
      return trimmed;
    }
  }
  if (Array.isArray(tags)) return tags.filter(Boolean).join(", ");
  return String(tags);
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function selectItem(id) {
  const item = state.items.find((candidate) => String(candidate.id) === String(id));
  if (!item) return;

  state.selected = item;
  state.mode = "edit";
  els.editorTitle.textContent = "Edit Item";
  els.editorMode.textContent = "Published";
  fillForm(item);
  renderList();
  renderCounts();
  setReadback("Loaded", item);
}

function startNewItem() {
  state.mode = "new";
  state.selected = null;
  lastAutoCategory = "";
  lastAutoSourceName = "";
  els.editorTitle.textContent = "New Item";
  els.editorMode.textContent = "Draft";
  fillForm({
    id: "",
    headline: "",
    blurb: "",
    source_name: "",
    source_url: "",
    category: DEFAULT_CATEGORY,
    published_at: new Date().toISOString()
  });
  renderList();
  renderCounts();
  setReadback("New", { message: "Create a new published bulletin item." });
}

function fillForm(item) {
  els.itemId.value = item.id || "";
  els.category.value = item.category || DEFAULT_CATEGORY;
  els.headline.value = item.headline || item.title || "";
  els.blurb.value = item.blurb || "";
  els.sourceName.value = item.source_name || "";
  els.sourceUrl.value = item.source_url || "";
  els.publishedAt.value = toLocalDateTime(item.published_at);
  els.removeButton.disabled = state.mode === "new";
}

function collectForm() {
  const payload = {
    headline: els.headline.value.trim(),
    blurb: els.blurb.value.trim(),
    sourceName: els.sourceName.value.trim(),
    sourceUrl: els.sourceUrl.value.trim(),
    category: els.category.value.trim() || DEFAULT_CATEGORY,
  };

  const publishedAt = fromLocalDateTime(els.publishedAt.value);
  if (state.mode === "new" && publishedAt) payload.publishedAt = publishedAt;

  return payload;
}

async function mutateItem(method, payload, successLabel) {
  setStatus("Saving", `${method} /api/items`);
  setReadback("Saving", payload);

  try {
    const response = await fetch("/api/items", {
      method,
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
        accept: "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json().catch(() => ({}));
    if (response.status === 401) {
      els.authPanel.hidden = false;
      throw new Error("Token rejected.");
    }
    if (!response.ok) throw new Error(result.error || `/api/items returned ${response.status}`);

    setStatus(successLabel, `Item ${result.item?.id || payload.id || ""}`);
    setReadback(successLabel, result);
    await loadItems();

    const id = result.item?.id;
    if (id && method !== "DELETE") selectItem(id);
    if (method === "DELETE") startNewItem();
  } catch (error) {
    setStatus("Error", error.message);
    setReadback("Error", { error: error.message });
  }
}

function renderCounts() {
  els.loadedCount.textContent = formatNumber(state.items.length);
  els.filteredCount.textContent = `${formatNumber(state.filtered.length)} matching`;
  els.selectedId.textContent = state.selected ? state.selected.id : state.mode === "new" ? "New" : "-";
  els.selectedDetail.textContent = state.selected ? `${state.selected.source_name || "Source"} / ${state.selected.category || DEFAULT_CATEGORY}` : state.mode === "new" ? "Unsaved item" : "-";
}

async function loadSiteContent() {
  try {
    const response = await fetch("/api/site-content", { credentials: "same-origin" });
    if (!response.ok) throw new Error(`/api/site-content returned ${response.status}`);
    const content = await response.json();
    fillNewsletterForm(content.newsletter || {});
    state.sponsors = Array.isArray(content.sponsors) ? content.sponsors.map((s) => ({ ...s })) : [];
    renderSponsors();
  } catch (error) {
    els.newsletterStatus.textContent = "Error";
    els.newsletterStatus.title = error.message;
  }
}

function fillNewsletterForm(newsletter) {
  els.newsletterTitle.value = newsletter.title || "";
  els.newsletterBlurb.value = newsletter.blurb || "";
  els.newsletterUrl.value = newsletter.url || "";
  els.newsletterImage.value = newsletter.image || "";
  els.newsletterStatus.textContent = "Loaded";
}

async function saveNewsletter() {
  const payload = {
    newsletter: {
      title: els.newsletterTitle.value.trim(),
      blurb: els.newsletterBlurb.value.trim(),
      url: els.newsletterUrl.value.trim(),
      image: els.newsletterImage.value.trim()
    }
  };

  els.newsletterReadbackStatus.textContent = "Saving";
  try {
    const response = await fetch("/api/site-content", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `PUT returned ${response.status}`);
    els.newsletterReadbackStatus.textContent = "Saved";
    els.newsletterReadbackOutput.textContent = JSON.stringify(result.newsletter || payload.newsletter, null, 2);
  } catch (error) {
    els.newsletterReadbackStatus.textContent = "Error";
    els.newsletterReadbackOutput.textContent = error.message;
  }
}

async function loadLatestSubstackPost() {
  els.newsletterStatus.textContent = "Fetching";
  try {
    const feedResponse = await fetch("https://www.asiatechreview.com/feed", { headers: { accept: "application/xml" } });
    if (!feedResponse.ok) throw new Error(`Feed returned ${feedResponse.status}`);
    const xml = await feedResponse.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "text/xml");
    const items = doc.querySelectorAll("item");
    const first = items[0];
    if (!first) throw new Error("No items in feed");
    const title = first.querySelector("title")?.textContent?.trim() || "";
    const link = first.querySelector("link")?.textContent?.trim() || "";
    const description = first.querySelector("description")?.textContent?.trim() || "";
    const image = first.querySelector("enclosure")?.getAttribute("url") || "";
    fillNewsletterForm({ title, blurb: description, url: link, image });
    els.newsletterStatus.textContent = "Loaded latest";
    els.newsletterReadbackStatus.textContent = "Fetched";
    els.newsletterReadbackOutput.textContent = JSON.stringify({ title, url: link, description, image }, null, 2);
  } catch (error) {
    els.newsletterStatus.textContent = "Fetch failed";
    els.newsletterReadbackStatus.textContent = "Error";
    els.newsletterReadbackOutput.textContent = error.message;
  }
}

function renderSponsors() {
  els.sponsorsList.replaceChildren();
  if (!state.sponsors.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No sponsors yet. Add one to draft a blurb.";
    els.sponsorsList.append(empty);
    return;
  }

  state.sponsors.forEach((sponsor, index) => {
    const card = document.createElement("div");
    card.className = "sponsor-card";

    const nameLabel = document.createElement("label");
    nameLabel.append("Sponsor name");
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = sponsor.name || "";
    nameInput.placeholder = "Banxa";
    nameInput.addEventListener("input", () => { sponsor.name = nameInput.value; });
    nameLabel.append(nameInput);
    card.append(nameLabel);

    const blurbLabel = document.createElement("label");
    blurbLabel.append("Blurb");
    const blurbInput = document.createElement("textarea");
    blurbInput.rows = 3;
    blurbInput.value = sponsor.blurb || "";
    blurbInput.placeholder = "What the sponsor does";
    blurbInput.addEventListener("input", () => { sponsor.blurb = blurbInput.value; });
    blurbLabel.append(blurbInput);
    card.append(blurbLabel);

    const urlLabel = document.createElement("label");
    urlLabel.append("Link");
    const urlInput = document.createElement("input");
    urlInput.type = "url";
    urlInput.value = sponsor.url || "";
    urlInput.placeholder = "https://...";
    urlInput.addEventListener("input", () => { sponsor.url = urlInput.value; });
    urlLabel.append(urlInput);
    card.append(urlLabel);

    const logoLabel = document.createElement("label");
    logoLabel.append("Logo URL");
    const logoInput = document.createElement("input");
    logoInput.type = "url";
    logoInput.value = sponsor.logo || "";
    logoInput.placeholder = "https://... (optional)";
    logoInput.addEventListener("input", () => { sponsor.logo = logoInput.value; });
    logoLabel.append(logoInput);
    card.append(logoLabel);

    const enabledLabel = document.createElement("label");
    enabledLabel.className = "checkbox-label";
    const enabledInput = document.createElement("input");
    enabledInput.type = "checkbox";
    enabledInput.checked = Boolean(sponsor.enabled);
    enabledInput.addEventListener("change", () => { sponsor.enabled = enabledInput.checked; });
    enabledLabel.append(enabledInput, " Show on site (not live yet)");
    card.append(enabledLabel);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "danger";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", () => {
      state.sponsors.splice(index, 1);
      renderSponsors();
    });
    card.append(removeButton);

    els.sponsorsList.append(card);
  });
}

async function saveSponsors() {
  const payload = {
    sponsors: state.sponsors.map((sponsor) => ({
      name: sponsor.name || "",
      blurb: sponsor.blurb || "",
      url: sponsor.url || "",
      logo: sponsor.logo || "",
      enabled: Boolean(sponsor.enabled)
    }))
  };

  els.sponsorsReadbackStatus.textContent = "Saving";
  try {
    const response = await fetch("/api/site-content", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `PUT returned ${response.status}`);
    els.sponsorsReadbackStatus.textContent = "Saved";
    els.sponsorsReadbackOutput.textContent = JSON.stringify(result.sponsors || payload.sponsors, null, 2);
  } catch (error) {
    els.sponsorsReadbackStatus.textContent = "Error";
    els.sponsorsReadbackOutput.textContent = error.message;
  }
}

function setStatus(title, detail) {  els.statusTitle.textContent = title;
  els.statusDetail.textContent = detail;
}

function setReadback(status, value) {
  els.readbackStatus.textContent = status;
  els.readbackOutput.textContent = JSON.stringify(value, null, 2);
}

function setAuthMessage(message) {
  els.authMessage.textContent = message;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function formatTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function toLocalDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fromLocalDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function firstWords(value, maxWords) {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords)
    .join(" ");
}

const menuToggle = document.querySelector("#menu-toggle");
const sidebar = document.querySelector("#sidebar");
const scrim = document.querySelector("#scrim");

function closeSidebar() {
  if (!sidebar) return;
  sidebar.classList.remove("open");
  if (scrim) scrim.hidden = true;
  if (menuToggle) {
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open menu");
  }
}

if (menuToggle && sidebar) {
  menuToggle.addEventListener("click", () => {
    const open = sidebar.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", open ? "true" : "false");
    menuToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    if (scrim) scrim.hidden = !open;
  });
}

if (scrim) {
  scrim.addEventListener("click", closeSidebar);
}

document.querySelectorAll(".nav-item[data-close]");
sidebar?.addEventListener("click", (event) => {
  if (event.target.closest("a, button")) closeSidebar();
});
