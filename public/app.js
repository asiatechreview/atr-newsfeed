const feed = document.querySelector("#feed");
const template = document.querySelector("#item-template");
const count = document.querySelector("#feed-count");
const updated = document.querySelector("#feed-updated");
const categoryFilter = document.querySelector("#category-filter");

let allItems = [];

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || "Undated";
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok"
  });
}

function sourceLabel(item) {
  const label = item.source_name || "Source";
  return `[${label}]`;
}

function renderCategories(items) {
  const categories = [...new Set(items.map((item) => item.category).filter(Boolean))].sort();
  categoryFilter.querySelectorAll("option:not(:first-child)").forEach((option) => option.remove());

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryFilter.appendChild(option);
  });
}

function render(items) {
  const selected = categoryFilter.value;
  const visible = selected ? items.filter((item) => item.category === selected) : items;

  feed.textContent = "";
  count.textContent = `${visible.length} item${visible.length === 1 ? "" : "s"}`;
  updated.textContent = visible[0] ? `Latest: ${formatDate(visible[0].published_at)}` : "No published items yet";

  if (!visible.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No feed items match this view yet.";
    feed.appendChild(empty);
    return;
  }

  visible.forEach((item) => {
    const node = template.content.cloneNode(true);
    const time = node.querySelector("time");
    const category = node.querySelector(".category");
    const blurb = node.querySelector(".blurb");

    time.dateTime = item.published_at || "";
    time.textContent = formatDate(item.published_at);
    category.textContent = item.category || "Other news";

    blurb.append(document.createTextNode(`${item.blurb} `));
    blurb.append(document.createTextNode("["));

    const link = document.createElement("a");
    link.href = item.source_url || "#";
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = item.source_name || "Source";
    link.ariaLabel = `Read source: ${sourceLabel(item)}`;
    blurb.appendChild(link);
    blurb.append(document.createTextNode("]"));

    feed.appendChild(node);
  });
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
    allItems = payload.items || [];
    renderCategories(allItems);
    render(allItems);
  } catch (error) {
    console.error(error);
    count.textContent = "Feed unavailable";
    updated.textContent = "Could not load latest items";
    feed.innerHTML = '<p class="empty">The feed API is not available yet. Check back after deployment.</p>';
  }
}

categoryFilter.addEventListener("change", () => render(allItems));
loadFeed();
