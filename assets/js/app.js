import { loadAll } from "./loader.js";
import { getState, setState, subscribe, serializeState } from "./url_state.js";
import {
  filterCatalog,
  sortCatalog,
  vendorIndex,
  matrixGroups,
  LEVEL_ORDER,
  escapeHtml as esc,
  label,
  certName,
  certTier,
} from "./catalog.js";
import { renderDetailPanel } from "./detail_panel.js";
import { exportRoadmapPNG } from "./export.js";
import { loadVersion, versionLabel } from "./version.js";
import { copy } from "./copy.js";

const $ = (id) => document.getElementById(id);
const dom = {
  results: $("cert-results"),
  table: $("roadmap-table"),
  detail: $("detail-dialog"),
  panel: $("detail-panel"),
  filters: $("filter-dialog"),
};
let data = null,
  byId = new Map(),
  vendors = [],
  visible = [],
  overview = [],
  pageSize = 24;
let lastState = null,
  detailId = null,
  detailLang = null,
  returnFocus = null;
let draftVendors = null,
  toastTimer,
  loading = false;
const lang = () => getState().lang;
const tr = (key) => copy[lang()][key];
const nameOf = (id) =>
  label(
    data?.domains.find((d) => d.id === id),
    lang(),
  );
const levelOf = (id) =>
  label(
    data?.tiers.find((t) => t.id === id),
    lang(),
  ) || tr("unrated");
const colorOf = (id) =>
  data?.domains.find((d) => d.id === id)?.color || "#277a65";
const certHref = (id) => serializeState({ ...getState(), cert: id });
const safeColor = (value) =>
  /^#[0-9a-f]{6}$/i.test(value || "") ? value : "#277a65";

function localize() {
  const s = getState(),
    c = copy[s.lang];
  document.documentElement.lang = s.lang;
  document.title =
    s.lang === "ja"
      ? "セキュリティ資格ロードマップ — 次の一歩を見つける"
      : "Security Certification Roadmap — Find your next step";
  for (const el of document.querySelectorAll("[data-i18n]")) {
    const value = c[el.dataset.i18n];
    if (typeof value === "string") el.innerHTML = value;
  }
  $("lang-toggle").textContent = s.lang === "ja" ? "English" : "日本語";
  $("lang-toggle").setAttribute(
    "aria-label",
    s.lang === "ja" ? "Switch to English" : "日本語に切り替え",
  );
  const theme =
    s.theme ||
    (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.dataset.theme = theme;
  $("theme-toggle").innerHTML =
    theme === "dark"
      ? '<span aria-hidden="true">☀</span>'
      : '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 15.4A8.5 8.5 0 0 1 8.6 4 8.5 8.5 0 1 0 20 15.4Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  $("theme-toggle").setAttribute(
    "aria-label",
    theme === "dark" ? c.light : c.dark,
  );
  $("search-input").placeholder = c.search;
  $("search-input").setAttribute("aria-label", c.searchLabel);
  $("search-clear").setAttribute("aria-label", c.clearSearch);
  $("vendor-search").placeholder = c.vendorSearch;
  $("vendor-search").setAttribute(
    "aria-label",
    s.lang === "ja" ? "提供元を検索" : "Search vendors",
  );
  $("sort-select").setAttribute("aria-label", c.sortLabel);
  $("level-filters").setAttribute("aria-label", c.levelLabel);
  $("domain-nav").setAttribute("aria-label", c.domainLabel);
  $("map-scroll").setAttribute("aria-label", c.overviewLabel);
  document
    .querySelector(".header-nav")
    .setAttribute("aria-label", c.navigation);
  dom.filters
    .querySelector("[data-close-filters]")
    .setAttribute(
      "aria-label",
      s.lang === "ja" ? "絞り込みを閉じる" : "Close filters",
    );
  document
    .querySelector("[data-close-share]")
    .setAttribute(
      "aria-label",
      s.lang === "ja" ? "共有を閉じる" : "Close share",
    );
  $("sort-select").options[0].textContent = c.level;
  $("sort-select").options[1].textContent = c.name;
  $("sort-select").options[2].textContent = c.vendor;
  $("share-url").setAttribute(
    "aria-label",
    s.lang === "ja" ? "共有用リンク" : "Shareable URL",
  );
  $("vt-input").setAttribute(
    "aria-label",
    s.lang === "ja"
      ? "提供元の強調表示のしきい値"
      : "Vendor highlight threshold",
  );
  document
    .querySelector(".hero-aside")
    .setAttribute(
      "aria-label",
      s.lang === "ja" ? "カタログの概要" : "Catalog at a glance",
    );
  $("workspace").setAttribute(
    "aria-label",
    s.lang === "ja" ? "資格を探す" : "Certification explorer",
  );
  document
    .querySelector(".view-switch")
    .setAttribute("aria-label", s.lang === "ja" ? "表示形式" : "View");
}

