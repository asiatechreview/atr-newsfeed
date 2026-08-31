const DEFAULT_CATEGORY = "Other news";
const ITEMS_PER_PAGE = 20;

// Category inference for manual entries (mirrors the public site's tag inference,
// mapped to the category labels ATR actually uses). Pure client-side, no LLM.
const CATEGORY_RULES = [
  { label: "WAIC 2026", pattern: /\bwaic\b/ },
  { label: "Cloud", pattern: /\b(cloud|data centre|data center|data centres|data centers|hyperscaler|hyperscalers|aws|azure|google cloud|alibaba cloud|tencent cloud|huawei cloud|cloud computing|cloud services|cloud infrastructure|infrastructure-as-a-service|iaas|saas|paas)\b/ },
  { label: "AI", pattern: /\b(ai|artificial intelligence|llm|multimodal|foundation model|claude|openai|anthropic|deepseek|minimax|moonshot|agentic|nvidia|distillation|gpu)\b/ },
  { label: "Chips", pattern: /\b(chip|chips|chipmaker|chipmaking|semiconductor|semiconductors|integrated circuit|tsmc|sk hynix|hynix|cxmt|silicon|photonics|fab|foundry|packaging|hbm|memory chips?)\b/ },
  { label: "Robotics", pattern: /\b(robot|robots|robotics|humanoid|robotaxi|robotaxis|unitree|agibot|ubtech|boston dynamics|figure|digit robot)\b/ },
  { label: "EVs", pattern: /\b(electric vehicle|electric vehicles|evs?|ev maker|ev makers|ev battery|ev charging|charging network|ev startup)\b/ },
  { label: "Transportation", pattern: /\b(transportation|transport|logistics|shipping|airline|airlines|aviation|airport|airports|railway|railways|rail|train|trains|port|ports|freight|trucking|courier|delivery)\b/ },
  { label: "Energy", pattern: /\b(energy|solar|wind power|renewables?|grid|power plant|power station|oil|natural gas|nuclear|battery|catl|energy storage|petrochemicals?)\b/ },
  { label: "Space", pattern: /\b(space|satellite|satellites|rocket|rockets|launch vehicle|spacecraft|orbit|starlink|gps|gnss)\b/ },
  { label: "E-commerce", pattern: /\b(e-commerce|ecommerce|marketplace|online retail|shopee|lazada|shein|tiktok shop|quick commerce)\b/ },
  { label: "Hardware", pattern: /\b(smartphone|smartphones|handset|handsets|laptop|laptops|tablet|tablets|wearable|wearables|consumer electronics|headset|headsets|gadget|gadgets|iphone|airpods|pixel phone)\b/ },
  { label: "Biotech", pattern: /\b(biotech|biotechnology|biopharma|protein design|gene therapy|genomics|genome|clinical trial|pharma|pharmaceutical|drug development|drugmaker|vaccine development|cell therapy)\b/ },
  { label: "Health", pattern: /\b(health|healthcare|health care|hospital|hospitals|medical|medicine|doctor|doctors|nurse|nurses|patient|patients|telehealth|telemedicine|medtech|wellness|mental health|health insurance)\b/ },
  { label: "Crypto", pattern: /\b(crypto|bitcoin|stablecoin|stablecoins|blockchain|onchain|token|digital asset|solana)\b/ },
  { label: "Fintech", pattern: /\b(bank|banking|fintech|financial|payments?|qr payment|insurance|lending|digital bank|coinhako)\b/ },
  // Venture Capital = the industry: VC/PE firms raising their own funds,
  // LPs, fund of funds, accelerators, incubators ("Peak XV closes fund").
  { label: "Venture Capital", pattern: /\b(venture capital|venture-capital|vc firm|vc firms|vc fund|vc funds|private equity|pe firm|pe firms|pe fund|pe funds|fund of funds|limited partner|limited partners|accelerator|incubator|raises?[^.]*?\bfund\b|closes?[^.]*?\bfund\b|new\s+fund\b)\b/ },
  // Funding = money moving into a company: rounds, raises, seed, Series A-Z,
  // secured investment ("startup raises Series B").
  { label: "Funding", pattern: /\b(funding|raise|raised|raises|raising|secured|secures|series [a-z]|seed round|pre-seed|backs|backed by|valuation)\b/ },
  // Deals = M&A only: acquisitions, mergers, buyouts, takeovers, stakes,
  // divestments, consolidation.
  { label: "Deals", pattern: /\b(acquisition|acquisitions|acquire|acquires|acquired|merger|mergers|merging|buyout|buyouts|takeover|take over|stake|stakes|sell|sells|sold|divest|divesting|consolidat|restructuring)\b/ },
  { label: "Earnings", pattern: /\b(earnings|quarterly results|quarterly report|net income|net profit|profit warning)\b/ },
  { label: "Markets", pattern: /\b(markets?|shares?|stock|trading|revenue|profit|sales|yield|price|ipo|listing|public listing|investors?|balance sheet|tax)\b/ },
  { label: "Policy", pattern: /\b(regulator|regulators|regulation|regulations|policy|government|ministry|customs|approval|approved|audit|probe|immigration|law|rules|compliance|incentives|public sector|sanctions|tariff|tariffs)\b/ },
  { label: "Cybersecurity", pattern: /\b(cybersecurity|security|hack|hacked|breach|ransomware|data leak|critical infrastructure|export controls?|export-restricted|illicit finance)\b/ },
  { label: "Mobility", pattern: /\b(mobility|electric vehicle|electric vehicles|evs?|ride-hailing|ride hailing|grab|gojek|go-jek|autonomous|self-driving|self driving|carmaker|carmakers|scooters?)\b/ },
  { label: "Gaming", pattern: /\b(gaming|games|esports|e-sports|famitsu)\b/ },
  { label: "Telecommunications", pattern: /\b(telecom|telecommunications|5g|6g|network operator|spectrum|broadband)\b/ },
  { label: "Startups", pattern: /\b(startup|startups|start-up|start-ups|unicorn)\b/ },
  { label: "Apps", pattern: /\b(apps?|app store|superapp|super-app)\b/ }
];

function inferCategory(text) {
  const lower = String(text || "").toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(lower)) return rule.label;
  }
  return "";
}

let lastAutoCategory = "";

function maybeAutoFillCategory() {
  if (state.mode !== "new") return;
  const current = els.category.value.trim();
  const untouched = current === "" || current === DEFAULT_CATEGORY || current === lastAutoCategory;
  if (!untouched) return;
  const text = [els.blurb.value, els.headline.value, els.sourceName.value].join(" ");
  const inferred = inferCategory(text);
  if (!inferred) return;
  lastAutoCategory = inferred;
  els.category.value = inferred;
}

