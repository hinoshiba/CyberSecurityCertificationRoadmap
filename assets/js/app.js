import { loadAll } from "./loader.js";
import { renderGrid, vendorIndex } from "./render.js";
import { applyFilters, attachFilterListeners, buildVendorPanel } from "./filter.js";
import { initThemeToggle } from "./theme.js";
import { renderDetailPanel } from "./detail_panel.js";
import { drawArrows, buildInverseMap } from "./arrows.js";
import { getState, setState, subscribe } from "./url_state.js";
import { exportMatrixPNG } from "./export.js";
import { loadVersion, versionLabel } from "./version.js";
import { attachContextMenu } from "./context_menu.js";
import { renderExplorer, renderDomainOverview } from "./explorer.js";
import { updateSelectedOverlay } from "./selected_overlay.js";
import { t } from "./i18n.js";

const state = {
  domains: [],
  tiers: [],
  certs: [],
  byId: new Map(),
  inverseMap: new Map(),
  // Map<vendor-slug, count> over the full cert set. Used by the
  // vendor-prominent highlight (threshold is in ui.vendorThreshold).
  vendorCounts: new Map(),
  ui: {
    domain: "", tier: "", examLang: "", view: "list",
    showJp: false,
    labelLang: "en",
    vendors: null,
    selectedId: null,
    // Default: panel is HIDDEN. Clicking a cert only updates highlight +
    // arrows; the panel is opt-in via the "Show details" button so the
    // arrow state is preserved while the user navigates between certs.
    panelDismissed: true,
    // Live header search query (URL ?q=). Empty string = no search active.
    searchQuery: "",
    // Vendor-highlight threshold (URL ?vt=). null/0 = highlight off.
    vendorThreshold: null,
    // Pass-through to render.js so it can apply .vendor-prominent without
    // recomputing counts on every render.
    vendorCounts: new Map(),
  }
};

const grid = document.getElementById("grid");
const wrap = document.querySelector(".grid-and-arrows");
const counter = document.getElementById("cert-count");
const detail = document.getElementById("detail-panel");
const arrowsSvg = document.getElementById("arrows-overlay");
const selectedOverlay = document.getElementById("selected-overlay");
const vendorPanel = document.getElementById("vendor-panel");
const topbar = document.querySelector(".topbar");
const topbarNav = document.getElementById("topbar-nav");
const mobileToolsToggle = document.getElementById("mobile-tools-toggle");
const mobileToolsMql = window.matchMedia("(max-width: 640px)");

const resultsRoot = document.getElementById("explorer-results");
const overviewRoot = document.getElementById("domain-overview");
let previousSelectedId = null;
let previousView = null;
let detailReturnTarget = null;
const OVERVIEW_REL_CLASSES = ["rel-prereq", "rel-next", "rel-d2", "rel-d3", "rel-both"];

