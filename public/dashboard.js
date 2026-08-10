const TOKEN_KEY = "atr-bulletin-dashboard-token";

const els = {
  authPanel: document.querySelector("#auth-panel"),
  authMessage: document.querySelector("#auth-message"),
  tokenInput: document.querySelector("#token-input"),
  saveTokenButton: document.querySelector("#save-token-button"),
  tokenButton: document.querySelector("#token-button"),
  refreshButton: document.querySelector("#refresh-button"),
  windowSelect: document.querySelector("#window-select"),
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
  logsBody: document.querySelector("#logs-body")
};

document.addEventListener("DOMContentLoaded", () => {
  checkSession();
});

els.saveTokenButton.addEventListener("click", () => {
  const username = els.usernameInput.value.trim();
  const password = els.passwordInput.value;
  if (!username || !password) {
    setAuthMessage("Username and password required.");
    return;
  }

  login(username, password);
});

els.passwordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") els.saveTokenButton.click();
});

async function checkSession() {
  try {
    const response = await fetch("/api/auth/me", { credentials: "same-origin" });
    if (response.status === 200) {
      const payload = await response.json();
      els.whoami.textContent = payload.username || "";
      els.whoami.hidden = false;
      els.authPanel.hidden = true;
      loadDashboard();
      return;
    }
  } catch {
    // Fall through to the login panel.
  }

  els.authPanel.hidden = false;
  els.usernameInput.focus();
  setAuthMessage("Sign in with your admin account.");
}

async function login(username, password) {
  els.saveTokenButton.disabled = true;
  setAuthMessage("Signing in...");

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ username, password })
    });

    const payload = await response.json().catch(() => ({}));
    if (response.status === 200) {
      els.whoami.textContent = payload.username || username;
      els.whoami.hidden = false;
      els.authPanel.hidden = true;
      setAuthMessage("");
      loadDashboard();
      return;
    }

    setAuthMessage(payload.error || "Sign in failed.");
  } catch (error) {
    setAuthMessage(error.message || "Sign in failed.");
  } finally {
    els.saveTokenButton.disabled = false;
  }
}

async function logout() {
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
  } catch {
    // Best effort; the panel shows either way.
  }
  els.whoami.hidden = true;
  els.whoami.textContent = "";
  els.authPanel.hidden = false;
  els.usernameInput.focus();
  setAuthMessage("Signed out.");
}

els.tokenButton.addEventListener("click", () => {
  logout();
});

els.refreshButton.addEventListener("click", () => {
  loadDashboard();
});

els.windowSelect.addEventListener("change", () => {
  loadDashboard();
});

async function loadDashboard() {
  setLoading();
  const since = new Date(Date.now() - Number(els.windowSelect.value) * 60 * 60 * 1000).toISOString();

  try {
    const response = await fetch(`/api/dashboard?since=${encodeURIComponent(since)}&limit=120`, {
      credentials: "same-origin"
    });

    if (response.status === 401) {
      els.authPanel.hidden = false;
      setAuthMessage("Session expired, sign in again.");
      return;
    }

    if (!response.ok) {
      throw new Error(`Dashboard API returned ${response.status}`);
    }

    const payload = await response.json();
    setAuthMessage("");
    render(payload);
  } catch (error) {
    els.overallStatus.textContent = "Error";
    els.overallDetail.textContent = error.message;
    document.querySelector(".metric").classList.add("attention");
  }
}

function render(payload) {
  const status = payload.status || {};
  const traffic = payload.traffic || {};
  const operations = payload.operations || {};
  const items = payload.items || {};
  const markets = payload.markets || null;
  const firstMetric = document.querySelector(".metric");

  firstMetric.classList.remove("ok", "attention");
  firstMetric.classList.add(status.overall === "ok" ? "ok" : "attention");

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
    target.append(emptyRow("No hits in this window."));
    return;
  }

  for (const [label, count] of entries) {
    const row = document.createElement("div");
    row.className = "bar-row";
    row.append(textSpan(label || "Unclassified"));

    const track = document.createElement("div");
    track.className = "bar-track";
    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.width = `${Math.max(4, (count / max) * 100)}%`;
    track.append(fill);
    row.append(track);
    row.append(textSpan(formatNumber(count)));
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
    const row = document.createElement("tr");
    row.append(cell(formatTime(event.occurred_at), "nowrap"));
    row.append(cell(event.severity || "info", `severity-${event.severity || "info"}`));
    row.append(cell(event.workflow || "-"));
    row.append(cell(event.action || "-"));
    row.append(cell(event.status || "-", `status-${event.status || ""}`));
    row.append(cell(event.details?.actor || "-"));
    row.append(cell(event.message || "-", "truncate"));
    row.append(cell(event.source_name || event.source_url || "-", "truncate"));
    els.eventsBody.append(row);
  }
}

function renderLogs(logs) {
  els.logsBody.replaceChildren();
  if (!logs.length) {
    els.logsBody.append(emptyTableRow(6, "No API/feed/crawler hits in this window."));
    return;
  }

  for (const log of logs) {
    const row = document.createElement("tr");
    row.append(cell(formatTime(log.requested_at), "nowrap"));
    row.append(cell(log.path || "-", "nowrap"));
    row.append(cell(log.status || "-", Number(log.status) >= 400 ? "status-error" : "status-ok"));
    row.append(cell(log.bot_name || "Unclassified"));
    row.append(cell([log.country, log.colo].filter(Boolean).join(" / ") || "-"));
    row.append(cell(log.user_agent || "-", "truncate"));
    els.logsBody.append(row);
  }
}

function setLoading() {
  els.overallStatus.textContent = "Loading";
  els.overallDetail.textContent = "Refreshing dashboard";
}

function setAuthMessage(message) {
  els.authMessage.textContent = message;
}

function textSpan(value) {
  const span = document.createElement("span");
  span.textContent = value;
  return span;
}

function cell(value, className = "") {
  const td = document.createElement("td");
  td.textContent = value;
  if (className) td.className = className;
  return td;
}

function emptyRow(message) {
  const div = document.createElement("div");
  div.className = "muted";
  div.textContent = message;
  return div;
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