function focusKey(el) {
  if (!el || el === document.body) return null;
  if (el.id) return "#" + CSS.escape(el.id);
  for (const attr of [
    "data-cert-id",
    "data-domain",
    "data-level",
    "data-cell",
    "data-view",
    "data-clear",
  ]) {
    if (el.hasAttribute(attr)) {
      const scope = el.closest(
        "#cert-results,#roadmap-table,#domain-nav,#level-filters,#active-filters",
      );
      return `${scope ? "#" + scope.id + " " : ""}[${attr}="${CSS.escape(el.getAttribute(attr))}"]`;
    }
  }
  return null;
}
function render() {
  const s = getState();
  const active = document.activeElement,
    key = focusKey(active);
  localize();
  $("search-input").value = s.q;
  $("search-clear").hidden = !s.q;
  $("jp-toggle").checked = s.jp;
  $("map-names").checked = s.names;
  $("sort-select").value = s.sort;
  document
    .querySelectorAll("[data-view]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.view === s.view)),
    );
  if (!data) return;
  const filterChanged =
    !lastState ||
    ["q", "domain", "level", "view", "jp", "sort", "lang"].some(
      (k) => lastState[k] !== s[k],
    ) ||
    JSON.stringify(lastState.vendors) !== JSON.stringify(s.vendors);
  if (filterChanged) pageSize = 24;
  overview = filterCatalog(data.certs, s, { overview: true });
  visible = sortCatalog(filterCatalog(data.certs, s), s.sort, s.lang);
  renderNavigation();
  renderActiveFilters();
  $("map-section").hidden = s.view !== "map";
  $("workspace-title").textContent = s.domain
    ? nameOf(s.domain)
    : tr("landscape");
  if (s.view === "map") renderMap();
  renderResults();
  syncDetail();
  lastState = s;
  if (
    active !== document.body &&
    !active.isConnected &&
    !document.querySelector("dialog[open]")
  ) {
    const replacement = key && document.querySelector(key);
    (replacement?.getClientRects().length
      ? replacement
      : $("results-title")
    ).focus({ preventScroll: true });
  }
}

