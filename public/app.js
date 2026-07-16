const feed = document.querySelector("#feed-list");
const status = document.querySelector("#feed-status");
const archiveNav = document.querySelector("#archive-nav");
const dateTemplate = document.querySelector("#date-template");
const itemTemplate = document.querySelector("#item-template");

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

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok"
  });
}

function shortDateLabel(value) {
  const key = dateKey(value);
  const today = dateKey(new Date().toISOString());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (key === today) {
    return "Today";
  }

  if (key === dateKey(yesterday.toISOString())) {
    return "Yesterday";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || "Undated";
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "Asia/Bangkok"
  });
}

function dateKey(value) {
  const date = typeof value === "object" ? parseDate(value) : new Date(value);
  if (!date || Number.isNaN(date.getTime())) {
    if (typeof value === "object") {
      return value.Date || value.date || "Undated";
    }
    return value || "Undated";
  }

  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Bangkok"
  }).format(date);
}

function isValidLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
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
    source_url: isValidLink(sourceUrl) ? sourceUrl : ""
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

  target.append(document.createTextNode(item.blurb));

  if (!item.source_name) {
    return;
  }

  target.append(document.createTextNode(" ["));

  if (item.source_url) {
    const source = document.createElement("a");
    source.href = item.source_url;
    source.target = "_blank";
    source.rel = "noopener";
    source.textContent = item.source_name;
    target.appendChild(source);
  } else {
    target.append(document.createTextNode(item.source_name));
  }

  target.append(document.createTextNode("]"));
}

function renderArchive(items) {
  archiveNav.textContent = "";
  const seen = new Set();

  for (const item of items) {
    const key = dateKey(item.published_at);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    const link = document.createElement("a");
    link.href = `#${key}`;
    link.textContent = shortDateLabel(item.published_at);
    archiveNav.appendChild(link);

    if (seen.size >= 5) {
      break;
    }
  }
}

function render(items, options = {}) {
  const cleanItems = sortItems(items.map(normalizeItem).filter(Boolean));

  feed.textContent = "";
  archiveNav.textContent = "";
  status.textContent = options.statusText || "";

  if (!cleanItems.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No updates yet.";
    feed.appendChild(empty);
    return;
  }

  renderArchive(cleanItems);

  let currentDate = "";

  for (const item of cleanItems) {
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
    feed.appendChild(itemNode);
  }
}

async function loadFeed() {
  try {
    const response = await fetch("/api/items?limit=100", {
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
