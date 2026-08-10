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
  opsCount: document.querySelector("#ops-count"),
  opsBody: document.querySelector("#ops-body"),
  tabPublish: document.querySelector("#tab-publish"),
  tabOps: document.querySelector("#tab-ops"),
  tabAnalytics: document.querySelector("#tab-analytics"),
  tabNewsletter: document.querySelector("#tab-newsletter"),
  tabSponsors: document.querySelector("#tab-sponsors"),
  publishView: document.querySelector("#publish-view"),
  opsView: document.querySelector("#ops-view"),
  analyticsView: document.querySelector("#analytics-view"),
  newsletterView: document.querySelector("#newsletter-view"),
  sponsorsView: document.querySelector("#sponsors-view"),
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
  const ops = name === "ops";
  const analytics = name === "analytics";
  const newsletter = name === "newsletter";
  const sponsors = name === "sponsors";
  els.publishView.hidden = !publish;
  els.opsView.hidden = !ops;
  els.analyticsView.hidden = !analytics;
  els.newsletterView.hidden = !newsletter;
  els.sponsorsView.hidden = !sponsors;
  els.tabPublish.classList.toggle("active", publish);
  els.tabOps.classList.toggle("active", ops);
  els.tabAnalytics.classList.toggle("active", analytics);
  els.tabNewsletter.classList.toggle("active", newsletter);
  els.tabSponsors.classList.toggle("active", sponsors);
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
});
els.analyticsWindowSelect.addEventListener("change", () => loadAnalytics());
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
