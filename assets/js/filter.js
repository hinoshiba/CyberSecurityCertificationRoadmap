import { getState, setState, subscribe } from "./url_state.js";

/**
 * vendors filter semantics:
 *   - null  → no filter (show all vendors)
 *   - []    → explicit empty (hide everything)
 *   - [...] → only show these vendor slugs
 */
export function applyFilters(certs, ui) {
  const v = ui.vendors;
  const allowed = v === null ? null : new Set(v);
  return certs.filter(c => {
    if (c.japan_only && !ui.showJp) return false;
    if (allowed && !allowed.has(c.vendor?.slug)) return false;
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

    if (jpToggleBtn)   jpToggleBtn.setAttribute("aria-pressed",   String(state.showJp));
    if (langToggleBtn) langToggleBtn.setAttribute("aria-pressed", String(state.labelLang === "ja"));

    if (vendorPanel) syncVendorPanel(vendorPanel, state.vendors);

    onChange();
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
    <strong>Filter by vendor</strong>
    <span class="vendor-actions">
      <button type="button" class="link" data-action="all">All</button>
      <button type="button" class="link" data-action="none">None</button>
    </span>
  `;
  panel.appendChild(header);

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