// Soft duplicate guard for the publish form: when the typed headline closely
// matches an existing item's headline, show a non-blocking warning so a story
// that was already carried (possibly under a different URL) is flagged before
// posting. Similarity is token-overlap on normalised text; >= 0.8 warns.
function headlineTokens(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function headlineSimilarity(a, b) {
  const ta = headlineTokens(a);
  const tb = headlineTokens(b);
  if (!ta.length || !tb.length) return 0;
  const set = new Set(tb);
  const overlap = ta.filter((token) => set.has(token)).length;
  return overlap / Math.max(ta.length, tb.length);
}

function checkSimilarHeadline() {
  const warning = els.headlineSimilarWarning;
  if (!warning) return;
  const value = (els.headline.value || "").trim();
  if (!value) {
    warning.hidden = true;
    return;
  }

  const editingId = state.mode === "edit" && state.selected ? String(state.selected.id) : null;
  let best = null;
  let bestScore = 0;
  for (const item of state.items) {
    const id = String(item.id);
    if (editingId && id === editingId) continue;
    const score = headlineSimilarity(value, item.headline || item.title || "");
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  if (best && bestScore >= 0.8) {
    const exact = bestScore >= 0.99;
    warning.textContent = `${exact ? "Duplicate" : "Similar"} headline already exists: "${best.headline || best.title}" (id ${best.id})`;
    warning.hidden = false;
  } else {
    warning.hidden = true;
  }
}

// Server-side story match: same company + same event within the match window
// (see /api/story-match and _lib/story-match.js). Debounced so typing does
// not hammer the endpoint; results are appended to the same warning element.
let storyMatchTimer = null;
function checkStoryMatch() {
  if (state.mode !== "new") return;
  const headline = (els.headline.value || "").trim();
  const blurb = (els.blurb.value || "").trim();
  if (!headline && !blurb) return;

  window.clearTimeout(storyMatchTimer);
  storyMatchTimer = window.setTimeout(async () => {
    const warning = els.headlineSimilarWarning;
    if (!warning) return;
    try {
      const response = await fetch(`/api/story-match?headline=${encodeURIComponent(headline)}&blurb=${encodeURIComponent(blurb)}`, {
        headers: { accept: "application/json" },
        credentials: "same-origin"
      });
      if (response.status === 401) return;
      if (!response.ok) return;
      const payload = await response.json();
      const matches = Array.isArray(payload.matches) ? payload.matches : [];
      if (!matches.length) {
        if (!warning.textContent) warning.hidden = true;
        return;
      }
      const top = matches.slice(0, 2);
      const lines = top.map((m) => {
        const when = m.days_ago < 1 ? "today" : `${m.days_ago}d ago`;
        return `"${m.headline}" (${m.source_name || "?"}, ${when}, id ${m.id})`;
      });
      const label = matches.length > 1 ? `Possible same story (${matches.length}):` : "Possible same story:";
      warning.textContent = `${label} ${lines.join(" | ")}`;
      warning.hidden = false;
    } catch {
      // Story match is advisory; never block the form on a network error.
    }
  }, 350);
}

// Source name inference: derive the outlet from the source URL domain.
const SOURCE_NAME_MAP = {
  "reuters.com": "Reuters",
  "bloomberg.com": "Bloomberg",
  "nytimes.com": "NYT",
  "wsj.com": "WSJ",
  "ft.com": "FT",
  "techcrunch.com": "TechCrunch",
  "techmeme.com": "Techmeme",
  "economist.com": "The Economist",
  "theverge.com": "The Verge",
  "theinformation.com": "The Information",
  "nikkei.com": "Nikkei",
  "asia.nikkei.com": "Nikkei",
  "nikkei.asia": "Nikkei",
  "economictimes.indiatimes.com": "The Economic Times",
  "entrackr.com": "Entrackr",
  "theblock.co": "The Block",
  "coindesk.com": "CoinDesk",
  "cointelegraph.com": "CoinTelegraph",
  "technode.global": "TechNode",
  "techinasia.com": "Tech in Asia",
  "news.nus.edu.sg": "NUS",
  "dealstreetasia.com": "DealStreetAsia",
  "thehindu.com": "The Hindu",
  "livemint.com": "Mint",
  "moneycontrol.com": "Moneycontrol",
  "businesstoday.in": "Business Today",
  "indianexpress.com": "The Indian Express",
  "straitstimes.com": "The Straits Times",
  "channelnewsasia.com": "CNA",
  "scmp.com": "South China Morning Post",
  "japantimes.co.jp": "The Japan Times",
  "koreaherald.com": "The Korea Herald",
  "yonhapnews.co.kr": "Yonhap",
  "cnbc.com": "CNBC",
  "cnn.com": "CNN",
  "bbc.com": "BBC",
  "bbc.co.uk": "BBC",
  "apnews.com": "AP",
  "theguardian.com": "The Guardian",
  "wired.com": "Wired",
  "restofworld.org": "Rest of World",
  "semafor.com": "Semafor",
  "axios.com": "Axios",
  "thefintechtimes.com": "The Fintech Times",
  "finews.asia": "finews.asia",
  "pymnts.com": "PYMNTS",
  "thenextweb.com": "TNW",
  "sifted.eu": "Sifted",
  "campaignasia.com": "Campaign Asia",
  "marketing-interactive.com": "Marketing Interactive",
  "digiday.com": "Digiday",
  "gizmochina.com": "Gizmochina",
  "xda-developers.com": "XDA Developers"
};

function domainOf(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    try {
      return new URL(`https://${value}`).hostname.toLowerCase();
    } catch {
      return "";
    }
  }
}

const COMPOUND_TLDS = ["co.uk", "org.uk", "gov.uk", "com.au", "org.au", "com.sg", "com.cn", "org.cn", "co.jp", "co.kr", "com.hk", "co.in", "com.my", "com.tw", "com.br", "co.nz", "com.ph", "com.vn", "com.th", "com.id", "co.za"];

function registrableName(parts) {
  const host = parts.join(".");
  for (const suffix of COMPOUND_TLDS) {
    if (host === suffix || host.endsWith(`.${suffix}`)) {
      const base = host.slice(0, -(suffix.length + 1));
      const baseParts = base.split(".");
      return baseParts[baseParts.length - 1];
    }
  }
  return parts.length > 2 ? parts[parts.length - 2] : parts[0];
}

function inferSourceName(url) {
  const host = domainOf(url);
  if (!host) return "";
  const parts = host.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    const candidate = parts.slice(i).join(".");
    if (SOURCE_NAME_MAP[candidate]) return SOURCE_NAME_MAP[candidate];
  }
  return registrableName(parts)
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

let lastAutoSourceName = "";

function maybeAutoFillSourceName() {
  if (state.mode !== "new") return;
  const current = els.sourceName.value.trim();
  if (current !== "" && current !== lastAutoSourceName) return;
  const inferred = inferSourceName(els.sourceUrl.value);
  if (!inferred) return;
  lastAutoSourceName = inferred;
  els.sourceName.value = inferred;
}

const state = {
  items: [],
  filtered: [],
  selected: null,
  mode: "edit",
  sponsors: [],
  page: 1,
  category: "",
  categories: [],
  currentUser: "",
  selectedIds: new Set(),
  source: "",
  sort: "newest"
};

const els = {
  loadBar: document.querySelector("#load-bar"),
  authPanel: document.querySelector("#auth-panel"),
  authMessage: document.querySelector("#auth-message"),
  usernameInput: document.querySelector("#username-input"),
  passwordInput: document.querySelector("#password-input"),
  saveTokenButton: document.querySelector("#save-token-button"),
  tokenButton: document.querySelector("#token-button"),
  whoami: document.querySelector("#whoami"),
  whoamiAvatar: document.querySelector("#whoami-avatar"),
  whoamiRole: document.querySelector("#whoami-role"),
  tabProfile: document.querySelector("#tab-profile"),
  profileView: document.querySelector("#profile-view"),
  profileStatus: document.querySelector("#profile-status"),
  profileDisplayName: document.querySelector("#profile-display-name"),
  profileUsername: document.querySelector("#profile-username"),
  profileRole: document.querySelector("#profile-role"),
  profileCreated: document.querySelector("#profile-created"),
  profileCurrentPassword: document.querySelector("#profile-current-password"),
  profileNewPassword: document.querySelector("#profile-new-password"),
  profileConfirmPassword: document.querySelector("#profile-confirm-password"),
  profileSave: document.querySelector("#profile-save"),
  profilePasswordSave: document.querySelector("#profile-password-save"),
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
  categoryFilter: document.querySelector("#category-filter"),
  sourceFilter: document.querySelector("#source-filter"),
  sortOrder: document.querySelector("#sort-order"),
  bulkBar: document.querySelector("#bulk-bar"),
  bulkCount: document.querySelector("#bulk-count"),
  bulkShow: document.querySelector("#bulk-show"),
  bulkHide: document.querySelector("#bulk-hide"),
  bulkCategory: document.querySelector("#bulk-category"),
  bulkApplyCategory: document.querySelector("#bulk-apply-category"),
  bulkClear: document.querySelector("#bulk-clear"),
  itemList: document.querySelector("#item-list"),
  editorTitle: document.querySelector("#editor-title"),
  editorMode: document.querySelector("#editor-mode"),
  form: document.querySelector("#item-form"),
  itemId: document.querySelector("#item-id"),
  category: document.querySelector("#category-input"),
  itemStatus: document.querySelector("#item-status"),
  itemScheduledAt: document.querySelector("#item-scheduled-at"),
  headline: document.querySelector("#headline-input"),
  headlineSimilarWarning: document.querySelector("#headline-similar-warning"),
  blurb: document.querySelector("#blurb-input"),
  tags: document.querySelector("#tags-input"),
  aiHeadlineBtn: document.querySelector("#ai-headline-btn"),
  aiCategoryBtn: document.querySelector("#ai-category-btn"),
  aiBlurbBtn: document.querySelector("#ai-blurb-btn"),
  aiTagsBtn: document.querySelector("#ai-tags-btn"),
  aiDupesBtn: document.querySelector("#ai-dupes-btn"),
  aiDupesWarning: document.querySelector("#ai-dupes-warning"),
  aiBlurbNote: document.querySelector("#ai-blurb-note"),
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
  tabSources: document.querySelector("#tab-sources"),
  tabCategories: document.querySelector("#tab-categories"),
  tabOps: document.querySelector("#tab-ops"),
  tabAnalytics: document.querySelector("#tab-analytics"),
  tabNewsletter: document.querySelector("#tab-newsletter"),
  tabSponsors: document.querySelector("#tab-sponsors"),
  tabDashboard: document.querySelector("#tab-dashboard"),
  publishView: document.querySelector("#publish-view"),
  liveView: document.querySelector("#live-view"),
  sourcesView: document.querySelector("#sources-view"),
  categoriesView: document.querySelector("#categories-view"),
  categoriesCount: document.querySelector("#categories-count"),
  categoriesUsedCount: document.querySelector("#categories-used-count"),
  categoriesListCount: document.querySelector("#categories-list-count"),
  categoriesBody: document.querySelector("#categories-body"),
  categoryAddForm: document.querySelector("#category-add-form"),
  categoryNameInput: document.querySelector("#category-name-input"),
  categoryPatternInput: document.querySelector("#category-pattern-input"),
  sourcesBody: document.querySelector("#sources-body"),
  sourcesCount: document.querySelector("#sources-count"),
  sourcesCountDetail: document.querySelector("#sources-count-detail"),
  sourcesHiddenCount: document.querySelector("#sources-hidden-count"),
  sourcesHiddenDetail: document.querySelector("#sources-hidden-detail"),
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
  trafficTotal: document.querySelector("#traffic-total"),
  trafficBreakdown: document.querySelector("#traffic-breakdown"),
  botTotal: document.querySelector("#bot-total"),
  botBreakdown: document.querySelector("#bot-breakdown"),
  eventsTotal: document.querySelector("#publishing-events-total"),
  eventsBody: document.querySelector("#publishing-events-body"),
  otherEventsTotal: document.querySelector("#other-events-total"),
  otherEventsBody: document.querySelector("#other-events-body"),
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
  analyticsCountries: document.querySelector("#analytics-countries"),
  analyticsCountriesTotal: document.querySelector("#analytics-countries-total"),
  analyticsReferrers: document.querySelector("#analytics-referrers"),
  analyticsReferrersTotal: document.querySelector("#analytics-referrers-total"),
  analyticsPages: document.querySelector("#analytics-pages"),
  analyticsPagesTotal: document.querySelector("#analytics-pages-total"),
  analyticsDevices: document.querySelector("#analytics-devices"),
  analyticsDevicesTotal: document.querySelector("#analytics-devices-total"),
  newsletterStatus: document.querySelector("#newsletter-status"),
  newsletterForm: document.querySelector("#newsletter-form"),
  newsletterTitle: document.querySelector("#newsletter-title"),
  newsletterBlurb: document.querySelector("#newsletter-blurb"),
  newsletterUrl: document.querySelector("#newsletter-url"),
  newsletterImage: document.querySelector("#newsletter-image"),
  newsletterSave: document.querySelector("#newsletter-save"),
  newsletterUpdateNow: document.querySelector("#newsletter-update-now"),
  newsletterReload: document.querySelector("#newsletter-reload"),
  newsletterPreview: document.querySelector("#newsletter-preview"),
  newsletterPreviewStatus: document.querySelector("#newsletter-preview-status"),
  previewNewsletterImageLink: document.querySelector("#preview-newsletter-image-link"),
  previewNewsletterImage: document.querySelector("#preview-newsletter-image"),
  previewNewsletterTitle: document.querySelector("#preview-newsletter-title"),
  previewNewsletterBlurb: document.querySelector("#preview-newsletter-blurb"),
  previewNewsletterReadLink: document.querySelector("#preview-newsletter-read-link"),
  newsletterReadbackStatus: document.querySelector("#newsletter-readback-status"),
  newsletterReadbackOutput: document.querySelector("#newsletter-readback-output"),
  sponsorsList: document.querySelector("#sponsors-list"),
  sponsorAdd: document.querySelector("#sponsor-add"),
  sponsorsSave: document.querySelector("#sponsors-save"),
  sponsorsCount: document.querySelector("#sponsors-count"),
  sponsorsSaveStatus: document.querySelector("#sponsors-save-status"),
  sponsorsReadbackStatus: document.querySelector("#sponsors-readback-status"),
  sponsorsReadbackOutput: document.querySelector("#sponsors-readback-output"),
  liveEditOverlay: document.querySelector("#live-edit-overlay"),
  liveEditTitle: document.querySelector("#live-edit-title"),
  liveEditMode: document.querySelector("#live-edit-mode"),
  liveEditMeta: document.querySelector("#live-edit-meta"),
  liveEditClose: document.querySelector("#live-edit-close"),
  liveEditForm: document.querySelector("#live-edit-form"),
  liveEditId: document.querySelector("#live-edit-id"),
  liveEditCategory: document.querySelector("#live-edit-category"),
  liveEditHeadline: document.querySelector("#live-edit-headline"),
  liveEditBlurb: document.querySelector("#live-edit-blurb"),
  liveEditSourceName: document.querySelector("#live-edit-source-name"),
  liveEditSourceUrl: document.querySelector("#live-edit-source-url"),
  liveEditPublishedAt: document.querySelector("#live-edit-published-at"),
  liveEditScheduledAt: document.querySelector("#live-edit-scheduled-at"),
  liveEditStatusSelect: document.querySelector("#live-edit-status-select"),
  liveEditTags: document.querySelector("#live-edit-tags"),
  liveEditStatus: document.querySelector("#live-edit-status"),
  liveEditHistory: document.querySelector("#live-edit-history"),
  liveEditHistoryStatus: document.querySelector("#live-edit-history-status"),
  liveEditSave: document.querySelector("#live-edit-save"),
  liveEditRemove: document.querySelector("#live-edit-remove"),
  liveEditCancel: document.querySelector("#live-edit-cancel"),
  liveEditReadbackStatus: document.querySelector("#live-edit-readback-status"),
  liveEditReadbackOutput: document.querySelector("#live-edit-readback-output")
};

function newsletterImageProxyUrl(value) {
  try {
    const url = new URL(String(value || "").trim(), window.location.origin);
    if (url.protocol !== "https:") return "";
    if (!["substackcdn.com", "substack-post-media.s3.amazonaws.com"].includes(url.hostname)) return url.href;
    return `/api/newsletter-image?src=${encodeURIComponent(url.href)}`;
  } catch {
    return "";
  }
}

function switchTab(name) {
  const publish = name === "publish";
  const live = name === "live";
  const sources = name === "sources";
  const categories = name === "categories";
  const ops = name === "ops";
  const analytics = name === "analytics";
  const newsletter = name === "newsletter";
  const sponsors = name === "sponsors";
  const dashboard = name === "dashboard";
  const profile = name === "profile";
  els.publishView.hidden = !publish;
  els.liveView.hidden = !live;
  els.sourcesView.hidden = !sources;
  els.categoriesView.hidden = !categories;
  els.opsView.hidden = !ops;
  els.analyticsView.hidden = !analytics;
  els.newsletterView.hidden = !newsletter;
  els.sponsorsView.hidden = !sponsors;
  els.dashboardView.hidden = !dashboard;
  els.profileView.hidden = !profile;
  els.tabPublish.classList.toggle("active", publish);
  els.tabLive.classList.toggle("active", live);
  els.tabSources.classList.toggle("active", sources);
  els.tabCategories.classList.toggle("active", categories);
  els.tabOps.classList.toggle("active", ops);
  els.tabAnalytics.classList.toggle("active", analytics);
  els.tabNewsletter.classList.toggle("active", newsletter);
  els.tabSponsors.classList.toggle("active", sponsors);
  els.tabDashboard.classList.toggle("active", dashboard);

  const pageTitles = {
    publish: ["Publish", "Create and manage bulletin items"],
    live: ["Live Items", "Browse and search published items"],
    sources: ["Sources", "Where each item came from, who posted it and when"],
    categories: ["Categories", "Create, rename, delete and manage categories"],
    ops: ["Ingest Log", "Automation and manual runs"],
    analytics: ["Analytics", "Traffic and engagement"],
    newsletter: ["Newsletter", "Homepage latest-post card"],
    sponsors: ["Sponsors", "Sponsor blurbs and placements"],
    dashboard: ["Dashboard", "Deploys, traffic and operational health"],
    profile: ["Profile", "Account settings"]
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
      const shownName = payload.display_name || payload.username || "";
      state.currentUser = shownName;
      els.whoami.textContent = shownName;
      els.whoami.hidden = false;
      els.whoamiAvatar.textContent = (shownName || "?").charAt(0).toUpperCase();
      els.whoamiAvatar.hidden = false;
      if (payload.role) els.whoamiRole.textContent = payload.role;
      els.authPanel.hidden = true;
      loadItems();
      startNewItem();
      loadOps();
      loadAnalytics();
      loadSiteContent();
      loadDashboard();
      loadProfile();
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
// ---------------------------------------------------------------------------
// AI assist (Qwen via /api/ai-assist). Advisory only; every result is
// inserted into the form for Sai/Jon to review before saving.
// ---------------------------------------------------------------------------

async function runAiAssist(action, payload) {
  const response = await fetch("/api/ai-assist", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ action, ...payload })
  });
  if (response.status === 401) throw new Error("Session expired, sign in again.");
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `AI assist returned ${response.status}`);
  }
  return response.json();
}