function renderNavigation() {
  const s = getState();
  const scoped = filterCatalog(data.certs, { ...s, domain: "" });
  $("domain-nav").innerHTML =
    `<button class="domain-button all-domains" data-domain="" aria-pressed="${!s.domain}"><span class="domain-icon" aria-hidden="true">▦</span><span>${tr("allDomains")}</span><span class="domain-count">${scoped.length}</span></button>` +
    data.domains
      .map((d, i) => {
        const count = scoped.filter(
          (c) =>
            c.domain === d.id ||
            (s.view === "explore" && c.secondary_domains?.includes(d.id)),
        ).length;
        return `<button class="domain-button" data-domain="${esc(d.id)}" aria-pressed="${s.domain === d.id}" style="--domain-color:${safeColor(d.color)}"><span class="domain-dot" aria-hidden="true"></span><span>${esc(copy[s.lang].domainShort[i] || label(d, s.lang))}</span><span class="domain-count">${count}</span></button>`;
      })
      .join("");
  $("domain-select").innerHTML =
    `<option value="">${tr("allDomains")}</option>` +
    data.domains
      .map(
        (d) => `<option value="${esc(d.id)}">${esc(label(d, s.lang))}</option>`,
      )
      .join("");
  $("domain-select").value = s.domain;
  const levels = LEVEL_ORDER.map((id) =>
    data.tiers.find((t) => t.id === id),
  ).filter(Boolean);
  $("level-filters").innerHTML =
    `<button data-level="" aria-pressed="${!s.level}">${tr("allLevels")}</button>` +
    levels
      .map(
        (t) =>
          `<button data-level="${esc(t.id)}" aria-pressed="${s.level === t.id}"><span class="level-dot" data-tier="${esc(t.id)}" aria-hidden="true"></span>${esc(label(t, s.lang))}</button>`,
      )
      .join("");
  $("level-description").textContent = s.level
    ? copy[s.lang].levels[s.level] || ""
    : "";
  $("level-description").hidden = !s.level;
}

function renderActiveFilters() {
  const s = getState();
  const chips = [];
  const add = (key, text) =>
    chips.push(
      `<button class="filter-chip" data-clear="${key}" aria-label="${esc(tr("clear") + ": " + text)}">${esc(text)} <span aria-hidden="true">×</span></button>`,
    );
  if (s.domain) add("domain", nameOf(s.domain));
  if (s.level) add("level", levelOf(s.level));
  if (s.q) add("q", s.q);
  if (s.vendors !== null)
    add(
      "vendors",
      s.vendors.length === 1
        ? vendors.find((v) => v.slug === s.vendors[0])?.name || s.vendors[0]
        : tr("vendorCount")(s.vendors.length),
    );
  if (s.jp) add("jp", tr("japan"));
  $("active-filters").innerHTML =
    chips.join("") +
    (chips.length
      ? `<button class="text-button" data-reset>${tr("reset")}</button>`
      : "");
  $("active-filters").hidden = !chips.length;
  $("filter-count").hidden = s.vendors === null;
  $("filter-count").textContent = s.vendors === null ? "" : "1";
}

