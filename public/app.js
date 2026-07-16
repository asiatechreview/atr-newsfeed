const feed = document.querySelector("#feed-list");
const status = document.querySelector("#feed-status");
const dateTemplate = document.querySelector("#date-template");
const itemTemplate = document.querySelector("#item-template");

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || "Undated";
  }

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Bangkok"
  });
}

function dateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Undated";
  }

  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Bangkok"
  }).format(date);
}

function appendSource(blurb, item) {
  blurb.append(document.createTextNode(`${item.blurb} [`));

  const link = document.createElement("a");
  link.href = item.source_url || "#";
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = item.source_name || "Source";
  blurb.appendChild(link);
  blurb.append(document.createTextNode("]"));
}

function render(items) {
  feed.textContent = "";

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No updates yet.";
    feed.appendChild(empty);
    status.textContent = "Waiting for the first published item.";
    return;
  }

  let currentDate = "";

  for (const item of items) {
    const itemDate = dateKey(item.published_at);

    if (itemDate !== currentDate) {
      currentDate = itemDate;
      const dateNode = dateTemplate.content.cloneNode(true);
      dateNode.querySelector(".date").textContent = formatDate(item.published_at);
      feed.appendChild(dateNode);
    }

    const node = itemTemplate.content.cloneNode(true);
    appendSource(node.querySelector(".blurb"), item);
    feed.appendChild(node);
  }

  status.textContent = `${items.length} published update${items.length === 1 ? "" : "s"}.`;
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
    render(payload.items || []);
  } catch (error) {
    console.error(error);
    feed.innerHTML = '<p class="empty">The feed is unavailable right now.</p>';
    status.textContent = "Could not load latest updates.";
  }
}

loadFeed();