function setAiButtonBusy(button, busy, label) {
  if (!button) return;
  if (busy) {
    button.dataset.originalLabel = label || button.textContent;
    button.textContent = "…";
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalLabel || button.textContent;
    button.disabled = false;
  }
}

function aiError(button, message) {
  setAiButtonBusy(button, false);
  console.error("AI assist:", message);
  const warning = els.aiDupesWarning;
  if (warning) {
    warning.textContent = `AI assist error: ${message}`;
    warning.hidden = false;
  }
}

function wireAiAssist() {
  // Suggest headline from the blurb.
  els.aiHeadlineBtn?.addEventListener("click", async () => {
    const blurb = (els.blurb.value || "").trim();
    if (!blurb) return;
    setAiButtonBusy(els.aiHeadlineBtn, true);
    try {
      const data = await runAiAssist("suggest_headline", { blurb });
      if (data.result) els.headline.value = data.result;
    } catch (error) {
      aiError(els.aiHeadlineBtn, error.message);
    } finally {
      setAiButtonBusy(els.aiHeadlineBtn, false);
    }
  });

  // Suggest category from the blurb.
  els.aiCategoryBtn?.addEventListener("click", async () => {
    const blurb = (els.blurb.value || "").trim();
    if (!blurb) return;
    setAiButtonBusy(els.aiCategoryBtn, true);
    try {
      const data = await runAiAssist("suggest_category", { blurb, headline: els.headline.value });
      if (data.result) els.category.value = data.result;
    } catch (error) {
      aiError(els.aiCategoryBtn, error.message);
    } finally {
      setAiButtonBusy(els.aiCategoryBtn, false);
    }
  });

  // Tighten the blurb.
  els.aiBlurbBtn?.addEventListener("click", async () => {
    const blurb = (els.blurb.value || "").trim();
    if (!blurb) return;
    setAiButtonBusy(els.aiBlurbBtn, true);
    try {
      const data = await runAiAssist("tighten_blurb", { blurb });
      if (data.result) {
        els.blurb.value = data.result;
        if (els.aiBlurbNote) {
          els.aiBlurbNote.innerHTML = "<strong>Tightened.</strong> Review before saving.";
          els.aiBlurbNote.hidden = false;
        }
      }
    } catch (error) {
      aiError(els.aiBlurbBtn, error.message);
    } finally {
      setAiButtonBusy(els.aiBlurbBtn, false);
    }
  });

  // Suggest tags from the blurb.
  els.aiTagsBtn?.addEventListener("click", async () => {
    const blurb = (els.blurb.value || "").trim();
    if (!blurb) return;
    setAiButtonBusy(els.aiTagsBtn, true);
    try {
      const data = await runAiAssist("suggest_tags", { blurb, headline: els.headline.value });
      if (Array.isArray(data.tags) && data.tags.length) {
        els.tags.value = data.tags.join(", ");
      }
    } catch (error) {
      aiError(els.aiTagsBtn, error.message);
    } finally {
      setAiButtonBusy(els.aiTagsBtn, false);
    }
  });

  // Semantic duplicate check against the bulletin.
  els.aiDupesBtn?.addEventListener("click", async () => {
    const blurb = (els.blurb.value || "").trim();
    const headline = (els.headline.value || "").trim();
    if (!blurb && !headline) return;
    setAiButtonBusy(els.aiDupesBtn, true);
    try {
      const data = await runAiAssist("check_duplicates", { blurb, headline, sourceUrl: els.sourceUrl.value });
      const matches = Array.isArray(data.matches) ? data.matches : [];
      if (els.aiDupesWarning) {
        if (!matches.length) {
          els.aiDupesWarning.textContent = `No same-story matches found across ${data.checked ?? 0} recent items.`;
          els.aiDupesWarning.classList.add("ok");
        } else {
          const lines = matches.map((m) => `"${m.headline}" (${m.source_name || "?"}, id ${m.id})`).join(" | ");
          els.aiDupesWarning.textContent = `Possible same story (${matches.length}): ${lines}`;
          els.aiDupesWarning.classList.remove("ok");
        }
        els.aiDupesWarning.hidden = false;
      }
    } catch (error) {
      aiError(els.aiDupesBtn, error.message);
    } finally {
      setAiButtonBusy(els.aiDupesBtn, false);
    }
  });
}

wireAiAssist();

els.tabSources.addEventListener("click", () => {
  switchTab("sources");
  loadSources();
});
els.tabCategories.addEventListener("click", () => {
  switchTab("categories");
  loadCategories();
});
els.tabDashboard.addEventListener("click", () => switchTab("dashboard"));
els.tabProfile.addEventListener("click", () => switchTab("profile"));
els.tabOps.addEventListener("click", () => switchTab("ops"));
els.tabAnalytics.addEventListener("click", () => switchTab("analytics"));
els.tabNewsletter.addEventListener("click", () => switchTab("newsletter"));
els.tabSponsors.addEventListener("click", () => switchTab("sponsors"));

els.newsletterForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveNewsletter();
});
els.categoryAddForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = els.categoryNameInput.value.trim();
  const pattern = els.categoryPatternInput.value.trim();
  if (!name) return;
  createCategory(name, pattern).then(() => {
    els.categoryNameInput.value = "";
    els.categoryPatternInput.value = "";
  });
});
els.newsletterReload.addEventListener("click", loadLatestSubstackPost);
els.newsletterUpdateNow.addEventListener("click", updateNewsletterNow);
els.sponsorAdd.addEventListener("click", () => {
  state.sponsors.push({ name: "", blurb: "", url: "", logo: "", enabled: false });
  renderSponsors();
});
els.sponsorsSave.addEventListener("click", saveSponsors);
els.profileSave.addEventListener("click", saveProfile);
els.profilePasswordSave.addEventListener("click", changePassword);

els.refreshButton.addEventListener("click", () => {
  loadItems();
  loadOps();
  loadAnalytics();
  loadDashboard();
});

const mobileRefreshButton = document.querySelector("#mobile-refresh-button");
const mobileNewButton = document.querySelector("#mobile-new-button");

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
els.analyticsWindowSelect.addEventListener("change", () => loadAnalytics());
els.dashboardWindow.addEventListener("change", () => loadDashboard());
els.searchInput.addEventListener("input", filterItems);
els.categoryFilter.addEventListener("change", () => {
  state.category = els.categoryFilter.value;
  filterItems();
});
els.sourceFilter?.addEventListener("change", () => {
  state.source = els.sourceFilter.value;
  filterItems();
});
els.sortOrder?.addEventListener("change", () => {
  state.sort = els.sortOrder.value;
  filterItems();
});
els.bulkShow?.addEventListener("click", () => bulkUpdate({ status: "published" }));
els.bulkHide?.addEventListener("click", () => bulkUpdate({ status: "hidden" }));
els.bulkClear?.addEventListener("click", clearBulkSelection);
els.bulkCategory?.addEventListener("change", () => {
  if (els.bulkApplyCategory) els.bulkApplyCategory.disabled = !els.bulkCategory.value;
});
els.bulkApplyCategory?.addEventListener("click", () => {
  if (els.bulkCategory && els.bulkCategory.value) {
    bulkUpdate({ category: els.bulkCategory.value });
  }
});
els.blurb.addEventListener("input", maybeAutoFillCategory);
els.headline.addEventListener("input", maybeAutoFillCategory);
els.sourceName.addEventListener("input", maybeAutoFillCategory);
els.headline.addEventListener("input", checkSimilarHeadline);
els.blurb.addEventListener("input", checkSimilarHeadline);
els.headline.addEventListener("input", checkStoryMatch);
els.blurb.addEventListener("input", checkStoryMatch);
els.sourceUrl.addEventListener("input", maybeAutoFillSourceName);
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

  await mutateItem("DELETE", { id: String(state.selected.id) }, "Removed");
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
  payload.id = String(state.selected.id);
  await mutateItem("PATCH", payload, "Saved");
});