function rerender() {
  // Skip while data is still loading. The priming syncFromUrl() call runs
  // before bootstrap finishes; without this guard, it would wipe the
  // "Loading roadmap…" message and leave an empty grid until the fetch
  // resolves.
  if (state.byId.size === 0) return;

  const visible = applyFilters(state.certs, state.ui);
  const focusedCard = document.activeElement?.closest("[data-cert-id]")?.dataset.certId;
  renderGrid(grid, state.domains, state.tiers, visible, state.ui);
  renderExplorer(resultsRoot, { certs: visible, allCerts: state.certs, domains: state.domains, tiers: state.tiers, ui: state.ui });
  renderDomainOverview(overviewRoot, { certs: visible, domains: state.domains, tiers: state.tiers, ui: state.ui });
  const mapView = state.ui.view === "map";
  document.body.classList.toggle("map-view", mapView);
  resultsRoot.hidden = mapView;
  document.querySelector(".grid-and-arrows").hidden = !mapView || visible.length === 0;
  if (mapView && visible.length === 0) resultsRoot.hidden = false;
  document.querySelector(".controls").hidden = !mapView;
  document.getElementById("list-view-btn").setAttribute("aria-pressed", String(!mapView));
  document.getElementById("map-view-btn").setAttribute("aria-pressed", String(mapView));
  document.getElementById("png-export-btn").disabled = !mapView || !visible.length;
  syncDiscoveryControls();
  if (focusedCard && mapView) grid.querySelector(`[data-cert-id="${CSS.escape(focusedCard)}"]`)?.focus({preventScroll: true});
  attachOverviewListeners();
  counter.textContent = state.ui.labelLang === "ja" ? `${visible.length} 件の資格 / 全 ${state.certs.length} 件` : `${visible.length} ${visible.length === 1 ? "certification" : "certifications"} / ${state.certs.length} total`;

  document.body.classList.toggle("has-search", !!state.ui.searchQuery.trim());

  const isSelected = !!state.ui.selectedId && state.byId.has(state.ui.selectedId);
  const showPanel  = isSelected && !state.ui.panelDismissed;

  // .has-selection: cert chosen → dim unrelated cards, show arrows.
  // .detail-open : panel is visible → matrix-wrap shrinks to leave room.
  const wasPanelOpen = document.body.classList.contains("detail-open");
  document.body.classList.toggle("has-selection", isSelected);
  document.body.classList.toggle("detail-open",   showPanel);
  // .panel-dismissed shows the floating "Show details" CTA.
  document.body.classList.toggle("panel-dismissed", isSelected && state.ui.panelDismissed);

  // Always render the cert content into the panel when something is selected,
  // even if currently dismissed (CSS .open class controls visibility).
  const selected = isSelected ? state.byId.get(state.ui.selectedId) : null;
  renderDetailPanel(detail, selected, state.byId, state.ui);
  // Visibility is now CSS-driven (.open class), independent of content.
  detail.classList.toggle("open", showPanel);
  detail.setAttribute("aria-hidden", String(!showPanel));
  detail.toggleAttribute("inert", !showPanel);
  detail.setAttribute("aria-label", selected ? selected.abbr : "Details");
  const selectionNote = document.getElementById("selection-note");
  selectionNote.replaceChildren();
  selectionNote.hidden = !isSelected || visible.some(c => c.id === state.ui.selectedId);
  if (!selectionNote.hidden) {
    const text = document.createElement("span");
    text.textContent = `${selected.abbr}: ${t("hidden_selection", state.ui.labelLang)} `;
    const button = document.createElement("button");
    button.type = "button"; button.dataset.showSelected = "";
    button.textContent = t("show_selected", state.ui.labelLang);
    selectionNote.append(text, button);
  }
  const shouldScroll = state.ui.view === "map" && (previousView !== "map" || previousSelectedId !== state.ui.selectedId || (showPanel && !wasPanelOpen));
  previousSelectedId = state.ui.selectedId;
  previousView = state.ui.view;

  let didScrollSelection = false;
  const paintSelectionState = () => {
    redrawCurrentArrows();
    updateSelectedOverlay(selectedOverlay, grid, state.ui.selectedId, state.byId);
    updateOverviewCtaVisibility();
    requestAnimationFrame(updateOverviewCtaVisibility);
    if (shouldScroll && state.ui.selectedId && !didScrollSelection) {
      didScrollSelection = true;
      scrollSelectedIntoView(state.ui.selectedId, showPanel && !wasPanelOpen);
    }
  };
  requestAnimationFrame(paintSelectionState);
  setTimeout(paintSelectionState, 140);
}

