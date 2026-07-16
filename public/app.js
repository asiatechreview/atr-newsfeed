const feed = document.querySelector("#feed-list");
const status = document.querySelector("#feed-status");
const dateTemplate = document.querySelector("#date-template");
const itemTemplate = document.querySelector("#item-template");

const sampleItems = [
  {
    published_at: "2026-07-13T00:00:00+07:00",
    blurb: "South Korea's SK Hynix closed 13% higher on its US debut after raising $26.5 billion through a Nasdaq ADR offering",
    source_name: "Bloomberg",
    source_url: "https://example.com"
  },
  {
    published_at: "2026-07-13T00:00:00+07:00",
    blurb: "Indian premium grocery startup FirstClub raised a $55 million Series B round led by Peak XV Partners and Sofina at a $255 million valuation",
    source_name: "TechCrunch",
    source_url: "https://example.com"
  },
  {
    published_at: "2026-07-12T00:00:00+07:00",
    blurb: "Paste each new item into the Google Sheet as a finished daily blurb, then add the source name and link in the next columns",
    source_name: "Source Name",
    source_url: "https://example.com"
  }
];

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

function dateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || "Undated";
  }

  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Bangkok"
  }).format(date);
}

function appendItemText(target, item) {
  target.append(document.createTextNode(`${item.blurb} [`));

  const source = document.createElement("a");
  source.href = item.source_url || "#";
  source.target = "_blank";
  source.rel = "noopener";
  source.textContent = item.source_name || "Source";

  target.appendChild(source);
  target.append(document.createTextNode("]"));
}

function render(items, options = {}) {
  feed.textContent = "";
  status.textContent = options.statusText || "";

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No updates yet.";
    feed.appendChild(empty);
    return;
  }

  let currentDate = "";

  for (const item of items) {
    const nextDate = dateKey(item.published_at);

    if (nextDate !== currentDate) {
      currentDate = nextDate;
      const dateNode = dateTemplate.content.cloneNode(true);
      dateNode.querySelector(".date").textContent = formatDate(item.published_at);
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
    const items = payload.items || [];

    if (!items.length) {
      render(sampleItems, {
        statusText: "Sample data shown. Replace SHEET_CSV_URL in index.html with your published Google Sheet CSV link."
      });
      return;
    }

    render(items, { statusText: "" });
  } catch (error) {
    render(sampleItems, {
      statusText: "Sample data shown. Replace SHEET_CSV_URL in index.html with your published Google Sheet CSV link."
    });
  }
}

loadFeed();