els.liveEditClose.addEventListener("click", closeLiveEditor);
els.liveEditCancel.addEventListener("click", closeLiveEditor);
els.liveEditForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveLiveEditor();
});
els.liveEditRemove.addEventListener("click", removeLiveEditor);
els.liveEditOverlay.addEventListener("click", (event) => {
  if (event.target === els.liveEditOverlay) closeLiveEditor();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !els.liveEditOverlay.hidden) {
    closeLiveEditor();
    return;
  }

  // Global shortcuts are disabled while the user is typing in a field,
  // except Ctrl/Cmd+S (save) and Escape.
  const target = event.target;
  const typing =
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target?.isContentEditable;

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    if (!els.liveEditOverlay.hidden && els.liveEditForm) {
      els.liveEditForm.requestSubmit();
    } else if (els.form) {
      els.form.requestSubmit();
    }
    return;
  }

  if (typing) return;

  if (event.key === "/") {
    event.preventDefault();
    els.searchInput?.focus();
    return;
  }

  if (event.key === "j" || event.key === "k") {
    const rows = [...document.querySelectorAll(".item-row")];
    if (!rows.length) return;
    event.preventDefault();
    const current = document.activeElement instanceof HTMLElement ? rows.indexOf(document.activeElement) : -1;
    let next = current;
    if (event.key === "j") next = current + 1 >= rows.length ? current : current + 1;
    else next = current - 1 < 0 ? (current === -1 ? rows.length - 1 : current) : current - 1;
    if (next === -1) next = 0;
    rows[next].focus();
    rows[next].scrollIntoView({ block: "nearest" });
  }
});

let loadCount = 0;
function beginLoad() {
  loadCount += 1;
  if (els.loadBar) els.loadBar.hidden = false;
}
function endLoad() {
  loadCount = Math.max(0, loadCount - 1);
  if (els.loadBar && loadCount === 0) els.loadBar.hidden = true;
}

async function loadItems() {
  beginLoad();
  setStatus("Loading", "Fetching live D1 items");

  try {
    // Load only the latest batch on first paint so the page renders
    // instantly instead of paging through the whole archive first.
    const pageSize = 50;
    const response = await fetch(`/api/items?status=all&limit=${pageSize}&offset=0&_=${Date.now()}`, {
      headers: { accept: "application/json", "cache-control": "no-cache" }
    });
    if (response.status === 401) {
      throw new Error("Admin session expired, sign in again.");
    }
    if (!response.ok) throw new Error(`/api/items returned ${response.status}`);
    const payload = await response.json();
    const allItems = Array.isArray(payload.items) ? payload.items : [];

    state.items = allItems;
    populateCategoryFilter();
    filterItems();
    setStatus("Ready", `Loaded ${allItems.length} items`);
  } catch (error) {
    setStatus("Error", error.message);
  } finally {
    endLoad();
  }
}

async function loadSources() {
  beginLoad();
  try {
    const pageSize = 500;
    const allItems = [];
    let offset = 0;
    for (;;) {
      const response = await fetch(`/api/items?status=all&limit=${pageSize}&offset=${offset}&_=${Date.now()}`, {
        headers: { accept: "application/json", "cache-control": "no-cache" },
        credentials: "same-origin"
      });
      if (response.status === 401) throw new Error("Session expired, sign in again.");
      if (!response.ok) throw new Error(`/api/items returned ${response.status}`);
      const payload = await response.json();
      const page = Array.isArray(payload.items) ? payload.items : [];
      allItems.push(...page);
      const total = payload.total != null ? payload.total : allItems.length;
      if (!page.length || allItems.length >= total) break;
      offset += pageSize;
    }
    renderSources(allItems);
  } catch (error) {
    els.sourcesCount.textContent = "Error";
    els.sourcesCountDetail.textContent = error.message;
  } finally {
    endLoad();
  }
}

const POSTER_LABELS = {
  telegram_rapid_transit: "Rapid Transit",
  telegram_backup_bot: "Backup bot",
  daily_news_automation: "Daily News Automation",
  "": "Not recorded"
};

function displayPoster(value) {
  const v = String(value || "").trim();
  if (!v) return "Not recorded";
  return POSTER_LABELS[v] || v;
}

function displayVia(value) {
  const v = String(value || "").trim();
  if (!v) return "-";
  return POSTER_LABELS[v] || v;
}

function renderSources(items) {
  els.sourcesBody.replaceChildren();
  const total = items.length;
  const hidden = items.filter((item) => item.status === "hidden").length;
  els.sourcesCount.textContent = String(total);
  els.sourcesCountDetail.textContent = `${hidden} hidden`;
  els.sourcesHiddenCount.textContent = String(hidden);
  els.sourcesHiddenDetail.textContent = `${total - hidden} visible`;

  if (!total) {
    els.sourcesBody.append(emptyTableRow(7, "No items tracked yet."));
    return;
  }

  for (const item of items) {
    const tr = document.createElement("tr");
    tr.className = item.status === "hidden" ? "item-row item-row-hidden" : "item-row";
    tr.append(cell(String(item.id), "nowrap id-cell", "ID"));
    tr.append(cell(item.headline || item.title || firstWords(item.blurb, 12), "truncate", "Title"));
    tr.append(cell(item.source_name || "-", "truncate", "Source"));
    tr.append(cell(displayPoster(item.posted_by), "", "Posted by"));
    tr.append(cell(displayVia(item.posted_via), "", "Via"));
    tr.append(cell(formatDateTime(item.published_at || item.created_at), "nowrap", "When"));
    tr.append(cell(item.status === "hidden" ? "Hidden" : "Published", item.status === "hidden" ? "status-error" : "status-ok", "Status"));
    els.sourcesBody.append(tr);
  }
}

async function loadCategories() {
  beginLoad();
  try {
    const response = await fetch(`/api/admin/categories?_=${Date.now()}`, {
      headers: { accept: "application/json", "cache-control": "no-cache" },
      credentials: "same-origin"
    });
    if (response.status === 401) throw new Error("Session expired, sign in again.");
    if (!response.ok) throw new Error(`/api/admin/categories returned ${response.status}`);
    const payload = await response.json();
    const categories = Array.isArray(payload.categories) ? payload.categories : [];
    renderCategories(categories);
  } catch (error) {
    els.categoriesCount.textContent = "Error";
    els.categoriesListCount.textContent = error.message;
  } finally {
    endLoad();
  }
}

function renderCategories(categories) {
  els.categoriesBody.replaceChildren();
  els.categoriesCount.textContent = String(categories.length);
  els.categoriesUsedCount.textContent = String(categories.filter((cat) => cat.count > 0).length);
  els.categoriesListCount.textContent = `${categories.length} total`;

  if (!categories.length) {
    els.categoriesBody.append(emptyTableRow(5, "No categories found."));
    return;
  }

  for (const cat of categories) {
    const tr = document.createElement("tr");
    tr.append(cell(cat.name, "truncate", "Name"));
    tr.append(cell(String(cat.count), "", "Items"));
    tr.append(cell(cat.pattern || "—", "truncate pattern-cell", "Pattern"));
    tr.append(cell(cat.legacy ? "Legacy" : "Main", cat.legacy ? "status-error" : "status-ok", "Type"));

    const actions = document.createElement("td");
    actions.className = "nowrap";
    actions.dataset.label = "Actions";

    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.className = "btn btn-ghost";
    renameBtn.textContent = "Rename";
    renameBtn.style.padding = "4px 8px";
    renameBtn.style.fontSize = "12px";
    renameBtn.addEventListener("click", () => renameCategory(cat));
    actions.append(renameBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn btn-danger";
    deleteBtn.textContent = "Delete";
    deleteBtn.style.padding = "4px 8px";
    deleteBtn.style.fontSize = "12px";
    deleteBtn.addEventListener("click", () => deleteCategory(cat));
    actions.append(deleteBtn);

    tr.append(actions);
    els.categoriesBody.append(tr);
  }
}

async function createCategory(name, pattern) {
  try {
    const response = await fetch("/api/admin/categories", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ name, pattern })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `POST returned ${response.status}`);
    await loadCategories();
  } catch (error) {
    setStatus("Error", `Create category failed: ${error.message}`);
  }
}

async function renameCategory(cat) {
  const newName = window.prompt(`Rename "${cat.name}" to:`, cat.name);
  if (newName === null) return;
  const cleanName = newName.trim();
  if (!cleanName || cleanName === cat.name) return;

  try {
    const response = await fetch("/api/admin/categories", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ name: cat.name, newName: cleanName })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `PATCH returned ${response.status}`);
    setStatus("Saved", `Category renamed to ${cleanName}. Items updated.`);
    await loadCategories();
    await loadItems();
  } catch (error) {
    setStatus("Error", `Rename failed: ${error.message}`);
  }
}

async function deleteCategory(cat) {
  if (cat.count > 0) {
    const reassign = window.prompt(
      `"${cat.name}" is on ${cat.count} live item(s). Enter the category to reassign them to, or leave blank to use "Other news":`,
      "Other news"
    );
    if (reassign === null) return;
    const target = reassign.trim() || "Other news";
    const confirmed = window.confirm(`Delete "${cat.name}" and move its ${cat.count} item(s) to "${target}"?`);
    if (!confirmed) return;
    try {
      const response = await fetch("/api/admin/categories", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ name: cat.name, reassignTo: target })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `DELETE returned ${response.status}`);
      setStatus("Saved", `Category "${cat.name}" deleted. Items moved to "${target}".`);
      await loadCategories();
      await loadItems();
    } catch (error) {
      setStatus("Error", `Delete failed: ${error.message}`);
    }
    return;
  }

  const confirmed = window.confirm(`Delete category "${cat.name}"?`);
  if (!confirmed) return;
  try {
    const response = await fetch("/api/admin/categories", {
      method: "DELETE",
      credentials: "same-origin",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ name: cat.name, reassignTo: "Other news" })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `DELETE returned ${response.status}`);
    setStatus("Saved", `Category "${cat.name}" deleted.`);
    await loadCategories();
    await loadItems();
  } catch (error) {
    setStatus("Error", `Delete failed: ${error.message}`);
  }
}

async function loadOps() {
  beginLoad();
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
  } finally {
    endLoad();
  }
}

async function loadAnalytics() {
  beginLoad();
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
  } finally {
    endLoad();
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
  if (els.analyticsSince) els.analyticsSince.textContent = firstDate ? firstDate.date : "-";
  if (els.analyticsSinceDetail) els.analyticsSinceDetail.textContent = lastDate ? `through ${lastDate}` : "No traffic yet";

  els.analyticsDays.textContent = `${daily.length} days shown`;
  els.analyticsBreakdown.replaceChildren();

  const breakdowns = payload.breakdowns || {};
  const countries = {};
  for (const [code, count] of Object.entries(breakdowns.countries || {})) {
    countries[COUNTRY_NAMES[code] || code] = count;
  }
  renderAnalyticsBreakdown(countries, els.analyticsCountries, els.analyticsCountriesTotal);
  renderAnalyticsBreakdown(breakdowns.referrers, els.analyticsReferrers, els.analyticsReferrersTotal);

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
  beginLoad();
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
      endLoad();
      return;
    }
    if (!response.ok) throw new Error(`Dashboard API returned ${response.status}`);
    const payload = await response.json();
    renderDashboard(payload);
  } catch (error) {
    els.overallStatus.textContent = "Error";
    els.overallDetail.textContent = error.message;
  } finally {
    endLoad();
  }
}