function updateOverviewRelations() {
  const overviewCells = grid.querySelectorAll(".overview-cell");
  if (!overviewCells.length) return;

  for (const cell of overviewCells) {
    cell.classList.remove(...OVERVIEW_REL_CLASSES);
  }

  const relByCell = new Map();
  for (const card of grid.querySelectorAll(".cert-card.rel-prereq, .cert-card.rel-next")) {
    const matrixCell = card.closest(".cell[data-tier][data-domain]");
    if (!matrixCell) continue;
    const key = `${matrixCell.dataset.tier}|${matrixCell.dataset.domain}`;
    const rel = relByCell.get(key) || { prereq: false, next: false, depth: 3 };
    rel.prereq ||= card.classList.contains("rel-prereq");
    rel.next   ||= card.classList.contains("rel-next");
    const depth = card.classList.contains("rel-d3") ? 3 : card.classList.contains("rel-d2") ? 2 : 1;
    rel.depth = Math.min(rel.depth, depth);
    relByCell.set(key, rel);
  }

  for (const [key, rel] of relByCell) {
    const [tier, domain] = key.split("|");
    const overviewCell = grid.querySelector(
      `.overview-cell[data-overview-tier="${CSS.escape(tier)}"][data-overview-domain="${CSS.escape(domain)}"]`
    );
    if (!overviewCell || overviewCell.classList.contains("empty")) continue;
    if (rel.prereq) overviewCell.classList.add("rel-prereq");
    if (rel.next) overviewCell.classList.add("rel-next");
    if (rel.prereq && rel.next) overviewCell.classList.add("rel-both");
    if (rel.depth === 2) overviewCell.classList.add("rel-d2");
    if (rel.depth === 3) overviewCell.classList.add("rel-d3");
  }
}

function isMobileToolsLayout() {
  return mobileToolsMql.matches;
}

function syncMobileToolsAccessibility() {
  if (!topbarNav) return;
  const shouldHide = isMobileToolsLayout() && !document.body.classList.contains("mobile-tools-open");
  topbarNav.toggleAttribute("inert", shouldHide);
  topbarNav.setAttribute("aria-hidden", String(shouldHide));
}

function setMobileToolsOpen(open) {
  const next = !!open && isMobileToolsLayout();
  if (topbar) topbar.classList.toggle("tools-open", next);
  document.body.classList.toggle("mobile-tools-open", next);
  if (mobileToolsToggle) mobileToolsToggle.setAttribute("aria-expanded", String(next));
  if (!next) setVendorPanelOpen(false);
  syncMobileToolsAccessibility();
}

function updateOverviewCtaVisibility() {
  const overview = grid.querySelector(".mobile-overview");
  if (!overview) {
    document.body.classList.remove("overview-in-view");
    return;
  }
  const overviewRect = overview.getBoundingClientRect();
  const wrapRect = wrap.getBoundingClientRect();
  const isVisible = overviewRect.bottom > wrapRect.top + 8 && overviewRect.top < wrapRect.bottom - 8;
  document.body.classList.toggle("overview-in-view", isVisible);
}

function jumpToOverviewCell(overviewCell) {
  const target = grid.querySelector(
    `.cell[data-tier="${CSS.escape(overviewCell.dataset.overviewTier)}"][data-domain="${CSS.escape(overviewCell.dataset.overviewDomain)}"]`
  );
  if (!target) return;
  const stickyOffset = grid.querySelector(".tier-head")?.getBoundingClientRect().height || 0;
  wrap.scrollTo({ top: Math.max(0, target.offsetTop - stickyOffset), left: 0, behavior: "auto" });
}

function attachOverviewListeners() {
  for (const cell of grid.querySelectorAll("[data-overview-tier][data-overview-domain]")) {
    let downPoint = null;
    let pointerHandled = false;
    cell.addEventListener("pointerdown", e => {
      downPoint = { x: e.clientX, y: e.clientY };
      pointerHandled = false;
    });
    cell.addEventListener("pointerup", e => {
      if (!downPoint) return;
      const dx = Math.abs(e.clientX - downPoint.x);
      const dy = Math.abs(e.clientY - downPoint.y);
      downPoint = null;
      if (dx > 8 || dy > 8) return;
      pointerHandled = true;
      e.preventDefault();
      e.stopPropagation();
      jumpToOverviewCell(cell);
    });
    cell.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      if (pointerHandled) {
        pointerHandled = false;
        return;
      }
      jumpToOverviewCell(cell);
    });
  }
}

