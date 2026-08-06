const TOKEN_KEY = "atr-bulletin-admin-token";
const DEFAULT_CATEGORY = "Other news";

const state = {
  items: [],
  filtered: [],
  selected: null,
  mode: "edit"
};

const els = {
  authPanel: document.querySelector("#auth-panel"),
  authMessage: document.querySelector("#auth-message"),
  tokenInput: document.querySelector("#token-input"),
  saveTokenButton: document.querySelector("#save-token-button"),
  tokenButton: document.querySelector("#token-button"),
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
  opsCount: document.querySelector("#ops-count"),
  opsBody: document.querySelector("#ops-body")
};

document.addEventListener("DOMContentLoaded", () => {
  const savedToken = readToken();
  if (savedToken) {
    els.tokenInput.value = savedToken;
    els.authPanel.hidden = true;
    loadItems();
    loadOps();
  }
});

els.saveTokenButton.addEventListener("click", () => {
  const token = els.tokenInput.value.trim();
  if (!token) {
    setAuthMessage("Token required.");
    return;
  }

  localStorage.setItem(TOKEN_KEY, token);
  els.authPanel.hidden = true;
  loadItems();
  loadOps();
});

els.tokenButton.addEventListener("click", () => {
  els.authPanel.hidden = !els.authPanel.hidden;
  els.tokenInput.focus();
});

els.refreshButton.addEventListener("click", () => {
  loadItems();
  loadOps();
});
els.searchInput.addEventListener("input", filterItems);
els.newButton.addEventListener("click", startNewItem);
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
  if (!readToken()) {
    els.authPanel.hidden = false;
    setAuthMessage("Token required.");
    return;
  }

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
  if (!readToken()) return;

  try {
    const since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    const response = await fetch(`/api/dashboard?since=${encodeURIComponent(since)}&limit=50`, {
      headers: { authorization: authHeader(), accept: "application/json" }
    });
    if (!response.ok) throw new Error(`/api/dashboard returned ${response.status}`);
    const payload = await response.json();
    renderOps(payload);
  } catch (error) {
    els.deployDetail.textContent = error.message;
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
    return;
  }

  for (const failure of failures) {
    const tr = document.createElement("tr");
    tr.append(cell(formatTime(failure.occurred_at), "nowrap"));
    tr.append(cell(failure.action || "-"));
    tr.append(cell(failure.status || "-", `status-${failure.status || ""}`));
    tr.append(cell(failure.http_status != null ? String(failure.http_status) : "-", Number(failure.http_status) >= 400 ? "status-error" : "status-ok"));
    tr.append(cell(failure.message || "-", "truncate"));
    tr.append(cell(failure.source_name || failure.source_url || "-", "truncate"));
    tr.append(cell(failure.posted === true ? "yes" : failure.posted === false ? "no" : "-"));
    els.opsBody.append(tr);
  }
}

function cell(value, className = "") {
  const td = document.createElement("td");
  td.textContent = value;
  if (className) td.className = className;
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

  for (const item of state.filtered) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `item-button${state.selected?.id === item.id ? " active" : ""}`;
    button.dataset.id = item.id;
    button.addEventListener("click", () => selectItem(item.id));

    const title = document.createElement("strong");
    title.textContent = item.headline || item.title || firstWords(item.blurb, 12);
    const meta = document.createElement("span");
    meta.textContent = `${item.id} / ${item.source_name || "Source"} / ${formatTime(item.published_at)}`;

    button.append(title, meta);
    els.itemList.append(button);
  }
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
    category: els.category.value.trim() || DEFAULT_CATEGORY
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
      headers: {
        authorization: authHeader(),
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

function setStatus(title, detail) {
  els.statusTitle.textContent = title;
  els.statusDetail.textContent = detail;
}

function setReadback(status, value) {
  els.readbackStatus.textContent = status;
  els.readbackOutput.textContent = JSON.stringify(value, null, 2);
}

function setAuthMessage(message) {
  els.authMessage.textContent = message;
}

function readToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function authHeader() {
  const token = readToken();
  return token.toLowerCase().startsWith("bearer ") ? token : `Bearer ${token}`;
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