function renderDashboard(payload) {
  const status = payload.status || {};
  const traffic = payload.traffic || {};
  const operations = payload.operations || {};
  const items = payload.items || {};

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

  els.trafficTotal.textContent = `${formatNumber(traffic.totals?.total || 0)} hits`;
  els.botTotal.textContent = `${formatNumber(traffic.totals?.total || 0)} hits`;
  els.eventsTotal.textContent = `${formatNumber(operations.publishing?.length || 0)} shown`;
  els.otherEventsTotal.textContent = `${formatNumber(operations.other?.length || 0)} shown`;
  els.logsTotal.textContent = `${formatNumber(traffic.logs?.length || 0)} shown`;

  renderBreakdown(els.trafficBreakdown, traffic.totals?.byPath || {});
  renderBreakdown(els.botBreakdown, traffic.totals?.byBot || {});
  renderEvents(operations.publishing || [], els.eventsBody);
  renderEvents(operations.other || [], els.otherEventsBody);
  renderLogs(traffic.logs || []);
}

function renderBreakdown(target, values, emptyMessage = "No hits in this window.") {
  target.replaceChildren();
  const entries = Object.entries(values).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const max = Math.max(...entries.map(([, count]) => count), 1);

  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = emptyMessage;
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

function renderEvents(events, body) {
  body.replaceChildren();
  if (!events.length) {
    body.append(emptyTableRow(8, "No events in this window."));
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
    body.append(tr);
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

const COUNTRY_NAMES = {
  IN: "India", TH: "Thailand", US: "United States", GB: "United Kingdom", SG: "Singapore",
  JP: "Japan", CN: "China", KR: "South Korea", ID: "Indonesia", MY: "Malaysia",
  PH: "Philippines", VN: "Vietnam", TW: "Taiwan", HK: "Hong Kong", AU: "Australia",
  DE: "Germany", FR: "France", NL: "Netherlands", AE: "UAE", SA: "Saudi Arabia",
  CA: "Canada", BR: "Brazil", MX: "Mexico", NZ: "New Zealand", PK: "Pakistan",
  BD: "Bangladesh", LK: "Sri Lanka", MM: "Myanmar", KH: "Cambodia", LA: "Laos"
};

function renderAnalyticsBreakdown(values, target, countEl) {
  if (!target) return;
  const entries = Object.entries(values || {});
  countEl.textContent = `${formatNumber(entries.length)} shown`;
  renderBreakdown(target, values || {}, "No data in this window.");
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

async function loadProfile() {
  beginLoad();
  try {
    const response = await fetch("/api/auth/profile", { credentials: "same-origin" });
    if (!response.ok) throw new Error(`Profile API returned ${response.status}`);
    const payload = await response.json();
    els.profileUsername.value = payload.username || "";
    els.profileRole.value = payload.role || "";
    els.profileCreated.value = formatDateOnly(payload.created_at);
    els.profileDisplayName.value = payload.display_name || "";
    els.profileStatus.textContent = "Loaded";
    if (payload.role) els.whoamiRole.textContent = payload.role;
  } catch (error) {
    els.profileStatus.textContent = "Error";
    els.profileStatus.title = error.message;
  } finally {
    endLoad();
  }
}

async function saveProfile() {
  const displayName = els.profileDisplayName.value.trim();
  els.profileStatus.textContent = "Saving";
  try {
    const response = await fetch("/api/auth/profile", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ displayName })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `PATCH returned ${response.status}`);
    const shownName = displayName || els.profileUsername.value || "";
    els.whoami.textContent = shownName;
    els.whoamiAvatar.textContent = (shownName || "?").charAt(0).toUpperCase();
    els.whoamiAvatar.hidden = false;
    els.profileStatus.textContent = "Saved";
  } catch (error) {
    els.profileStatus.textContent = "Error";
    els.profileStatus.title = error.message;
  }
}

async function changePassword() {
  const currentPassword = els.profileCurrentPassword.value;
  const newPassword = els.profileNewPassword.value;
  const confirm = els.profileConfirmPassword.value;
  if (newPassword.length < 8) {
    els.profileStatus.textContent = "8+ chars";
    els.profileStatus.title = "New password must be at least 8 characters.";
    return;
  }
  if (newPassword !== confirm) {
    els.profileStatus.textContent = "Mismatch";
    els.profileStatus.title = "New passwords do not match.";
    return;
  }
  els.profileStatus.textContent = "Saving";
  try {
    const response = await fetch("/api/auth/profile", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `PATCH returned ${response.status}`);
    els.profileCurrentPassword.value = "";
    els.profileNewPassword.value = "";
    els.profileConfirmPassword.value = "";
    els.profileStatus.textContent = "Password updated";
  } catch (error) {
    els.profileStatus.textContent = "Error";
    els.profileStatus.title = error.message;
  }
}

function formatDateOnly(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function cell(value, className = "", label = "") {
  const td = document.createElement("td");
  td.textContent = value;
  if (className) td.className = className;
  if (label) td.dataset.label = label;
  return td;
}

function filterItems() {
  state.page = 1;
  const query = els.searchInput.value.trim().toLowerCase();
  const category = state.category;
  const source = state.source;

  state.filtered = state.items.filter((item) => {
    if (category && (item.category || "Other news") !== category) return false;
    if (source && (item.source_name || "") !== source) return false;
    const published = item.published_at ? new Date(item.published_at) : null;
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

  state.filtered.sort(comparatorForSort(state.sort));
  renderList();
  renderCounts();
}

function comparatorForSort(sort) {
  if (sort === "oldest") {
    return (a, b) => (new Date(a.published_at).getTime() || 0) - (new Date(b.published_at).getTime() || 0) || String(a.id).localeCompare(String(b.id));
  }
  if (sort === "category") {
    return (a, b) => (a.category || "Other news").localeCompare(b.category || "Other news") || (new Date(b.published_at).getTime() || 0) - (new Date(a.published_at).getTime() || 0);
  }
  if (sort === "source") {
    return (a, b) => (a.source_name || "").localeCompare(b.source_name || "") || (new Date(b.published_at).getTime() || 0) - (new Date(a.published_at).getTime() || 0);
  }
  return (a, b) => (new Date(b.published_at).getTime() || 0) - (new Date(a.published_at).getTime() || 0) || String(b.id).localeCompare(String(a.id));
}

function populateCategoryFilter() {
  const counts = new Map();
  for (const item of state.items) {
    const cat = item.category || DEFAULT_CATEGORY;
    counts.set(cat, (counts.get(cat) || 0) + 1);
  }

  // Always offer the full canonical category list first (including brand-new
  // categories that no item uses yet), then any legacy categories found on
  // existing items, so every category is reachable from the admin UI.
  const canonical = CATEGORY_RULES.map((rule) => rule.label);
  if (!canonical.includes(DEFAULT_CATEGORY)) canonical.push(DEFAULT_CATEGORY);
  const extras = [...counts.keys()]
    .filter((cat) => !canonical.includes(cat))
    .sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0) || a.localeCompare(b));
  state.categories = [...canonical, ...extras].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  els.categoryFilter.replaceChildren();
  const all = document.createElement("option");
  all.value = "";
  all.textContent = "All categories";
  els.categoryFilter.append(all);
  for (const cat of state.categories) {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = `${cat} (${counts.get(cat) || 0})`;
    els.categoryFilter.append(opt);
  }
  els.categoryFilter.value = state.category;

  // Source filter options, derived from loaded items.
  const sources = new Set();
  for (const item of state.items) {
    if (item.source_name) sources.add(item.source_name);
  }
  els.sourceFilter.replaceChildren();
  const allSources = document.createElement("option");
  allSources.value = "";
  allSources.textContent = "All sources";
  els.sourceFilter.append(allSources);
  for (const name of [...sources].sort((a, b) => a.localeCompare(b))) {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    els.sourceFilter.append(opt);
  }
  els.sourceFilter.value = state.source;
}


/* Exclusive colour per category (mockup palette, Aug 23 2026). Known categories
   get a curated colour; unknown ones get a deterministic hue so every category
   is visually distinct. Applied to the Live Items category select. */
const CATEGORY_COLOURS = {
  "Markets": "#2563eb",
  "AI": "#7c3aed",
  "Cloud": "#0d9488",
  "Transport": "#ea580c",
  "Space": "#0284c7",
  "Robotics": "#db2777",
  "Chips": "#ca8a04",
  "EVs": "#16a34a",
  "Energy": "#d97706",
  "E-commerce": "#9333ea",
  "Hardware": "#475569",
  "Biotech": "#059669",
  "Health": "#e11d48",
  "Earnings": "#22c55e",
  "Policy": "#6366f1",
  "Crypto": "#d97706",
  "Fintech": "#0891b2",
  "Funding": "#3b82f6",
  "Venture Capital": "#8b5cf6",
  "Deals": "#dc2626",
  "Mobility": "#0ea5e9",
  "Cybersecurity": "#4f46e5",
  "Gaming": "#c026d3",
  "Telecommunications": "#14b8a6",
  "Startups": "#84cc16",
  "Apps": "#2563eb",
  "WAIC 2026": "#0d9488",
  "Other news": "#64748b"
};

function categoryColour(name) {
  const key = String(name || "Other news").trim();
  if (CATEGORY_COLOURS[key]) return CATEGORY_COLOURS[key];
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return `hsl(${hash % 360} 65% 45%)`;
}

function styleCategorySelect(select, category) {
  const colour = categoryColour(category);
  select.style.color = colour;
  select.style.backgroundColor = `color-mix(in srgb, ${colour} 12%, transparent)`;
  select.style.borderColor = `color-mix(in srgb, ${colour} 30%, transparent)`;
}

function renderList() {
  els.itemList.replaceChildren();
  const total = state.filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
  state.page = Math.min(Math.max(1, state.page), totalPages);
  const start = (state.page - 1) * ITEMS_PER_PAGE;
  const pageItems = state.filtered.slice(start, start + ITEMS_PER_PAGE);
  els.listCount.textContent = `${total} shown`;

  if (!state.filtered.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No matching items.";
    els.itemList.append(empty);
    renderListPagination(total);
    return;
  }

  const wrap = document.createElement("div");
  wrap.className = "table-wrap";
  const table = document.createElement("table");
  table.className = "item-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const checkTh = document.createElement("th");
  checkTh.className = "select-col";
  const selectAll = document.createElement("input");
  selectAll.type = "checkbox";
  selectAll.className = "row-check select-all-check";
  selectAll.title = "Select all items on this page";
  selectAll.checked = pageItems.length > 0 && pageItems.every((item) => state.selectedIds.has(String(item.id)));
  selectAll.addEventListener("change", () => {
    for (const item of pageItems) {
      if (selectAll.checked) state.selectedIds.add(String(item.id));
      else state.selectedIds.delete(String(item.id));
    }
    renderList();
  });
  checkTh.append(selectAll);
  headRow.append(checkTh);
  for (const label of ["ID", "Title", "Publisher", "Category", "Tags", "Published", "Visible", "Link"]) {
    const th = document.createElement("th");
    th.textContent = label;
    if (label === "ID") th.className = "id-cell";
    headRow.append(th);
  }
  thead.append(headRow);
  table.append(thead);

  const tbody = document.createElement("tbody");
  for (const item of pageItems) {
    const tr = document.createElement("tr");
    tr.className = "item-row" + (item.status === "hidden" ? " item-row-hidden" : "");
    tr.tabIndex = 0;
    const checkTd = document.createElement("td");
    checkTd.className = "select-col";
    const rowCheck = document.createElement("input");
    rowCheck.type = "checkbox";
    rowCheck.className = "row-check";
    rowCheck.checked = state.selectedIds.has(String(item.id));
    rowCheck.title = "Select this item";
    rowCheck.addEventListener("click", (event) => event.stopPropagation());
    rowCheck.addEventListener("change", () => {
      if (rowCheck.checked) state.selectedIds.add(String(item.id));
      else state.selectedIds.delete(String(item.id));
      updateBulkBar();
    });
    checkTd.append(rowCheck);
    tr.append(checkTd);
    tr.addEventListener("click", () => {
      openLiveEditor(item.id);
    });
    tr.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openLiveEditor(item.id);
      }
    });
    tr.append(cell(String(item.id), "nowrap id-cell", "ID"));
    tr.append(titleCell(item));
    tr.append(cell(item.source_name || "Source", "truncate", "Publisher"));

    const catTd = document.createElement("td");
    catTd.dataset.label = "Category";
    const currentCat = item.category || "Other news";

    // Pill view (mockup style). Click to swap in the quick-edit select.
    const buildCatSelect = () => {
      const sel = document.createElement("select");
      sel.className = "input cat-edit";
      styleCategorySelect(sel, currentCat);
      const cats = state.categories.length ? state.categories : [currentCat];
      for (const cat of cats) {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat;
        if (cat === currentCat) opt.selected = true;
        sel.append(opt);
      }
      sel.addEventListener("change", () => saveItemCategory(item, sel.value));
      sel.addEventListener("click", (event) => event.stopPropagation());
      sel.addEventListener("blur", () => {
        if (sel.value === currentCat) catTd.replaceChildren(buildCatPill());
      });
      return sel;
    };

    const buildCatPill = () => {
      const pill = document.createElement("button");
      pill.type = "button";
      pill.className = "cat-pill";
      pill.textContent = currentCat;
      const colour = categoryColour(currentCat);
      pill.style.setProperty("--cat", colour);
      pill.title = "Change category";
      pill.addEventListener("click", (event) => {
        event.stopPropagation();
        const sel = buildCatSelect();
        catTd.replaceChildren(sel);
        sel.focus();
      });
      return pill;
    };

    catTd.append(buildCatPill());
    tr.append(catTd);
    tr.append(tagsIconCell(item.tags));
    tr.append(cell(formatDateTime(item.published_at), "nowrap", "Published"));

    // Visible toggle: iOS-style switch for hide/show on the public site.
    const visTd = document.createElement("td");
    visTd.dataset.label = "Visible";
    if (item.status === "removed") {
      const restoreBtn = document.createElement("button");
      restoreBtn.type = "button";
      restoreBtn.className = "btn btn-ghost btn-sm";
      restoreBtn.textContent = "Restore";
      restoreBtn.title = "Restore this item to published";
      restoreBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        restoreItem(item);
      });
      visTd.append(restoreBtn);
    } else {
      const visible = item.status !== "hidden" && item.status !== "draft";
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "vis-switch" + (visible ? " on" : "");
      toggle.setAttribute("role", "switch");
      toggle.setAttribute("aria-checked", visible ? "true" : "false");
      toggle.title = visible ? "Visible on the public site. Click to hide." : "Hidden from the public site. Click to show.";
      const knob = document.createElement("span");
      knob.className = "vis-switch-knob";
      toggle.append(knob);
      toggle.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleItemVisibility(item);
      });
      visTd.append(toggle);
      if (item.status === "draft") {
        const draftBadge = document.createElement("span");
        draftBadge.className = "status-badge status-badge-draft";
        draftBadge.textContent = item.scheduled_at ? "Scheduled" : "Draft";
        draftBadge.title = item.scheduled_at ? `Publishes ${formatDateTime(item.scheduled_at)}` : "Draft item";
        visTd.append(draftBadge);
      }
    }
    tr.append(visTd);

    const linkUrl = `https://bulletin.asiatechreview.com/?item=${encodeURIComponent(item.link_key || item.id)}`;
    const linkTd = document.createElement("td");
    linkTd.dataset.label = "Link";
    linkTd.className = "truncate";
    const linkA = document.createElement("a");
    linkA.href = linkUrl;
    linkA.target = "_blank";
    linkA.rel = "noopener";
    linkA.textContent = linkUrl;
    linkA.title = linkUrl;
    linkA.addEventListener("click", (event) => event.stopPropagation());
    linkTd.append(linkA);
    tr.append(linkTd);
    tbody.append(tr);
  }
  table.append(tbody);
  wrap.append(table);
  els.itemList.append(wrap);
  renderListPagination(total);
  updateBulkBar();
}