function scrollSelectedIntoView(certId, transitioning) {
  const findEl = () =>
    grid.querySelector(`.cert-card[data-cert-id="${CSS.escape(certId)}"]`);

  const doScroll = () => {
    const el = findEl();
    if (el) el.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
  };

  if (!transitioning) { doScroll(); return; }

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    document.body.removeEventListener("transitionend", onTransitionEnd);
    doScroll();
  };
  function onTransitionEnd(e) {
    if (e.target !== document.body) return;
    if (e.propertyName !== "padding-bottom") return;
    finish();
  }
  document.body.addEventListener("transitionend", onTransitionEnd);
  setTimeout(finish, 260);
}

async function renderVersion() {
  const target = document.getElementById("about-version");
  if (!target) return;
  const v = await loadVersion();
  const label = versionLabel(v);
  if (v.commit_url && v.commit !== "dev") {
    target.innerHTML = `<a href="${v.commit_url}" target="_blank" rel="noopener" title="View commit on GitHub">${label}</a>`;
  } else {
    target.textContent = label;
  }
}

async function bootstrap() {
  renderVersion();   // fire-and-forget
  try {
    const data = await loadAll("data/manifest.json");
    state.domains = data.domains;
    state.tiers   = data.tiers;
    state.certs   = data.certs;
    state.byId    = new Map(data.certs.map(c => [c.id, c]));
    state.inverseMap = buildInverseMap(state.byId);

    // vendorIndex returns [{slug, name, count}], already over the full set.
    // Reuse it for both the filter panel and the prominent-vendor highlight.
    const vendors = vendorIndex(data.certs);
    state.vendorCounts = new Map(vendors.map(v => [v.slug, v.count]));
    state.ui.vendorCounts = state.vendorCounts;

    buildVendorPanel(vendorPanel, vendors);
    updateChromeLabels();

    initThemeToggle(document.getElementById("theme-toggle"));
    attachFilterListeners({
      jpToggleBtn:   document.getElementById("jp-toggle-btn"),
      langToggleBtn: document.getElementById("lang-toggle-btn"),
      vendorPanel,
      state: state.ui,

    });
    rerender();
  } catch (err) {
    grid.innerHTML = `<p class="loading">Failed to load roadmap data: ${err.message}</p>`;
    console.error(err);
  } finally {
    document.getElementById("matrix-wrap").removeAttribute("aria-busy");
  }
}

// ---------- Event wiring ----------

if (mobileToolsToggle) {
  mobileToolsToggle.addEventListener("click", () => {
    setMobileToolsOpen(!document.body.classList.contains("mobile-tools-open"));
  });
}

if (topbarNav) {
  topbarNav.addEventListener("click", e => {
    if (e.target.closest("a")) setMobileToolsOpen(false);
  });
}

syncMobileToolsAccessibility();
if (mobileToolsMql.matches) document.getElementById("filter-disclosure").open = false;

// Cert card click → just toggle selection (highlight + arrows).
// The panel does NOT auto-open; user opens it via "Show details" CTA.
// Switching certs preserves the user's current panel preference.
document.addEventListener("click", e => {
  if (document.body.classList.contains("mobile-tools-open") &&
      !e.target.closest("#topbar-nav, #mobile-tools-toggle, #vendor-panel")) {
    setMobileToolsOpen(false);
    return;
  }

  const card = e.target.closest("a.cert-card");
  if (card) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const id = card.dataset.certId;
    const sameAgain = state.ui.selectedId === id;
    setState({ cert: sameAgain ? null : id });   // panelDismissed untouched
    return;
  }

  const overviewCell = e.target.closest("[data-overview-tier][data-overview-domain]");
  if (overviewCell) {
    e.preventDefault();
    jumpToOverviewCell(overviewCell);
    return;
  }

  // Click outside any card. Chrome (topbar / controls / about footer / vendor
  // dropdown / detail panel) is excluded so PNG export, language toggle, JP
  // toggle, theme switch, etc. NEVER clear the selection. Only a click on
  // the matrix area itself (empty cell, tier label, etc.) deselects.
  if (state.ui.selectedId &&
      e.target.closest("#grid")) {
    state.ui.panelDismissed = true;   // reset the panel preference
    setState({ cert: null });
  }
});