function renderMap() {
  const s = getState(),
    groups = matrixGroups(overview);
  // Keep the full landscape in view when drilling down by domain or level.
  const ordered = [
    "expert",
    "professional",
    "associate",
    "foundational",
    "introductory",
    "specialty",
  ]
    .map((id) => data.tiers.find((t) => t.id === id))
    .filter(Boolean);
  dom.table.classList.toggle("with-names", s.names);
  dom.table.innerHTML = `<caption class="sr-only">${tr("overviewLabel")}</caption><thead><tr><th class="map-corner" scope="col">${tr("level")} <span aria-hidden="true">↓</span></th>${data.domains.map((d, i) => `<th scope="col" style="--domain-color:${safeColor(d.color)}"><span class="map-domain-dot" aria-hidden="true"></span><button data-domain="${esc(d.id)}" title="${esc(label(d, s.lang))}">${esc(copy[s.lang].domainShort[i] || label(d, s.lang))}</button></th>`).join("")}</tr></thead><tbody>${ordered
    .map(
      (t) =>
        `<tr data-tier="${esc(t.id)}"><th scope="row"><span class="level-dot" data-tier="${esc(t.id)}" aria-hidden="true"></span>${esc(label(t, s.lang))}${t.id === "specialty" ? '<span class="specialty-mark" aria-hidden="true">↗</span>' : ""}</th>${data.domains
          .map((d) => {
            const certs = sortCatalog(
              groups.get(`${t.id}|${d.id}`) || [],
              "name",
              s.lang,
            );
            const selected =
              (!s.domain || s.domain === d.id) &&
              (!s.level || s.level === t.id) &&
              (s.domain || s.level);
            const density =
              certs.length === 0
                ? 0
                : certs.length < 3
                  ? 1
                  : certs.length < 6
                    ? 2
                    : certs.length < 12
                      ? 3
                      : 4;
            const cell = `${t.id}|${d.id}`;
            const text = `${label(t, s.lang)} / ${label(d, s.lang)}: ${tr("mapCount")(certs.length)}`;
            return `<td class="density-${density}${selected ? " cell-selected" : ""}" style="--domain-color:${safeColor(d.color)}">${s.names && certs.length ? `<div class="map-cert-list">${certs.map((c) => `<a class="map-cert${s.vt && vendors.find((v) => v.slug === c.vendor?.slug)?.count >= s.vt ? " vendor-prominent" : ""}" href="${esc(certHref(c.id))}" data-cert-id="${esc(c.id)}" aria-label="${esc(c.abbr + " — " + certName(c, s.lang))}">${esc(c.abbr)}${c.japan_only ? "<small>JP</small>" : ""}${c.availability && c.availability !== "available" ? "<small>◷</small>" : ""}</a>`).join("")}</div>` : `<button class="map-cell" data-cell="${esc(cell)}" aria-pressed="${!!selected}" aria-label="${esc(text)}" ${certs.length ? "" : "disabled"}><span>${certs.length || "—"}</span>${certs.length ? '<span class="cell-arrow" aria-hidden="true">↗</span>' : ""}</button>`}</td>`;
          })
          .join("")}</tr>`,
    )
    .join("")}</tbody>`;
}

function renderResults() {
  const s = getState();
  $("results-toolbar").hidden = false;
  $("export-button").disabled = !visible.length;
  $("results-title").textContent = s.domain
    ? `${nameOf(s.domain)}${s.level ? " · " + levelOf(s.level) : ""}`
    : s.level
      ? levelOf(s.level)
      : tr("allCerts");
  $("result-count").textContent =
    tr("count")(visible.length, data.certs.length) +
    (s.domain
      ? " · " + tr(s.view === "map" ? "primaryNote" : "secondaryNote")
      : "");
  dom.results.setAttribute("aria-busy", "false");
  if (!visible.length) {
    dom.results.innerHTML = `<div class="empty-state"><span class="empty-symbol" aria-hidden="true">⌕</span><h3>${tr("noResults")}</h3><p>${tr("noResultsHint")}</p><button class="primary-button" data-reset>${tr("reset")}</button></div>`;
  } else
    dom.results.innerHTML = visible
      .slice(0, pageSize)
      .map((c) => {
        const tier = certTier(c),
          color = safeColor(colorOf(c.domain));
        const prominent =
          s.vt && vendors.find((v) => v.slug === c.vendor?.slug)?.count >= s.vt;
        return `<a class="cert-card${prominent ? " vendor-prominent" : ""}" href="${esc(certHref(c.id))}" data-cert-id="${esc(c.id)}" style="--domain-color:${color}"><div class="card-top"><span class="card-vendor">${esc(c.vendor?.name || "")}</span><span class="card-arrow" aria-hidden="true">↗</span></div><h4>${esc(c.abbr)}</h4><p class="card-name">${esc(certName(c, s.lang))}</p><div class="card-bottom"><span class="tier-badge" data-tier="${esc(tier)}"><span class="level-dot" data-tier="${esc(tier)}" aria-hidden="true"></span>${esc(levelOf(tier))}</span>${c.japan_only ? '<span class="badge">JP</span>' : ""}${c.availability && c.availability !== "available" ? `<span class="availability-badge">${esc(tr(c.availability === "coming-soon" ? "coming" : c.availability) || c.availability)}</span>` : ""}</div><span class="card-domain"><span class="domain-dot" aria-hidden="true"></span>${esc(nameOf(c.domain))}</span></a>`;
      })
      .join("");
  $("load-more").hidden = pageSize >= visible.length;
  $("load-more").textContent = tr("loadMore")(
    Math.min(24, visible.length - pageSize),
  );
}