function renderListPagination(total) {
  const wrap = document.querySelector("#item-pagination");
  if (!wrap) return;
  wrap.replaceChildren();
  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
  if (totalPages <= 1) return;

  const prev = document.createElement("button");
  prev.type = "button";
  prev.className = "btn btn-ghost";
  prev.textContent = "Previous";
  prev.disabled = state.page <= 1;
  prev.addEventListener("click", () => {
    state.page -= 1;
    renderList();
  });
  wrap.append(prev);

  const label = document.createElement("span");
  label.className = "pagination-label";
  label.textContent = `Page ${state.page} of ${totalPages}`;
  wrap.append(label);

  const next = document.createElement("button");
  next.type = "button";
  next.className = "btn btn-ghost";
  next.textContent = "Next";
  next.disabled = state.page >= totalPages;
  next.addEventListener("click", () => {
    state.page += 1;
    renderList();
  });
  wrap.append(next);
}

function updateBulkBar() {
  const count = state.selectedIds.size;
  if (els.bulkBar) els.bulkBar.hidden = count === 0;
  if (els.bulkCount) els.bulkCount.textContent = `${count} selected`;
  // The select ships with a "Reassign to…" placeholder option, so options
  // length is 1 before categories are added. Populate whenever we only have
  // the placeholder (or nothing) so the category list always loads.
  if (els.bulkCategory && count > 0 && els.bulkCategory.options.length <= 1) {
    const cats = state.categories.length ? state.categories : [DEFAULT_CATEGORY];
    for (const cat of cats) {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      els.bulkCategory.append(opt);
    }
  }
  if (els.bulkApplyCategory) {
    els.bulkApplyCategory.disabled = !(els.bulkCategory && els.bulkCategory.value);
  }
}

async function bulkUpdate(payload) {
  const ids = [...state.selectedIds];
  if (!ids.length) return;
  setStatus("Saving", `Updating ${ids.length} items`);
  try {
    const response = await fetch("/api/items/batch", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ ids, ...payload })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `batch returned ${response.status}`);
    state.selectedIds.clear();
    setStatus("Saved", `${result.updated} item(s) updated`);
    await loadItems();
  } catch (error) {
    setStatus("Error", error.message);
    await loadItems();
  }
}

function clearBulkSelection() {
  state.selectedIds.clear();
  renderList();
  updateBulkBar();
}

async function saveItemCategory(item, newCategory) {
  const oldCategory = item.category || "Other news";
  if (newCategory === oldCategory) return;
  setStatus("Saving", `Updating category for item ${item.id}`);
  try {
    const response = await fetch("/api/items", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ id: String(item.id), category: newCategory })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `PATCH returned ${response.status}`);
    const updated = result.item;
    if (updated) {
      const idx = state.items.findIndex((candidate) => String(candidate.id) === String(item.id));
      if (idx >= 0) state.items[idx] = { ...state.items[idx], category: updated.category || newCategory };
    } else {
      item.category = newCategory;
    }
    setStatus("Saved", `Category updated for item ${item.id}`);
    filterItems();
  } catch (error) {
    setStatus("Error", error.message);
    filterItems();
  }
}

async function restoreItem(item) {
  setStatus("Saving", `Restoring item ${item.id}`);
  try {
    const response = await fetch("/api/items", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ id: String(item.id), status: "published" })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `PATCH returned ${response.status}`);
    setStatus("Saved", `Item ${item.id} restored to published`);
    await loadItems();
  } catch (error) {
    setStatus("Error", error.message);
    await loadItems();
  }
}

async function toggleItemVisibility(item) {
  const next = item.status === "hidden" ? "published" : "hidden";
  const label = next === "hidden" ? "Hide" : "Show";
  setStatus("Saving", `${label}ing item ${item.id} on the public site`);
  try {
    const response = await fetch("/api/items", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ id: String(item.id), status: next })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `PATCH returned ${response.status}`);
    const updated = result.item;
    const idx = state.items.findIndex((candidate) => String(candidate.id) === String(item.id));
    if (idx >= 0) state.items[idx] = { ...state.items[idx], status: updated?.status || next };
    setStatus("Saved", `Item ${item.id} is now ${updated?.status === "hidden" ? "hidden" : "visible"} on the public site`);
    filterItems();
  } catch (error) {
    setStatus("Error", error.message);
    filterItems();
  }
}

// Title cell with a hover tooltip showing the full blurb, so the operator can
// take a quick look at the story without opening the editor. Mirrors the tag
// tooltip pattern: a wrapper chip that reveals a tooltip on hover. The tooltip
// lives OUTSIDE the chip (sibling of it) because the chip clips with
// overflow:hidden for the ellipsis, which would cut the popup off.
function titleCell(item) {
  const td = document.createElement("td");
  td.dataset.label = "Title";
  td.className = "title-cell";
  const title = item.headline || item.title || firstWords(item.blurb, 12);

  const chip = document.createElement("span");
  chip.className = "title-chip";
  chip.textContent = title;
  td.append(chip);

  const blurb = String(item.blurb || "").trim();
  if (blurb) {
    const tooltip = document.createElement("span");
    tooltip.className = "title-tooltip";
    tooltip.setAttribute("role", "tooltip");
    tooltip.textContent = blurb;
    td.append(tooltip);
  }

  return td;
}

// Render tags as a single small icon that reveals all tags on hover.
// Keeps the row compact regardless of tag count; the tooltip lists every tag.
function tagsIconCell(value) {
  const td = document.createElement("td");
  td.dataset.label = "Tags";
  let tags = value;
  if (typeof tags === "string") {
    const trimmed = tags.trim();
    if (trimmed.startsWith("[")) {
      try {
        tags = JSON.parse(trimmed);
      } catch {
        tags = trimmed.split(",").map((t) => t.trim()).filter(Boolean);
      }
    } else if (trimmed) {
      tags = trimmed.split(",").map((t) => t.trim()).filter(Boolean);
    }
  }
  const list = Array.isArray(tags) ? tags.filter(Boolean) : [];

  const chip = document.createElement("span");
  chip.className = "tags-icon" + (list.length ? "" : " tags-icon-empty");

  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", "2");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.83z");
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", "7");
  line.setAttribute("y1", "7");
  line.setAttribute("x2", "7.01");
  line.setAttribute("y2", "7");
  icon.append(path, line);
  chip.append(icon);

  if (list.length) {
    const count = document.createElement("span");
    count.className = "tags-count";
    count.textContent = String(list.length);
    chip.append(count);
    chip.title = list.join(", ");

    const tooltip = document.createElement("span");
    tooltip.className = "tags-tooltip";
    tooltip.setAttribute("role", "tooltip");
    for (const tag of list) {
      const pill = document.createElement("span");
      pill.className = "tag-pill";
      pill.textContent = tag;
      tooltip.append(pill);
    }
    chip.append(tooltip);
  } else {
    chip.title = "No tags";
  }

  td.append(chip);
  return td;
}