// Detail panel "X" — dismiss panel only, keep arrows + highlight.
document.addEventListener("dismiss-panel", () => {
  if (!state.ui.selectedId) return;
  state.ui.panelDismissed = true;
  rerender();
  restoreDetailFocus();
});

/** Helper passed to export functions so they can re-run drawArrows after
 *  forcing the matrix to its fixed export width. Captured here because
 *  export.js shouldn't import directly from app state. */
function redrawCurrentArrows() {
  if (state.ui.view !== "map") { arrowsSvg.replaceChildren(); return; }
  drawArrows(arrowsSvg, grid, state.ui.selectedId, state.byId, state.inverseMap);
  updateOverviewRelations();
}

// Right-click context menu on cert cards: deselect / copy abbr / show details.
attachContextMenu({
  getState: () => ({ byId: state.byId, ui: state.ui }),
  onAction: async (action, cert) => {
    switch (action) {
      case "deselect":
        state.ui.panelDismissed = true;
        setState({ cert: null });
        break;
      case "copy-abbr":
        try {
          await navigator.clipboard.writeText(cert.abbr);
        } catch (_) {
          const ta = document.createElement("textarea");
          ta.value = cert.abbr;
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand("copy"); } catch (_) {}
          ta.remove();
        }
        break;
      case "show-details":
        state.ui.panelDismissed = false;
        if (state.ui.selectedId !== cert.id) setState({ cert: cert.id });
        else rerender();
        break;
      case "open-official": {
        const url = cert.official?.exam_url || cert.vendor?.url;
        if (url) window.open(url, "_blank", "noopener,noreferrer");
        break;
      }
    }
  },
});

// Escape closes the nearest open surface before clearing search/selection.
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (vendorPanel.classList.contains("open")) {
    setVendorPanelOpen(false);
    document.getElementById("vendor-filter-toggle").focus();
  } else if (!state.ui.panelDismissed && state.ui.selectedId) {
    state.ui.panelDismissed = true;
    rerender(); restoreDetailFocus();
  } else if (document.body.classList.contains("mobile-tools-open")) {
    setMobileToolsOpen(false);
    mobileToolsToggle.focus();
  } else if (state.ui.searchQuery) {
    searchSession = false;
    setState({q: ""});
    document.getElementById("search-input").focus();
  } else if (state.ui.selectedId) {
    setState({cert: null});
  }
});

// A typing session occupies one history entry; discrete filters remain reversible.
const searchInput = document.getElementById("search-input");
const searchClear = document.getElementById("search-clear");
let searchSession = false;
searchInput.addEventListener("focus", () => { searchSession = false; });
window.addEventListener("popstate", () => { searchSession = false; });
searchInput.addEventListener("input", () => {
  setState({q: searchInput.value}, {replace: searchSession});
  searchSession = true;
});
searchInput.addEventListener("keydown", e => {
  if (e.key !== "Enter" || e.isComposing) return;
  const visible = applyFilters(state.certs, state.ui);
  if (visible.length === 1) openDetails(visible[0].id);
  else document.getElementById("results-heading").focus();
});
searchClear.addEventListener("click", () => {
  searchSession = false;
  setState({q: ""});
  searchInput.focus();
});

// Vendor filter dropdown open/close
function setVendorPanelOpen(open) {
  const panel = document.getElementById("vendor-panel");
  if (!panel) return;
  panel.classList.toggle("open", open);
  panel.setAttribute("aria-hidden", String(!open));
  panel.toggleAttribute("inert", !open);
  document.getElementById("vendor-filter-toggle").setAttribute("aria-expanded", String(open));
}

document.addEventListener("click", e => {
  const toggle = e.target.closest("#vendor-filter-toggle");
  const panel = document.getElementById("vendor-panel");
  if (!panel) return;
  if (toggle) {
    setVendorPanelOpen(!panel.classList.contains("open"));
    return;
  }
  if (panel.classList.contains("open") && !e.target.closest("#vendor-panel")) {
    setVendorPanelOpen(false);
  }
});