function syncDetail() {
  const s = getState();
  if (!s.cert) {
    if (dom.detail.open) {
      dom.detail.close();
      document.body.classList.remove("dialog-open");
      const target = returnFocus && document.querySelector(returnFocus);
      (target?.getClientRects().length ? target : $("search-input")).focus({
        preventScroll: true,
      });
    }
    detailId = null;
    return;
  }
  if (detailId === s.cert && detailLang === s.lang && dom.detail.open) return;
  const cert = byId.get(s.cert);
  if (cert)
    renderDetailPanel(dom.panel, cert, byId, {
      labelLang: s.lang,
      domains: data.domains,
      tiers: data.tiers,
    });
  else
    dom.panel.innerHTML = `<div class="detail-topline"><h2 id="detail-title" tabindex="-1">${tr("noCert")}</h2><button class="square-button" data-action="close" aria-label="${tr("close")}">×</button></div><p>${tr("noCertHint")}</p>`;
  detailId = s.cert;
  detailLang = s.lang;
  if (!dom.detail.open) {
    dom.detail.showModal();
    document.body.classList.add("dialog-open");
  }
  dom.detail.scrollTop = 0;
  const heading = $("detail-title");
  heading.setAttribute("tabindex", "-1");
  heading.focus({ preventScroll: true });
}
function openCert(id, trigger) {
  if (!dom.detail.open) returnFocus = focusKey(trigger) || "#search-input";
  setState({ cert: id });
}
function closeDetail() {
  setState({ cert: null });
}
function resetFilters() {
  setState({ domain: "", level: "", q: "", vendors: null, jp: false });
}
function jumpToResults() {
  requestAnimationFrame(() => {
    $("results-title").scrollIntoView({
      block: "start",
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
    $("results-title").focus({ preventScroll: true });
  });
}
function toast(message) {
  clearTimeout(toastTimer);
  $("toast").textContent = message;
  $("toast").hidden = false;
  toastTimer = setTimeout(() => ($("toast").hidden = true), 4000);
}

function renderVendors() {
  const query = $("vendor-search").value.toLocaleLowerCase().trim();
  const matched = vendors.filter((v) =>
    v.name.toLocaleLowerCase().includes(query),
  );
  $("vendor-list").innerHTML =
    matched
      .map(
        (v) =>
          `<label class="vendor-row"><input type="checkbox" value="${esc(v.slug)}" ${draftVendors === null || draftVendors.has(v.slug) ? "checked" : ""}><span>${esc(v.name)}</span><span class="vendor-count">${v.count}</span></label>`,
      )
      .join("") || `<p class="muted">${tr("noVendors")}</p>`;
  $("filter-preview").textContent = tr("filterPreview")(
    filterCatalog(data.certs, {
      ...getState(),
      vendors: draftVendors === null ? null : [...draftVendors],
    }).length,
  );
}
function openFilters() {
  if (!data) return;
  draftVendors =
    getState().vendors === null ? null : new Set(getState().vendors);
  $("vendor-search").value = "";
  $("vt-input").value = getState().vt || "";
  renderVendors();
  dom.filters.showModal();
  document.body.classList.add("dialog-open");
}
function closeFilters() {
  dom.filters.close();
  document.body.classList.remove("dialog-open");
  $("filters-button").focus({ preventScroll: true });
}

// One listener per stable surface; rerendering never accumulates event handlers.
document.addEventListener("click", (event) => {
  const cert = event.target.closest("[data-cert-id],[data-cert-link]");
  if (cert) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    openCert(cert.dataset.certId || cert.dataset.certLink, cert);
    return;
  }
  if (event.target.closest('[data-action="close"]')) {
    closeDetail();
    return;
  }
  const domain = event.target.closest("[data-domain]");
  if (domain) {
    setState({ domain: domain.dataset.domain });
    return;
  }
  const level = event.target.closest("[data-level]");
  if (level) {
    setState({ level: level.dataset.level });
    return;
  }
  const view = event.target.closest("[data-view]");
  if (view) {
    setState({ view: view.dataset.view });
    return;
  }
  const cell = event.target.closest("[data-cell]");
  if (cell) {
    const [level, domain] = cell.dataset.cell.split("|");
    setState({ level, domain });
    jumpToResults();
    return;
  }
  const clear = event.target.closest("[data-clear]");
  if (clear) {
    const key = clear.dataset.clear;
    setState({ [key]: key === "vendors" ? null : key === "jp" ? false : "" });
    return;
  }
  if (event.target.closest("[data-reset]")) resetFilters();
  if (event.target.closest("[data-close-filters]")) closeFilters();
  if (event.target.closest("[data-close-share]")) $("share-dialog").close();
  if (event.target.closest("[data-retry]")) bootstrap();
});
$("search-input").addEventListener("input", () =>
  setState({ q: $("search-input").value }, { replace: true }),
);
$("search-clear").addEventListener("click", () => {
  setState({ q: "" }, { replace: true });
  $("search-input").focus();
});
$("jp-toggle").addEventListener("change", () =>
  setState({ jp: $("jp-toggle").checked }),
);
$("lang-toggle").addEventListener("click", () =>
  setState({ lang: lang() === "en" ? "ja" : "en" }),
);
$("theme-toggle").addEventListener("click", () =>
  setState({
    theme: document.documentElement.dataset.theme === "dark" ? "light" : "dark",
  }),
);
$("domain-select").addEventListener("change", () =>
  setState({ domain: $("domain-select").value }),
);
$("sort-select").addEventListener("change", () =>
  setState({ sort: $("sort-select").value }),
);
$("map-names").addEventListener("change", () =>
  setState({ names: $("map-names").checked }),
);
$("beginner-button").addEventListener("click", () => {
  setState({
    level: "introductory",
    domain: "",
    view: "explore",
    q: "",
    vendors: null,
  });
  jumpToResults();
});
$("filters-button").addEventListener("click", openFilters);
$("vendor-search").addEventListener("input", renderVendors);
$("vendors-all").addEventListener("click", () => {
  draftVendors = null;
  renderVendors();
});
$("vendors-none").addEventListener("click", () => {
  draftVendors = new Set();
  renderVendors();
});
$("vendor-list").addEventListener("change", (e) => {
  if (!e.target.matches("input")) return;
  if (draftVendors === null) draftVendors = new Set(vendors.map((v) => v.slug));
  if (e.target.checked) draftVendors.add(e.target.value);
  else draftVendors.delete(e.target.value);
  $("filter-preview").textContent = tr("filterPreview")(
    filterCatalog(data.certs, { ...getState(), vendors: [...draftVendors] })
      .length,
  );
});
$("apply-filters").addEventListener("click", () => {
  const n = Number($("vt-input").value);
  setState({
    vendors:
      draftVendors === null || vendors.every((v) => draftVendors.has(v.slug))
        ? null
        : [...draftVendors],
    vt: Number.isInteger(n) && n > 0 ? n : null,
  });
  closeFilters();
});
$("load-more").addEventListener("click", () => {
  const firstNew = visible[pageSize]?.id;
  pageSize += 24;
  renderResults();
  if (firstNew)
    dom.results
      .querySelector(`[data-cert-id="${CSS.escape(firstNew)}"]`)
      ?.focus({ preventScroll: true });
});
dom.detail.addEventListener("cancel", (e) => {
  e.preventDefault();
  closeDetail();
});
dom.filters.addEventListener("cancel", (e) => {
  e.preventDefault();
  closeFilters();
});
for (const dialog of [dom.detail, dom.filters, $("share-dialog")]) {
  dialog.addEventListener("click", (e) => {
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (
      e.clientX >= r.left &&
      e.clientX <= r.right &&
      e.clientY >= r.top &&
      e.clientY <= r.bottom
    )
      return;
    if (dialog === dom.detail) closeDetail();
    else if (dialog === dom.filters) closeFilters();
    else dialog.close();
  });
}
$("share-dialog").addEventListener("close", () => {
  document.body.classList.remove("dialog-open");
  $("share-button").focus({ preventScroll: true });
});
$("share-button").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    toast(tr("copied"));
  } catch {
    $("share-url").value = location.href;
    $("share-dialog").showModal();
    document.body.classList.add("dialog-open");
    $("share-url").select();
  }
});
$("export-button").addEventListener("click", async () => {
  if (!data) return;
  const button = $("export-button");
  button.disabled = true;
  toast(tr("exporting"));
  try {
    const s = getState();
    const context = [
      s.q ? `Search: ${s.q}` : "",
      s.domain ? nameOf(s.domain) : "",
      s.level ? levelOf(s.level) : "",
      s.vendors !== null ? s.vendors.join(", ") : "",
      s.jp ? "Japan included" : "Japan excluded",
    ]
      .filter(Boolean)
      .join(" · ");
    await exportRoadmapPNG({
      certs: visible,
      domains: data.domains,
      tiers: data.tiers,
      lang: s.lang,
      queryLabel: context,
    });
    toast(tr("exported"));
  } catch (error) {
    console.error(error);
    toast(error.message || tr("exportError"));
  } finally {
    button.disabled = false;
  }
});
document.addEventListener("keydown", (e) => {
  const typing = e.target.matches(
    'input,textarea,select,[contenteditable="true"]',
  );
  if (e.key === "/" && !typing && !document.querySelector("dialog[open]")) {
    e.preventDefault();
    $("search-input").focus();
  }
  if (e.key === "Escape" && e.target === $("search-input") && getState().q) {
    e.preventDefault();
    setState({ q: "" }, { replace: true });
  }
});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (!getState().theme) localize();
});

