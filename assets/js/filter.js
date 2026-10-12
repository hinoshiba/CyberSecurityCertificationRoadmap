import { getState, setState, subscribe } from "./url_state.js";
import { matchCertIds } from "./search.js";

/**
 * vendors filter semantics:
 *   - null  → no filter (show all vendors)
 *   - []    → explicit empty (hide everything)
 *   - [...] → only show these vendor slugs
 */
export function applyFilters(certs, ui) {
  const v = ui.vendors;
  const allowed = v == null ? null : new Set(v);
  const matches = matchCertIds(certs, ui.searchQuery);
  return certs.filter(c => {
    if (c.japan_only && !ui.showJp) return false;
    if (allowed && !allowed.has(c.vendor?.slug)) return false;
    if (ui.domain && c.domain !== ui.domain) return false;
    if (ui.tier && (c.evaluation?.computed_tier || "specialty") !== ui.tier) return false;
    // Use the recorded language code exactly; an absent language entry
    // does not establish that an exam is available in that language.
    if (ui.examLang && !c.logistics?.languages?.includes(ui.examLang)) return false;
    if (matches && !matches.has(c.id)) return false;
    return true;
  });
}

export function attachFilterListeners({ jpToggleBtn, langToggleBtn, vendorPanel, state, onChange }) {
  const sync = () => {
    const s = getState();
    state.showJp     = !!s.jp;
    state.labelLang  = s.lang === "ja" ? "ja" : "en";
    state.vendors    = s.vendors;
    state.selectedId = s.cert || null;
    state.domain = s.domain;
    state.tier = s.tier;
    state.examLang = s.examLang;
    state.searchQuery = s.q;
    state.view = s.view;

    if (jpToggleBtn)   jpToggleBtn.setAttribute("aria-pressed",   String(state.showJp));
    if (langToggleBtn) langToggleBtn.setAttribute("aria-pressed", String(state.labelLang === "ja"));

    if (vendorPanel) syncVendorPanel(vendorPanel, state.vendors);

    onChange?.();
  };
  sync();
  subscribe(sync);

  if (jpToggleBtn) {
    jpToggleBtn.addEventListener("click", () => setState({ jp: !getState().jp }));
  }
  if (langToggleBtn) {
    langToggleBtn.addEventListener("click", () => {
      const next = getState().lang === "ja" ? "en" : "ja";
      setState({ lang: next });
    });
  }
}

export function buildVendorPanel(panel, allVendors) {
  panel.innerHTML = "";
  const header = document.createElement("div");
  header.className = "vendor-panel-header";
  header.innerHTML = `
    <strong data-i18n="filter_vendor">Filter by vendor</strong>
    <span class="vendor-actions">
      <button type="button" class="link" data-action="all" data-i18n="all_vendors">All</button>
      <button type="button" class="link" data-action="none" data-i18n="no_vendors">None</button>
    </span>
  `;
  panel.appendChild(header);
  const note = document.createElement("p");
  note.className = "muted small";
  note.dataset.i18n = "vendor_counts_note";
  panel.appendChild(note);

  const list = document.createElement("div");
  list.className = "vendor-list";
  panel.appendChild(list);

  for (const v of allVendors) {
    const id = `vf-${v.slug}`;
    const row = document.createElement("label");
    row.className = "vendor-row";
    row.innerHTML = `
      <input type="checkbox" id="${id}" data-vendor="${v.slug}" />
      <span class="vendor-name">${escapeHtml(v.name)}</span>
      <span class="vendor-count">${v.count}</span>
    `;
    list.appendChild(row);
  }

  panel.addEventListener("change", e => {
    if (e.target instanceof HTMLInputElement && e.target.dataset.vendor) {
      const allBoxes = panel.querySelectorAll("input[data-vendor]");
      const checked = Array.from(allBoxes).filter(i => i.checked).map(i => i.dataset.vendor);
      if (checked.length === allBoxes.length) {
        // All selected = no filter. URL drops the `v` param entirely.
        setState({ vendors: null });
      } else {
        setState({ vendors: checked });
      }
    }
  });

  panel.addEventListener("click", e => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    if (btn.dataset.action === "all")  setState({ vendors: null });
    if (btn.dataset.action === "none") setState({ vendors: [] });
  });
}

function syncVendorPanel(panel, currentVendors) {
  const allBoxes = panel.querySelectorAll("input[data-vendor]");
  if (currentVendors === null) {
    // No filter → all checked
    for (const input of allBoxes) input.checked = true;
  } else {
    const set = new Set(currentVendors);
    for (const input of allBoxes) input.checked = set.has(input.dataset.vendor);
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