// PNG export button
const pngBtn = document.getElementById("png-export-btn");
if (pngBtn) {
  pngBtn.addEventListener("click", async () => {
    const orig = pngBtn.textContent;
    pngBtn.disabled = true;
    pngBtn.textContent = "…";
    try {
      await exportMatrixPNG(redrawCurrentArrows);
    } catch (err) {
      console.error("PNG export failed:", err);
      alert("PNG export failed: " + err.message);
    } finally {
      pngBtn.disabled = false;
      pngBtn.textContent = orig;
    }
  });
}

// Vendor-highlight threshold input. Debounced so URL doesn't churn while
// the user is still typing. Empty / 0 / NaN clears the highlight (state
// = null, URL drops the `vt` param).
const vtInput = document.getElementById("vt-input");
if (vtInput) {
  let vtDebounce = 0;
  vtInput.addEventListener("input", () => {
    const raw = vtInput.value.trim();
    const n = parseInt(raw, 10);
    const next = (Number.isFinite(n) && n > 0) ? n : null;
    clearTimeout(vtDebounce);
    vtDebounce = setTimeout(() => setState({ vt: next }), 200);
  });
}

// "Show details" floating CTA — surfaces when the panel is dismissed but
// a cert is still selected. Lets the user re-open the detail panel without
// having to re-click the same card.
const showDetailsBtn = document.getElementById("show-details-btn");
if (showDetailsBtn) {
  showDetailsBtn.addEventListener("click", () => {
    if (!state.ui.selectedId) return;
    openDetails(state.ui.selectedId);
  });
}

const showOverviewBtn = document.getElementById("show-overview-btn");
if (showOverviewBtn) {
  showOverviewBtn.addEventListener("click", () => {
    const overview = grid.querySelector(".mobile-overview");
    if (overview) overview.scrollIntoView({ block: "start", inline: "nearest", behavior: "auto" });
  });
}

window.addEventListener("resize", () => {
  if (!isMobileToolsLayout()) {
    document.getElementById("filter-disclosure").open = true;
    setMobileToolsOpen(false);
  } else {
    syncMobileToolsAccessibility();
  }
  updateOverviewCtaVisibility();
  if (state.ui.selectedId) {
    redrawCurrentArrows();
    updateSelectedOverlay(selectedOverlay, grid, state.ui.selectedId, state.byId);
  } else {
    updateOverviewRelations();
  }
});

wrap.addEventListener("scroll", () => {
  requestAnimationFrame(updateOverviewCtaVisibility);
});