// ---------- Live item editor (custom CMS panel, not the publish form) ----------

function tagsToInput(value) {
  if (!value) return "";
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

function openLiveEditor(id) {
  const item = state.items.find((candidate) => String(candidate.id) === String(id));
  if (!item) return;

  state.selected = item;
  state.mode = "edit";
  els.liveEditTitle.textContent = "Edit Item";
  els.liveEditMode.textContent = item.status === "hidden" ? "Hidden" : "Published";
  els.liveEditMeta.textContent = `${item.source_name || "Source"} · ${item.category || DEFAULT_CATEGORY} · ${formatDateTime(item.published_at)}`;
  fillLiveEditor(item);
  els.liveEditOverlay.hidden = false;
  document.body.classList.add("edit-open");
  els.liveEditHeadline.focus();
}

function fillLiveEditor(item) {
  const numeric = Number(item.id);
  const editable = Number.isInteger(numeric) && numeric > 0;

  els.liveEditId.value = item.id || "";
  els.liveEditHeadline.value = item.headline || item.title || "";
  els.liveEditBlurb.value = item.blurb || "";
  els.liveEditSourceName.value = item.source_name || "";
  els.liveEditSourceUrl.value = item.source_url || "";
  els.liveEditPublishedAt.value = formatDateTime(item.published_at);
  els.liveEditTags.value = tagsToInput(item.tags);
  if (els.liveEditStatusSelect) els.liveEditStatusSelect.value = item.status === "draft" ? "draft" : item.status === "hidden" ? "hidden" : "published";
  if (els.liveEditScheduledAt) els.liveEditScheduledAt.value = item.scheduled_at ? toLocalDateTime(item.scheduled_at) : "";

  const currentCategory = item.category || DEFAULT_CATEGORY;
  const cats = state.categories.length ? state.categories : [currentCategory];
  if (!cats.includes(currentCategory)) cats.unshift(currentCategory);
  const catOptions = document.querySelector("#live-edit-category-options");
  if (catOptions) {
    catOptions.replaceChildren();
    for (const cat of cats) {
      const opt = document.createElement("option");
      opt.value = cat;
      catOptions.append(opt);
    }
  }
  els.liveEditCategory.value = currentCategory;

  const controls = [
    els.liveEditHeadline,
    els.liveEditBlurb,
    els.liveEditSourceName,
    els.liveEditSourceUrl,
    els.liveEditCategory,
    els.liveEditTags
  ];
  controls.forEach((control) => { control.disabled = !editable; });
  els.liveEditSave.disabled = !editable;
  els.liveEditRemove.disabled = !editable;

  els.liveEditStatus.hidden = true;
  if (!editable) {
    els.liveEditStatus.hidden = false;
    els.liveEditStatus.textContent = "Static legacy item — not in the database, cannot be edited here.";
    els.liveEditStatus.className = "edit-status";
  }

  els.liveEditReadbackStatus.textContent = "Loaded";
  els.liveEditReadbackOutput.textContent = JSON.stringify(item, null, 2);
  loadItemHistory(item);
}

function closeLiveEditor() {
  els.liveEditOverlay.hidden = true;
  document.body.classList.remove("edit-open");
  state.selected = null;
}

async function loadItemHistory(item) {
  if (!els.liveEditHistory || !els.liveEditHistoryStatus) return;
  const id = String(item?.id || "");
  if (!id) {
    els.liveEditHistoryStatus.textContent = "No id";
    els.liveEditHistory.replaceChildren();
    return;
  }
  els.liveEditHistoryStatus.textContent = "Loading";
  try {
    const response = await fetch(`/api/items/${encodeURIComponent(id)}/history?_=${Date.now()}`, {
      headers: { accept: "application/json" },
      credentials: "same-origin"
    });
    if (!response.ok) throw new Error(`history returned ${response.status}`);
    const payload = await response.json();
    const events = Array.isArray(payload.events) ? payload.events : [];
    els.liveEditHistoryStatus.textContent = `${events.length} event(s)`;
    els.liveEditHistory.replaceChildren();
    if (!events.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "No edit history yet.";
      els.liveEditHistory.append(empty);
      return;
    }
    for (const event of events) {
      const row = document.createElement("div");
      row.className = "history-event";
      const time = document.createElement("time");
      time.textContent = formatTime(event.occurred_at);
      row.append(time);
      const msg = document.createElement("span");
      msg.className = "history-msg";
      const action = String(event.action || "");
      const label = String(event.details?.actor || "");
      msg.append(`${event.message || ""} `);
      if (label) {
        const actor = document.createElement("strong");
        actor.textContent = label;
        msg.append(actor);
      }
      row.append(msg);
      const act = document.createElement("span");
      act.className = "history-action";
      act.textContent = action;
      row.append(act);
      els.liveEditHistory.append(row);
    }
  } catch (error) {
    els.liveEditHistoryStatus.textContent = "Error";
    els.liveEditHistory.replaceChildren();
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = error.message;
    els.liveEditHistory.append(empty);
  }
}

function setLiveEditStatus(status, message) {
  els.liveEditStatus.hidden = false;
  els.liveEditStatus.textContent = `${status}: ${message}`;
  els.liveEditStatus.className = "edit-status";
  if (status === "Error") els.liveEditStatus.classList.add("status-error");
  if (status === "Saved" || status === "Removed") els.liveEditStatus.classList.add("status-ok");
}

async function saveLiveEditor() {
  if (!state.selected) return;
  const item = state.selected;
  const numeric = Number(item.id);
  const id = Number.isInteger(numeric) && numeric > 0 ? numeric : String(item.id);

  const payload = {
    id,
    headline: els.liveEditHeadline.value.trim(),
    blurb: els.liveEditBlurb.value.trim(),
    sourceName: els.liveEditSourceName.value.trim(),
    sourceUrl: els.liveEditSourceUrl.value.trim(),
    category: els.liveEditCategory.value.trim() || DEFAULT_CATEGORY,
    tags: els.liveEditTags.value.split(",").map((tag) => tag.trim()).filter(Boolean)
  };

  if (els.liveEditStatusSelect) payload.status = els.liveEditStatusSelect.value;
  if (els.liveEditScheduledAt && els.liveEditScheduledAt.value) {
    payload.scheduledAt = fromLocalDateTime(els.liveEditScheduledAt.value);
    if (payload.status === "draft") payload.status = "draft";
  } else if (payload.status === "draft") {
    payload.scheduledAt = null;
  }

  if (!payload.blurb || !payload.sourceName || !payload.sourceUrl || !payload.category) {
    setLiveEditStatus("Missing fields", "Blurb, source, URL and category are required.");
    return;
  }

  setLiveEditStatus("Saving", "PATCH /api/items");
  try {
    const response = await fetch("/api/items", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (response.status === 401) {
      els.authPanel.hidden = false;
      throw new Error("Token rejected.");
    }
    if (!response.ok) throw new Error(result.error || `/api/items returned ${response.status}`);

    const updated = result.item;
    if (updated) {
      const idx = state.items.findIndex((candidate) => String(candidate.id) === String(item.id));
      if (idx >= 0) state.items[idx] = { ...state.items[idx], ...updated };
    }
    setLiveEditStatus("Saved", `Item ${item.id} updated`);
    els.liveEditReadbackStatus.textContent = "Saved";
    els.liveEditReadbackOutput.textContent = JSON.stringify(result, null, 2);
    filterItems();
    setStatus("Saved", `Item ${item.id} updated`);
  } catch (error) {
    setLiveEditStatus("Error", error.message);
    els.liveEditReadbackStatus.textContent = "Error";
    els.liveEditReadbackOutput.textContent = error.message;
  }
}

async function removeLiveEditor() {
  if (!state.selected) return;
  const item = state.selected;
  const numeric = Number(item.id);
  const id = Number.isInteger(numeric) && numeric > 0 ? numeric : String(item.id);

  const ok = window.confirm(`Remove bulletin item ${item.id}? This hides it from the public site, API, RSS and JSON feed.`);
  if (!ok) return;

  setLiveEditStatus("Removing", "DELETE /api/items");
  try {
    const response = await fetch("/api/items", {
      method: "DELETE",
      credentials: "same-origin",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ id })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `DELETE returned ${response.status}`);

    state.items = state.items.filter((candidate) => String(candidate.id) !== String(item.id));
    closeLiveEditor();
    filterItems();
    setStatus("Removed", `Item ${item.id} removed`);
  } catch (error) {
    setLiveEditStatus("Error", error.message);
    els.liveEditReadbackStatus.textContent = "Error";
    els.liveEditReadbackOutput.textContent = error.message;
  }
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
  lastAutoCategory = "";
  lastAutoSourceName = "";
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
  if (els.itemStatus) els.itemStatus.value = item.status === "draft" ? "draft" : item.status === "hidden" ? "hidden" : "published";
  if (els.itemScheduledAt) els.itemScheduledAt.value = item.scheduled_at ? toLocalDateTime(item.scheduled_at) : "";
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

  if (els.tags && els.tags.value.trim()) {
    payload.tags = els.tags.value.split(",").map((tag) => tag.trim()).filter(Boolean);
  }

  // Provenance is grabbed automatically from the session, never typed in.
  // Only set it for new items; edits keep the original provenance.
  if (state.mode === "new") {
    if (state.currentUser) payload.postedBy = state.currentUser;
    payload.postedVia = "Admin";
  }

  if (els.itemStatus && els.itemStatus.value) payload.status = els.itemStatus.value;
  if (els.itemScheduledAt && els.itemScheduledAt.value) {
    payload.scheduledAt = fromLocalDateTime(els.itemScheduledAt.value);
  }

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
  beginLoad();
  try {
    const response = await fetch("/api/site-content", { credentials: "same-origin" });
    if (!response.ok) throw new Error(`/api/site-content returned ${response.status}`);
    const content = await response.json();
    fillNewsletterForm(content.newsletter || {});
    renderNewsletterPreview(content.newsletter || {});
    state.sponsors = Array.isArray(content.sponsors) ? content.sponsors.map((s) => ({ ...s })) : [];
    renderSponsors();
  } catch (error) {
    els.newsletterStatus.textContent = "Error";
    els.newsletterStatus.title = error.message;
  } finally {
    endLoad();
  }
}

function fillNewsletterForm(newsletter) {
  els.newsletterTitle.value = newsletter.title || "";
  els.newsletterBlurb.value = newsletter.blurb || "";
  els.newsletterUrl.value = newsletter.url || "";
  els.newsletterImage.value = newsletter.image || "";
  els.newsletterStatus.textContent = "Loaded";
  renderNewsletterPreview(newsletter);
}

function renderNewsletterPreview(newsletter) {
  const title = newsletter.title || "";
  const url = newsletter.url || "";
  const image = newsletter.image || "";
  const blurb = newsletter.blurb || "";

  els.previewNewsletterTitle.textContent = title || "No card loaded";
  els.previewNewsletterBlurb.textContent = blurb;
  els.previewNewsletterImage.alt = title;
  els.previewNewsletterReadLink.href = url || "#";
  els.previewNewsletterImageLink.href = url || "#";

  const previewEmpty = document.querySelector("#newsletter-preview-empty");
  if (previewEmpty) previewEmpty.hidden = Boolean(title || url || image || blurb);
  if (els.newsletterPreview) els.newsletterPreview.hidden = !(title || url || image || blurb);

  if (image) {
    els.previewNewsletterImage.src = newsletterImageProxyUrl(image) || image;
    els.previewNewsletterImage.hidden = false;
  } else {
    els.previewNewsletterImage.removeAttribute("src");
    els.previewNewsletterImage.hidden = true;
  }

  els.newsletterPreviewStatus.textContent = "Live from /api/site-content";
}

async function updateNewsletterNow() {
  els.newsletterUpdateNow.disabled = true;
  els.newsletterStatus.textContent = "Updating";
  els.newsletterPreviewStatus.textContent = "Fetching latest post";
  try {
    const response = await fetch("/api/site-content/newsletter/refresh", {
      method: "POST",
      credentials: "same-origin"
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Refresh returned ${response.status}`);

    const newsletter = result.item || {};
    fillNewsletterForm(newsletter);
    renderNewsletterPreview(newsletter);
    els.newsletterStatus.textContent = result.updated ? "Updated to latest post" : "Already current";
    els.newsletterReadbackStatus.textContent = result.updated ? "Updated" : "No change";
    els.newsletterReadbackOutput.textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    els.newsletterStatus.textContent = "Update failed";
    els.newsletterReadbackStatus.textContent = "Error";
    els.newsletterReadbackOutput.textContent = error.message;
  } finally {
    els.newsletterUpdateNow.disabled = false;
  }
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
    const newsletter = result.newsletter || payload.newsletter;
    renderNewsletterPreview(newsletter);
    els.newsletterStatus.textContent = "Saved";
    els.newsletterReadbackStatus.textContent = "Saved";
    els.newsletterReadbackOutput.textContent = JSON.stringify(newsletter, null, 2);
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
  const count = state.sponsors.length;
  if (els.sponsorsCount) {
    els.sponsorsCount.textContent = count === 1 ? "1 sponsor" : `${count} sponsors`;
  }
  if (!count) {
    const empty = document.createElement("div");
    empty.className = "sponsors-empty";
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("fill", "none");
    icon.setAttribute("stroke", "currentColor");
    icon.setAttribute("stroke-width", "2");
    icon.setAttribute("stroke-linecap", "round");
    icon.setAttribute("stroke-linejoin", "round");
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", "2");
    rect.setAttribute("y", "7");
    rect.setAttribute("width", "20");
    rect.setAttribute("height", "14");
    rect.setAttribute("rx", "2");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16");
    icon.append(rect, path);
    empty.append(icon);
    const text = document.createElement("p");
    text.textContent = "No sponsors yet";
    empty.append(text);
    const sub = document.createElement("span");
    sub.textContent = "Add one to draft a sponsor blurb.";
    empty.append(sub);
    els.sponsorsList.append(empty);
    return;
  }

  state.sponsors.forEach((sponsor, index) => {
    const card = document.createElement("div");
    card.className = "sponsor-card";

    const head = document.createElement("div");
    head.className = "sponsor-card-head";
    const title = document.createElement("div");
    title.className = "sponsor-card-title";
    title.textContent = sponsor.name || `Sponsor ${index + 1}`;
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "btn btn-ghost btn-sm sponsor-remove";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", () => {
      state.sponsors.splice(index, 1);
      renderSponsors();
    });
    head.append(title, removeButton);
    card.append(head);

    const grid = document.createElement("div");
    grid.className = "sponsor-grid";

    const nameLabel = document.createElement("label");
    nameLabel.append("Sponsor name");
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = sponsor.name || "";
    nameInput.placeholder = "Banxa";
    nameInput.addEventListener("input", () => {
      sponsor.name = nameInput.value;
      title.textContent = sponsor.name || `Sponsor ${index + 1}`;
    });
    nameLabel.append(nameInput);
    grid.append(nameLabel);

    const urlLabel = document.createElement("label");
    urlLabel.append("Link");
    const urlInput = document.createElement("input");
    urlInput.type = "url";
    urlInput.value = sponsor.url || "";
    urlInput.placeholder = "https://...";
    urlInput.addEventListener("input", () => { sponsor.url = urlInput.value; });
    urlLabel.append(urlInput);
    grid.append(urlLabel);

    const blurbLabel = document.createElement("label");
    blurbLabel.className = "sponsor-blurb";
    blurbLabel.append("Blurb");
    const blurbInput = document.createElement("textarea");
    blurbInput.rows = 3;
    blurbInput.value = sponsor.blurb || "";
    blurbInput.placeholder = "What the sponsor does";
    blurbInput.addEventListener("input", () => { sponsor.blurb = blurbInput.value; });
    blurbLabel.append(blurbInput);
    grid.append(blurbLabel);

    const logoLabel = document.createElement("label");
    logoLabel.append("Logo URL");
    const logoInput = document.createElement("input");
    logoInput.type = "url";
    logoInput.value = sponsor.logo || "";
    logoInput.placeholder = "https://... (optional)";
    logoInput.addEventListener("input", () => { sponsor.logo = logoInput.value; });
    logoLabel.append(logoInput);
    grid.append(logoLabel);

    const foot = document.createElement("div");
    foot.className = "sponsor-card-foot";
    const enabledLabel = document.createElement("span");
    enabledLabel.className = "sponsor-toggle";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "vis-switch" + (sponsor.enabled ? " on" : "");
    toggle.setAttribute("role", "switch");
    toggle.setAttribute("aria-checked", sponsor.enabled ? "true" : "false");
    const knob = document.createElement("span");
    knob.className = "vis-switch-knob";
    toggle.append(knob);
    toggle.addEventListener("click", () => {
      sponsor.enabled = !sponsor.enabled;
      toggle.classList.toggle("on", sponsor.enabled);
      toggle.setAttribute("aria-checked", sponsor.enabled ? "true" : "false");
    });
    const toggleText = document.createElement("span");
    toggleText.textContent = "Show on site";
    enabledLabel.append(toggle, toggleText);
    foot.append(enabledLabel);

    card.append(grid, foot);
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
  if (els.sponsorsSaveStatus) {
    els.sponsorsSaveStatus.hidden = false;
    els.sponsorsSaveStatus.textContent = "Saving…";
  }
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
    if (els.sponsorsSaveStatus) {
      els.sponsorsSaveStatus.textContent = "Saved ✓";
      els.sponsorsSaveStatus.className = "pill status-ok";
      setTimeout(() => { if (els.sponsorsSaveStatus) els.sponsorsSaveStatus.hidden = true; }, 4000);
    }
  } catch (error) {
    els.sponsorsReadbackStatus.textContent = "Error";
    els.sponsorsReadbackOutput.textContent = error.message;
    if (els.sponsorsSaveStatus) {
      els.sponsorsSaveStatus.textContent = "Save failed";
      els.sponsorsSaveStatus.className = "pill status-error";
    }
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
  els.authMessage.classList.toggle("error", /invalid|incorrect|expired|failed/i.test(message));
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function formatTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
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

const themeToggle = document.querySelector("#theme-toggle");
const themeLabel = document.querySelector("#theme-label");

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("atr-admin-theme", theme);
  } catch (error) {}
  if (themeLabel) themeLabel.textContent = theme === "light" ? "Dark mode" : "Light mode";
}

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    applyTheme(next);
  });
}

if (themeLabel) {
  themeLabel.textContent = document.documentElement.dataset.theme === "light" ? "Dark mode" : "Light mode";
}

sidebar?.addEventListener("click", (event) => {
  if (event.target.closest("a, button")) closeSidebar();
});

/* ============ REDESIGN ENHANCEMENTS (Aug 23, 2026) ============ */
// Ingest Log tabs: Failures | Successes
(function () {
  const tabFail = document.querySelector("#ops-tab-failures");
  const tabSucc = document.querySelector("#ops-tab-success");
  const panelFail = document.querySelector("#ops-failures-panel");
  const panelSucc = document.querySelector("#ops-success-panel");
  if (tabFail && tabSucc && panelFail && panelSucc) {
    const activate = (failures) => {
      tabFail.classList.toggle("active", failures);
      tabSucc.classList.toggle("active", !failures);
      tabFail.setAttribute("aria-selected", failures ? "true" : "false");
      tabSucc.setAttribute("aria-selected", failures ? "false" : "true");
      panelFail.hidden = !failures;
      panelSucc.hidden = failures;
    };
    tabFail.addEventListener("click", () => activate(true));
    tabSucc.addEventListener("click", () => activate(false));
  }
})();

// Dashboard tabs: Overview | Events | Logs
(function () {
  const tabs = {
    overview: document.querySelector("#dash-tab-overview"),
    events: document.querySelector("#dash-tab-events"),
    logs: document.querySelector("#dash-tab-logs")
  };
  const panels = {
    overview: document.querySelector("#dash-overview-panel"),
    events: document.querySelector("#dash-events-panel"),
    logs: document.querySelector("#dash-logs-panel")
  };
  if (tabs.overview && tabs.events && tabs.logs) {
    const activate = (name) => {
      for (const key of Object.keys(tabs)) {
        const on = key === name;
        tabs[key].classList.toggle("active", on);
        tabs[key].setAttribute("aria-selected", on ? "true" : "false");
        if (panels[key]) panels[key].hidden = !on;
      }
    };
    tabs.overview.addEventListener("click", () => activate("overview"));
    tabs.events.addEventListener("click", () => activate("events"));
    tabs.logs.addEventListener("click", () => activate("logs"));
  }
})();

// Character counters: headline 0/120, blurb 0/300 (publish form + live editor)
function bindCharCounter(inputSelector, counterSelector, max) {
  const input = document.querySelector(inputSelector);
  const counter = document.querySelector(counterSelector);
  if (!input || !counter) return;
  const update = () => {
    counter.textContent = `${input.value.length}/${max}`;
    counter.classList.toggle("over", input.value.length > max);
  };
  input.addEventListener("input", update);
  update();
}
bindCharCounter("#headline-input", "#headline-count", 120);
bindCharCounter("#blurb-input", "#blurb-count", 300);
bindCharCounter("#live-edit-headline", "#live-edit-headline-count", 120);
bindCharCounter("#live-edit-blurb", "#live-edit-blurb-count", 300);

/* Publish toolbar wiring (Aug 23, 2026) */
(function () {
  const backBtn = document.querySelector("#publish-back");
  if (backBtn) backBtn.addEventListener("click", () => switchTab("live"));
  const quickBtn = document.querySelector("#publish-quick");
  if (quickBtn) quickBtn.addEventListener("click", () => {
    const status = document.querySelector("#item-status");
    if (status) status.value = "published";
    if (els.form) els.form.requestSubmit();
  });
})();
