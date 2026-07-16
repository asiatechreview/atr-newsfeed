const feed = document.querySelector("#feed-list");
const status = document.querySelector("#feed-status");
const archiveNav = document.querySelector("#archive-nav");
const pagination = document.querySelector("#pagination");
const dateTemplate = document.querySelector("#date-template");
const itemTemplate = document.querySelector("#item-template");
const ITEMS_PER_PAGE = 15;
const ARCHIVE_DAYS = 7;

let allItems = [];
let currentPage = getRequestedPage();
let currentDateFilter = getRequestedDateFilter();
let currentTagFilter = getRequestedTagFilter();

function getRequestedPage() {
  const match = window.location.search.match(/[?&]page=([0-9]+)/);
  const page = match ? Number(match[1]) : 1;
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function getRequestedDateFilter() {
  const match = window.location.search.match(/[?&]date=([0-9]{4}-[0-9]{2}-[0-9]{2})/);
  return match ? match[1] : "";
}

function getRequestedTagFilter() {
  const match = window.location.search.match(/[?&]tag=([^&]+)/);
  return match ? normalizeTag(decodeURIComponent(match[1].replace(/\+/g, " "))) : "";
}

function updateFeedUrl(options = {}) {
  if (!window.history || !window.history.replaceState) {
    return;
  }

  try {
    const url = new URL(window.location.href);
    const page = options.page || 1;
    const date = options.date || "";
    const tag = options.tag || "";

    if (date) {
      url.searchParams.set("date", date);
      url.searchParams.delete("page");
    } else {
      url.searchParams.delete("date");
    }

    if (tag) {
      url.searchParams.set("tag", tag);
      url.searchParams.delete("date");
    } else {
      url.searchParams.delete("tag");
    }

    if (!date && page > 1) {
      url.searchParams.set("page", String(page));
    } else {
      url.searchParams.delete("page");
    }

    window.history.replaceState({}, "", url);
  } catch (error) {
    // Some mobile in-app browsers expose partial URL/history APIs.
  }
}

function parseDate(item) {
  const dateValue = item.Date || item.date || item.published_at || item.publishedAt || item.created_at || "";
  const timeValue = item.Time || item.time || "";

  if (!dateValue) {
    return null;
  }

  if (timeValue && /^\d{1,2}:\d{2}/.test(timeValue)) {
    return new Date(`${dateValue}T${timeValue}:00+07:00`);
  }

  return new Date(dateValue);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || "Undated";
  }

  try {
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      timeZone: "Asia/Bangkok"
    });
  } catch (error) {
    return fallbackDateLabel(date, false);
  }
}

function shortDateLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || "Undated";
  }

  try {
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      timeZone: "Asia/Bangkok"
    });
  } catch (error) {
    return fallbackDateLabel(date, false);
  }
}

function archiveDateLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || "Undated";
  }

  try {
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      timeZone: "Asia/Bangkok"
    }) + ordinalSuffix(Number(date.toLocaleDateString("en-US", {
      day: "numeric",
      timeZone: "Asia/Bangkok"
    })));
  } catch (error) {
    return fallbackDateLabel(date, false) + ordinalSuffix(date.getDate());
  }
}

function ordinalSuffix(day) {
  if (day >= 11 && day <= 13) {
    return "th";
  }

  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

function dateKey(value) {
  const date = value instanceof Date ? value : typeof value === "object" ? parseDate(value) : new Date(value);
  if (!date || Number.isNaN(date.getTime())) {
    if (typeof value === "object") {
      return value.Date || value.date || "Undated";
    }
    return value || "Undated";
  }

  try {
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Asia/Bangkok"
    }).format(date);
  } catch (error) {
    return [
      date.getFullYear(),
      pad2(date.getMonth() + 1),
      pad2(date.getDate())
    ].join("-");
  }
}

function pad2(value) {
  return value < 10 ? `0${value}` : String(value);
}

function fallbackDateLabel(date, includeYear) {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];
  const monthDay = `${months[date.getMonth()]} ${date.getDate()}`;
  return includeYear ? `${monthDay} ${date.getFullYear()}` : monthDay;
}

function bangkokToday() {
  const now = new Date();

  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Asia/Bangkok"
    }).formatToParts(now);
    const values = {};
    for (const part of parts) {
      values[part.type] = part.value;
    }
    return new Date(`${values.year}-${values.month}-${values.day}T00:00:00+07:00`);
  } catch (error) {
    return new Date(now.getTime() + (7 * 60 * 60 * 1000));
  }
}

function recentArchiveDates() {
  const dates = [];
  const start = bangkokToday();

  for (let index = 0; index < ARCHIVE_DAYS; index += 1) {
    const date = new Date(start.getTime());
    date.setUTCDate(start.getUTCDate() - index);
    dates.push(date);
  }

  return dates;
}

function isValidLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeTag(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^#/, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function explicitTags(item) {
  const value = item.Tags || item.tags || item.Tag || item.tag || "";
  if (Array.isArray(value)) {
    return value.map(normalizeTag).filter(Boolean);
  }

  return String(value)
    .split(/[,|#]/)
    .map(normalizeTag)
    .filter(Boolean);
}

function inferTags(item, blurb) {
  const text = [
    blurb,
    item.Region,
    item.region,
    item.Category,
    item.category,
    item.source_name,
    item.Source,
    item.source
  ].join(" ").toLowerCase();

  const tags = [];
  const add = (tag) => {
    if (!tags.includes(tag)) {
      tags.push(tag);
    }
  };

  if (/\b(e-commerce|ecommerce|commerce|marketplace|online retail|retail|b2b e-commerce|b2b ecommerce|udaan|shein|amazon)\b/.test(text)) {
    add("e-commerce");
  }

  if (/\b(fund|funding|raised|raise|secured|series [a-z]|seed|ipo|listing|public listing|valuation|stake|acquisition|buy|bought|deal|invest|investment|grant|equity|debt|convertible|restructuring)\b/.test(text)) {
    add("deals");
  }

  if (/\b(markets?|shares?|stock|trading|revenue|profit|sales|tax|yield|price|valuation|ipo|listing|public listing|investors?|equity|debt|convertible|balance sheet)\b/.test(text)) {
    add("markets");
  }

  if (/\b(ai|artificial intelligence|llm|large model|model|claude|openai|anthropic|deepseek|minimax|moonshot|agentic|nvidia|waic)\b/.test(text)) {
    add("ai");
  }

  if (/\b(chip|chips|semiconductor|semiconductors|tsmc|samsung|sk hynix|hynix|cxmt|umc|silicon|photonics|fab|foundry|packaging|hbm|nvidia)\b/.test(text)) {
    add("chips");
  }

  if (/\b(robot|robots|robotics|humanoid|automation|factory|atlas|x[p]?eng|boston dynamics)\b/.test(text)) {
    add("robotics");
  }

  if (/\b(crypto|bitcoin|stablecoin|stablecoins|blockchain|onchain|token|digital asset|solana)\b/.test(text)) {
    add("crypto");
  }

  return tags;
}

function itemTags(item, blurb) {
  const tags = [...explicitTags(item), ...inferTags(item, blurb)];
  return [...new Set(tags)].slice(0, 4);
}

function normalizeItem(item) {
  const blurb = String(item.Blurb || item.blurb || "").trim();
  if (!blurb) {
    return null;
  }

  const parsedDate = parseDate(item);
  const sourceUrl = String(item.URL || item.Url || item.url || item.source_url || item.sourceUrl || "").trim();

  return {
    blurb,
    published_at: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : new Date().toISOString(),
    region: String(item.Region || item.region || item.Category || item.category || "").trim(),
    source_name: String(item.Source || item.source || item.source_name || item.sourceName || "").trim(),
    source_url: isValidLink(sourceUrl) ? sourceUrl : "",
    tags: itemTags(item, blurb)
  };
}

function sortItems(items) {
  return items.sort((a, b) => {
    const aTime = new Date(a.published_at).getTime() || 0;
    const bTime = new Date(b.published_at).getTime() || 0;
    return bTime - aTime;
  });
}

function appendItemText(target, item) {
  if (item.region) {
    const region = document.createElement("span");
    region.className = "region";
    region.textContent = `[${item.region}] `;
    target.appendChild(region);
  }

  target.appendChild(document.createTextNode(item.blurb));

  if (!item.source_name) {
    return;
  }

  target.appendChild(document.createTextNode(" ["));

  if (item.source_url) {
    const source = document.createElement("a");
    source.href = item.source_url;
    source.target = "_blank";
    source.rel = "noopener";
    source.textContent = item.source_name;
    target.appendChild(source);
  } else {
    target.appendChild(document.createTextNode(item.source_name));
  }

  target.appendChild(document.createTextNode("]"));
}

function renderTags(target, item) {
  target.textContent = "";

  if (!item.tags.length) {
    target.hidden = true;
    return;
  }

  target.hidden = false;

  for (const tag of item.tags) {
    const link = document.createElement("a");
    link.href = `?tag=${encodeURIComponent(tag)}`;
    link.textContent = `#${tag}`;

    if (tag === currentTagFilter) {
      link.className = "current";
      link.setAttribute("aria-current", "page");
    }

    target.appendChild(link);
  }
}

function renderArchive() {
  archiveNav.textContent = "";

  for (const date of recentArchiveDates()) {
    const key = dateKey(date);
    const link = document.createElement("a");
    link.href = `?date=${key}`;
    link.textContent = archiveDateLabel(date);
    link.dataset.date = key;

    if (key === currentDateFilter) {
      link.className = "current";
      link.setAttribute("aria-current", "page");
    }

    archiveNav.appendChild(link);
  }
}

function createPageButton(label, page, options = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.disabled = options.disabled || false;

  if (options.current) {
    button.className = "current";
    button.setAttribute("aria-current", "page");
  }

  button.addEventListener("click", () => {
    if (currentTagFilter) {
      renderTag(currentTagFilter, page);
    } else {
      renderPage(page);
    }
  });
  return button;
}

function renderPagination(totalItems) {
  pagination.textContent = "";

  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  if (totalPages <= 1) {
    pagination.hidden = true;
    return;
  }

  pagination.hidden = false;
  pagination.appendChild(createPageButton("Previous", Math.max(1, currentPage - 1), {
    disabled: currentPage === 1
  }));

  for (let page = 1; page <= totalPages; page += 1) {
    pagination.appendChild(createPageButton(String(page), page, {
      current: page === currentPage
    }));
  }

  pagination.appendChild(createPageButton("Next", Math.min(totalPages, currentPage + 1), {
    disabled: currentPage === totalPages
  }));
}

function renderPage(page = currentPage) {
  currentDateFilter = "";
  currentTagFilter = "";
  const totalPages = Math.max(1, Math.ceil(allItems.length / ITEMS_PER_PAGE));
  currentPage = Math.min(Math.max(1, page), totalPages);
  updateFeedUrl({ page: currentPage });

  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageItems = allItems.slice(start, start + ITEMS_PER_PAGE);

  feed.textContent = "";
  archiveNav.textContent = "";
  status.textContent = "";

  if (!pageItems.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No updates yet.";
    feed.appendChild(empty);
    renderPagination(0);
    return;
  }

  renderArchive();
  renderItems(pageItems);
  renderPagination(allItems.length);
}

function renderDate(date) {
  currentDateFilter = date;
  currentTagFilter = "";
  currentPage = 1;
  updateFeedUrl({ date });

  const dateItems = allItems.filter((item) => dateKey(item.published_at) === date);

  feed.textContent = "";
  archiveNav.textContent = "";
  status.textContent = "";
  pagination.textContent = "";
  pagination.hidden = true;

  renderArchive();

  if (!dateItems.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No updates for this date.";
    feed.appendChild(empty);
    return;
  }

  renderItems(dateItems);
}

function renderTag(tag, page = currentPage) {
  currentDateFilter = "";
  currentTagFilter = normalizeTag(tag);

  const tagItems = allItems.filter((item) => item.tags.includes(currentTagFilter));
  const totalPages = Math.max(1, Math.ceil(tagItems.length / ITEMS_PER_PAGE));
  currentPage = Math.min(Math.max(1, page), totalPages);
  updateFeedUrl({ tag: currentTagFilter, page: currentPage });

  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageItems = tagItems.slice(start, start + ITEMS_PER_PAGE);

  feed.textContent = "";
  archiveNav.textContent = "";
  status.textContent = "";

  renderArchive();

  if (!pageItems.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = `No updates tagged #${currentTagFilter}.`;
    feed.appendChild(empty);
    renderPagination(0);
    return;
  }

  renderItems(pageItems);
  renderPagination(tagItems.length);
}

function renderItems(items) {
  let currentDate = "";

  for (const item of items) {
    const nextDate = dateKey(item.published_at);

    if (nextDate !== currentDate) {
      currentDate = nextDate;
      const dateNode = dateTemplate.content.cloneNode(true);
      const date = dateNode.querySelector(".date");
      date.id = currentDate;
      date.textContent = formatDate(item.published_at);
      feed.appendChild(dateNode);
    }

    const itemNode = itemTemplate.content.cloneNode(true);
    appendItemText(itemNode.querySelector(".blurb"), item);
    renderTags(itemNode.querySelector(".tags"), item);
    feed.appendChild(itemNode);
  }
}

function render(items, options = {}) {
  allItems = sortItems(items.map(normalizeItem).filter(Boolean));

  if (options.statusText) {
    feed.textContent = "";
    archiveNav.textContent = "";
    pagination.textContent = "";
    pagination.hidden = true;
    status.textContent = options.statusText;
    return;
  }

  if (currentTagFilter) {
    renderTag(currentTagFilter);
  } else if (currentDateFilter) {
    renderDate(currentDateFilter);
  } else {
    renderPage(currentPage);
  }
}

async function loadFeed() {
  try {
    const params = [`limit=${currentDateFilter || currentTagFilter ? 500 : 100}`];
    if (currentDateFilter) {
      params.push(`date=${encodeURIComponent(currentDateFilter)}`);
    }

    const response = await fetch(`/api/items?${params.join("&")}`, {
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error(`Feed API returned ${response.status}`);
    }

    const payload = await response.json();
    render(payload.items || [], { statusText: "" });
  } catch (error) {
    render([], {
      statusText: "Feed unavailable. Try again shortly."
    });
  }
}

loadFeed();