function localizedLabel(item) {
  return state.ui.labelLang === "ja" ? (item.label_ja || item.label_en) : item.label_en;
}
function syncDiscoveryControls() {
  const options = (id, items, current, allKey) => {
    const select = document.getElementById(id);
    select.replaceChildren(new Option(t(allKey, state.ui.labelLang), ""));
    for (const item of items) select.add(new Option(item.label, item.id));
    // Preserve unknown bookmarked values instead of silently broadening the filter.
    if (current && !items.some(item => item.id === current)) select.add(new Option(current, current));
    select.value = current;
  };
  options("domain-filter", state.domains.map(d => ({id:d.id,label:localizedLabel(d)})), state.ui.domain, "all_domains");
  options("tier-filter", [...state.tiers].reverse().map(d => ({id:d.id,label:localizedLabel(d)})), state.ui.tier, "all_tiers");
  const names = new Intl.DisplayNames([state.ui.labelLang], {type:"language"});
  const codes = [...new Set(state.certs.flatMap(c => c.logistics?.languages || []))].sort();
  options("exam-language-filter", codes.map(id => { let label = id; try {label = names.of(id);} catch {} return {id,label}; }), state.ui.examLang, "all_languages");
  const active = document.getElementById("active-filters");
  active.replaceChildren();
  const chips = [
    ["q", state.ui.searchQuery, state.ui.searchQuery],
    ["domain", state.ui.domain, document.getElementById("domain-filter").selectedOptions[0]?.textContent],
    ["tier", state.ui.tier, document.getElementById("tier-filter").selectedOptions[0]?.textContent],
    ["examLang", state.ui.examLang, document.getElementById("exam-language-filter").selectedOptions[0]?.textContent],
    ["vendors", state.ui.vendors !== null, `${t("filter_vendor", state.ui.labelLang)}: ${state.ui.vendors?.map(slug => state.certs.find(c => c.vendor?.slug === slug)?.vendor.name || slug).join(", ") || t("no_vendors",state.ui.labelLang)}`]
  ];
  for (const [key, value, label] of chips) {
    if (!value) continue;
    const button = document.createElement("button");
    button.type = "button"; button.className = "filter-chip";
    button.dataset.clearFilter = key; button.textContent = `${label} ×`;
    button.setAttribute("aria-label", `${label}: ${state.ui.labelLang === "ja" ? "条件を解除" : "remove filter"}`);
    active.append(button);
  }
  const reset = document.createElement("button");
  reset.type = "button"; reset.dataset.resetFilters = ""; reset.className = "reset-filters";
  reset.textContent = t("reset_filters", state.ui.labelLang);
  reset.disabled = !chips.some(([,value]) => value);
  active.append(reset);
}
function resetFilters() {
  setState({q:"", domain:"", tier:"", examLang:"", vendors:null});
}
function openDetails(id) {
  const active = document.activeElement;
  detailReturnTarget = active?.id ? {id: active.id} : {cert: id};
  state.ui.panelDismissed = false;
  if (state.ui.selectedId !== id) setState({cert:id}); else rerender();
  detail.focus({preventScroll:true});
}
function restoreDetailFocus() {
  const target = detailReturnTarget?.id ? document.getElementById(detailReturnTarget.id) : resultsRoot.querySelector(`[data-detail-id="${CSS.escape(detailReturnTarget?.cert || state.ui.selectedId || "")}"]`);
  (target && target.getClientRects().length ? target : document.getElementById("results-heading")).focus({preventScroll:true});
}
for (const [id,key] of [["domain-filter","domain"],["tier-filter","tier"],["exam-language-filter","examLang"]]) {
  document.getElementById(id).addEventListener("change", e => setState({[key]:e.target.value}));
}
for (const view of ["list","map"]) {
  document.getElementById(`${view}-view-btn`).addEventListener("click", () => setState({view}));
}
document.addEventListener("click", e => {
  const detailButton = e.target.closest("[data-detail-id]");
  if (detailButton) { openDetails(detailButton.dataset.detailId); return; }
  const mapButton = e.target.closest("[data-map-id]");
  if (mapButton) { state.ui.panelDismissed = true; setState({view:"map",cert:mapButton.dataset.mapId}); document.getElementById("results-heading").focus(); return; }
  const reset = e.target.closest("[data-reset-filters]");
  if (reset) { resetFilters(); searchInput.focus(); return; }
  const chip = e.target.closest("[data-clear-filter]");
  if (chip) { const key = chip.dataset.clearFilter; setState({[key]:key === "vendors" ? null : ""}); searchInput.focus(); return; }
  const domain = e.target.closest("[data-domain-id]");
  if (domain) { setState({domain:domain.dataset.domainId,view:"list"}); document.getElementById("results-heading").focus(); return; }
  if (e.target.closest("[data-include-jp]")) { setState({jp:true}); searchInput.focus(); return; }
  if (e.target.closest("[data-show-selected]")) { setState({q:"",domain:"",tier:"",examLang:"",vendors:null,jp:state.ui.showJp || !!state.byId.get(state.ui.selectedId)?.japan_only}); document.getElementById("results-heading").focus(); }
});

