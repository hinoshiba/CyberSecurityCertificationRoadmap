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
import { t } from "./i18n.js";

const state = {
  domains: [],
  tiers: [],
  certs: [],
  byId: new Map(),
  inverseMap: new Map(),
  ui: {
    showJp: false,
    labelLang: "en",
    vendors: null,
    selectedId: null,
    // Default: panel is HIDDEN. Clicking a cert only updates highlight +
    // arrows; the panel is opt-in via the "Show details" button so the
    // arrow state is preserved while the user navigates between certs.
    panelDismissed: true,
  }
};

const grid = document.getElementById("grid");
const wrap = document.getElementById("matrix-wrap");
const counter = document.getElementById("cert-count");
const detail = document.getElementById("detail-panel");
const arrowsSvg = document.getElementById("arrows-overlay");
const vendorPanel = document.getElementById("vendor-panel");

function rerender() {
  const visible = applyFilters(state.certs, state.ui);
  renderGrid(grid, state.domains, state.tiers, visible, state.ui);
  counter.textContent = `${visible.length} of ${state.certs.length} certs`;

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

  requestAnimationFrame(() => {
    drawArrows(arrowsSvg, grid, state.ui.selectedId, state.byId, state.inverseMap);
    if (state.ui.selectedId) {
      scrollSelectedIntoView(state.ui.selectedId, showPanel && !wasPanelOpen);
    }
  });
}

function scrollSelectedIntoView(certId, transitioning) {
  const findEl = () =>
    grid.querySelector(`.cert-card[data-cert-id="${CSS.escape(certId)}"]`);

  const doScroll = () => {
    const el = findEl();
    if (el) el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
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

    buildVendorPanel(vendorPanel, vendorIndex(data.certs));

    initThemeToggle(document.getElementById("theme-toggle"));
    attachFilterListeners({
      jpToggleBtn:   document.getElementById("jp-toggle-btn"),
      langToggleBtn: document.getElementById("lang-toggle-btn"),
      vendorPanel,
      state: state.ui,
      onChange: rerender,
    });
  } catch (err) {
    grid.innerHTML = `<p class="loading">Failed to load roadmap data: ${err.message}</p>`;
    console.error(err);
  } finally {
    wrap.removeAttribute("aria-busy");
  }
}

// ---------- Event wiring ----------

// Cert card click → just toggle selection (highlight + arrows).
// The panel does NOT auto-open; user opens it via "Show details" CTA.
// Switching certs preserves the user's current panel preference.
document.addEventListener("click", e => {
  const card = e.target.closest("a.cert-card");
  if (card) {
    e.preventDefault();
    const id = card.dataset.certId;
    const sameAgain = state.ui.selectedId === id;
    setState({ cert: sameAgain ? null : id });   // panelDismissed untouched
    return;
  }

  // Click outside any card. Chrome (topbar / controls / about footer / vendor
  // dropdown / detail panel) is excluded so PNG export, language toggle, JP
  // toggle, theme switch, etc. NEVER clear the selection. Only a click on
  // the matrix area itself (empty cell, tier label, etc.) deselects.
  if (state.ui.selectedId &&
      !e.target.closest("#detail-panel, .topbar, .controls, #about, #vendor-panel, .show-details-cta")) {
    state.ui.panelDismissed = true;   // reset the panel preference
    setState({ cert: null });
  }
});

// Detail panel "X" — dismiss panel only, keep arrows + highlight.
document.addEventListener("dismiss-panel", () => {
  if (!state.ui.selectedId) return;
  state.ui.panelDismissed = true;
  rerender();
});

/** Helper passed to export functions so they can re-run drawArrows after
 *  forcing the matrix to its fixed export width. Captured here because
 *  export.js shouldn't import directly from app state. */
function redrawCurrentArrows() {
  drawArrows(arrowsSvg, grid, state.ui.selectedId, state.byId, state.inverseMap);
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
    }
  },
});

// ESC fully clears selection (arrows + highlight + reset panel preference).
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && state.ui.selectedId) {
    state.ui.panelDismissed = true;
    setState({ cert: null });
  }
});

// Vendor filter dropdown open/close
document.addEventListener("click", e => {
  const toggle = e.target.closest("#vendor-filter-toggle");
  const panel = document.getElementById("vendor-panel");
  if (toggle) {
    panel.classList.toggle("open");
    return;
  }
  if (panel.classList.contains("open") && !e.target.closest("#vendor-panel")) {
    panel.classList.remove("open");
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

// "Show details" floating CTA — surfaces when the panel is dismissed but
// a cert is still selected. Lets the user re-open the detail panel without
// having to re-click the same card.
const showDetailsBtn = document.getElementById("show-details-btn");
if (showDetailsBtn) {
  showDetailsBtn.addEventListener("click", () => {
    if (!state.ui.selectedId) return;
    state.ui.panelDismissed = false;
    rerender();
  });
}

window.addEventListener("resize", () => {
  if (state.ui.selectedId) {
    drawArrows(arrowsSvg, grid, state.ui.selectedId, state.byId, state.inverseMap);
  }
});

// Re-render on URL state changes from outside the widgets (back/forward,
// pasted bookmark URL). We do NOT change panelDismissed on URL nav — the
// panel is opt-in via the Show details CTA. Anyone receiving a shared
// link sees the highlighted cert + arrows immediately and can choose to
// open the detail panel.
subscribe(() => {
  const s = getState();
  state.ui.showJp     = !!s.jp;
  state.ui.labelLang  = s.lang === "ja" ? "ja" : "en";
  state.ui.vendors    = s.vendors;
  state.ui.selectedId = s.cert || null;
  updateChromeLabels();
  rerender();
});

/** Localize static chrome (legend, floating CTA, export buttons) on every
 *  language change. Detail panel content + cert cards localize themselves
 *  during their own renders. */
function updateChromeLabels() {
  const lang = state.ui.labelLang;
  const set = (id, key) => {
    const el = document.getElementById(id);
    if (el) el.textContent = t(key, lang);
  };
  set("lg-prereq", "legend_prereq");
  set("lg-next",   "legend_next");
  set("lg-depth",  "legend_depth");
  set("lg-hint",   "legend_hint");

  const png = document.getElementById("png-export-btn");
  if (png) {
    png.textContent = t("png_btn_label", lang);
    png.title       = t("export_png", lang);
  }
  const showLabel = document.querySelector(".show-details-label");
  if (showLabel) showLabel.textContent = t("show_details", lang);
}

// Initial label paint (the subscribe() above also runs on page load,
// but call here too in case there's a brief gap before the URL state
// settles or to cover environments without the URL-state event).
updateChromeLabels();

bootstrap();
