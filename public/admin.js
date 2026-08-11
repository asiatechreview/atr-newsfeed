const DEFAULT_CATEGORY = "Other news";

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
  marketStatus: document.querySelector("#market-status"),
  marketDetail: document.querySelector("#market-detail"),
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
  els.publishView.hidden = !publish;
  els.liveView.hidden = !live;
  els.opsView.hidden = !ops;
  els.analyticsView.hidden = !analytics;
  els.newsletterView.hidden = !newsletter;
  els.sponsorsView.hidden = !sponsors;
  els.dashboardView.hidden = !dashboard;
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
    dashboard: ["Dashboard", "Deploys, traffic and operational health"]
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
      els.whoami.textContent = payload.username || "";
      els.whoami.hidden = false;
      els.authPanel.hidden = true;
      loadItems();
      loadOps();
      loadAnalytics();
      loadSiteContent();
      loadDashboard();
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
    if (!state.selected && state.filtered[0]) selectItem(state.filtered[0].id);
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
  const markets = payload.markets || null;

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
  els.marketStatus.textContent = markets ? markets.status : "No data";
  els.marketDetail.textContent = markets?.fetched_at ? `${markets.market_count || 0} indices, ${formatTime(markets.fetched_at)}` : "No refresh stored";

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