// Re-render on URL state changes from outside the widgets (back/forward,
// pasted bookmark URL). We do NOT change panelDismissed on URL nav — the
// panel is opt-in via the Show details CTA. Anyone receiving a shared
// link sees the highlighted cert + arrows immediately and can choose to
// open the detail panel.
function syncFromUrl() {
  const s = getState();
  state.ui.domain = s.domain || "";
  state.ui.tier = s.tier || "";
  state.ui.examLang = s.examLang || "";
  state.ui.view = s.view || "list";
  state.ui.showJp      = !!s.jp;
  state.ui.labelLang   = s.lang === "ja" ? "ja" : "en";
  state.ui.vendors     = s.vendors;
  state.ui.selectedId  = s.cert || null;
  state.ui.searchQuery = s.q || "";
  state.ui.vendorThreshold = s.vt;
  // Keep input field in sync (e.g., when state arrives from URL on load
  // or back/forward).
  const si = document.getElementById("search-input");
  if (si && si.value !== state.ui.searchQuery) si.value = state.ui.searchQuery;
  const vi = document.getElementById("vt-input");
  if (vi) {
    const want = s.vt ? String(s.vt) : "";
    if (vi.value !== want) vi.value = want;
  }
  updateChromeLabels();
  rerender();
}
subscribe(syncFromUrl);
// subscribe() only fires on setState/popstate, so prime the state once on
// load so URL params (?q=, ?vt=, ?cert=, etc.) take effect even before
// any user interaction.
syncFromUrl();

/** Localize static chrome (legend, floating CTA, export buttons) on every
 *  language change. Detail panel content + cert cards localize themselves
 *  during their own renders. */
function updateChromeLabels() {
  const lang = state.ui.labelLang;
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n, lang); });
  document.getElementById("search-input").placeholder = t("search_placeholder", lang);
  document.getElementById("search-clear").setAttribute("aria-label", t("clear_search", lang));
  document.getElementById("active-filters").setAttribute("aria-label", t("active_filters", lang));
  document.querySelector(".view-switch").setAttribute("aria-label", t("view_label", lang));
  document.getElementById("lang-toggle-btn").textContent = t("label_language", lang);
  const set = (id, key) => {
    const el = document.getElementById(id);
    if (el) el.textContent = t(key, lang);
  };
  set("lg-prereq", "legend_prereq");
  set("lg-next",   "legend_next");
  set("lg-depth",  "legend_depth");
  set("lg-hint",   "legend_hint");

  set("vt-label",  "vt_label");
  set("vt-suffix", "vt_suffix");
  const vtControl = document.getElementById("vt-control");
  if (vtControl) vtControl.title = t("vt_tooltip", lang);
  const vtInputEl = document.getElementById("vt-input");
  if (vtInputEl) vtInputEl.setAttribute("aria-label", t("vt_tooltip", lang));

  const png = document.getElementById("png-export-btn");
  if (png) {
    png.textContent = t("png_btn_label", lang);
    png.title       = t("export_png", lang);
  }
  const showLabel = document.querySelector(".show-details-label");
  if (showLabel) showLabel.textContent = t("show_details", lang);
  document.getElementById("show-details-btn").setAttribute("aria-label", t("show_details", lang));
  const overviewBtn = document.getElementById("show-overview-btn");
  if (overviewBtn) {
    overviewBtn.title = t("show_overview_tooltip", lang);
    overviewBtn.setAttribute("aria-label", t("show_overview_tooltip", lang));
  }
  const overviewLabel = document.querySelector(".show-overview-label");
  if (overviewLabel) overviewLabel.textContent = t("show_overview", lang);
  const toolsToggle = document.getElementById("mobile-tools-toggle");
  if (toolsToggle) {
    toolsToggle.title = t("tools_tooltip", lang);
    toolsToggle.setAttribute("aria-label", t("tools_tooltip", lang));
  }
  const toolsLabel = document.querySelector(".mobile-tools-label");
  if (toolsLabel) toolsLabel.textContent = t("tools", lang);
}

// Initial label paint (the subscribe() above also runs on page load,
// but call here too in case there's a brief gap before the URL state
// settles or to cover environments without the URL-state event).
updateChromeLabels();

bootstrap();