async function bootstrap() {
  if (loading) return;
  loading = true;
  $("load-status").hidden = false;
  $("load-status").innerHTML =
    `<span class="loading-dot"></span>${tr("loading")}`;
  dom.results.setAttribute("aria-busy", "true");
  try {
    data = await loadAll("data/manifest.json");
    byId = new Map(data.certs.map((c) => [c.id, c]));
    vendors = vendorIndex(data.certs);
    const s = getState(),
      clean = {};
    if (s.domain && !data.domains.some((d) => d.id === s.domain))
      clean.domain = "";
    if (s.level && !data.tiers.some((t) => t.id === s.level)) clean.level = "";
    if (Object.keys(clean).length)
      setState(clean, { replace: true, silent: true });
    $("total-stat").textContent = data.certs.length;
    $("domain-stat").textContent = data.domains.length;
    $("sidebar-domain-count").textContent = data.domains.length;
    $("load-status").hidden = true;
    render();
  } catch (error) {
    console.error(error);
    $("load-status").innerHTML =
      `<div class="empty-state"><h3>${tr("loadError")}</h3><p>${tr("loadErrorHint")}</p><button class="primary-button" data-retry>${tr("retry")}</button></div>`;
    dom.results.setAttribute("aria-busy", "false");
  } finally {
    loading = false;
  }
}
subscribe(render);
localize();
bootstrap();
loadVersion().then((v) => {
  const target = $("about-version");
  target.textContent = versionLabel(v);
  if (/^https:\/\//.test(v.commit_url || "")) {
    const a = document.createElement("a");
    a.href = v.commit_url;
    a.textContent = versionLabel(v);
    a.target = "_blank";
    a.rel = "noopener";
    target.replaceChildren(a);
  }
});
