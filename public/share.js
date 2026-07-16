const status = document.querySelector("#feed-status");
const wrap = document.querySelector("#share-card-wrap");

function getRequestedId() {
  const match = window.location.search.match(/[?&]id=([^&]+)/);
  return match ? decodeURIComponent(match[1].replace(/\+/g, " ")) : "";
}

function itemId(item) {
  return String(item.id || item.ID || item.ItemID || item.item_id || "").trim();
}

function itemBlurb(item) {
  return String(item.Blurb || item.blurb || "").trim();
}

function itemSourceName(item) {
  return String(item.Source || item.source || item.source_name || item.sourceName || "").trim();
}

function itemSourceUrl(item) {
  const value = String(item.URL || item.Url || item.url || item.source_url || item.sourceUrl || "").trim();
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? value : "";
  } catch {
    return "";
  }
}

function makeLink(href, text) {
  const link = document.createElement("a");
  link.href = href;
  link.textContent = text;
  return link;
}

function renderCard(item) {
  const card = document.createElement("article");
  card.className = "share-card";

  const brand = document.createElement("p");
  brand.className = "share-card-brand";
  const title = document.createElement("strong");
  title.textContent = "Asia Tech Review";
  const tagline = document.createElement("span");
  tagline.textContent = "Keeping up with Asia tech news";
  brand.append(title, tagline);

  const main = document.createElement("div");
  main.className = "share-card-main";
  const blurb = document.createElement("p");
  blurb.className = "share-card-blurb";
  blurb.textContent = itemBlurb(item);

  const sourceName = itemSourceName(item);
  const sourceUrl = itemSourceUrl(item);
  let source;
  if (sourceUrl) {
    source = makeLink(sourceUrl, sourceName || "Source");
    source.target = "_blank";
    source.rel = "noopener";
  } else {
    source = document.createElement("span");
    source.textContent = sourceName || "Source";
  }
  source.className = "share-card-source";
  main.append(blurb, source);

  const footer = document.createElement("p");
  footer.className = "share-card-footer";
  footer.append(
    makeLink("https://asiatechreview.com", "asiatechreview.com"),
    document.createTextNode(" · "),
    makeLink("https://feed.asiatechreview.com", "feed.asiatechreview.com")
  );

  card.append(brand, main, footer);
  wrap.textContent = "";
  wrap.appendChild(card);
  wrap.hidden = false;
  status.textContent = "";
}

async function loadShareCard() {
  const id = getRequestedId();
  if (!id) {
    status.textContent = "Missing share item.";
    return;
  }

  try {
    const response = await fetch("/api/items?limit=500", {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) {
      throw new Error(`Feed API returned ${response.status}`);
    }

    const payload = await response.json();
    const item = (payload.items || []).find((entry) => itemId(entry) === id);
    if (!item) {
      status.textContent = "Share item not found.";
      return;
    }

    renderCard(item);
  } catch (error) {
    status.textContent = "Share card unavailable. Try again shortly.";
  }
}

loadShareCard();
