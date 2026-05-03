/**
 * Lightweight right-click context menu for cert cards.
 *
 * On `contextmenu` of a `.cert-card` we suppress the browser default and
 * pop a small menu near the cursor with: deselect / copy abbr /
 * show details. Items are localized via i18n.
 *
 * The menu hides on click-outside, ESC, or after activating any item.
 * Browser default contextmenu remains available everywhere else (links,
 * panel content, footer, etc.).
 */

import { setState } from "./url_state.js";
import { t } from "./i18n.js";

let menuEl = null;
let activeCert = null;       // cert object the menu is currently for
let actionDispatch = null;   // callback {action, certId} → host (app.js)

function ensureMenu() {
  if (menuEl) return menuEl;
  menuEl = document.createElement("div");
  menuEl.id = "cert-context-menu";
  menuEl.className = "cert-context-menu";
  menuEl.setAttribute("role", "menu");
  menuEl.style.display = "none";
  document.body.appendChild(menuEl);
  return menuEl;
}

function hide() {
  if (menuEl) menuEl.style.display = "none";
  activeCert = null;
}

function buildItems(cert, lang, currentlySelectedId) {
  const isSelected = currentlySelectedId === cert.id;
  const officialUrl = cert.official?.exam_url || cert.vendor?.url;
  // Each item: {label, action, disabled?}
  return [
    { label: t("ctx_deselect",      lang), action: "deselect",      disabled: !isSelected },
    { label: t("ctx_copy_abbr",     lang), action: "copy-abbr" },
    { label: t("ctx_show_details",  lang), action: "show-details" },
    { label: t("ctx_open_official", lang), action: "open-official", disabled: !officialUrl },
  ];
}

function position(menu, x, y) {
  menu.style.display = "block";
  // Measure now that it's visible.
  const r = menu.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let nx = x, ny = y;
  if (nx + r.width  > vw) nx = vw - r.width  - 4;
  if (ny + r.height > vh) ny = vh - r.height - 4;
  if (nx < 4) nx = 4;
  if (ny < 4) ny = 4;
  menu.style.left = `${nx}px`;
  menu.style.top  = `${ny}px`;
}

function render(cert, lang, x, y, currentlySelectedId) {
  const menu = ensureMenu();
  const items = buildItems(cert, lang, currentlySelectedId);
  menu.innerHTML = `
    <div class="ctx-header">${escapeHtml(cert.abbr)}<span class="ctx-vendor">${escapeHtml(cert.vendor?.name || "")}</span></div>
    ${items.map(it => `
      <button type="button" class="ctx-item" data-action="${it.action}" ${it.disabled ? "disabled" : ""}>
        ${escapeHtml(it.label)}
      </button>
    `).join("")}
  `;
  activeCert = cert;
  position(menu, x, y);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function dispatchAction(action) {
  const cert = activeCert;
  hide();
  if (!cert) return;
  if (!actionDispatch) return;
  await actionDispatch(action, cert);
}

/** Wire up the global listeners. Pass:
 *    `getState()`  → returns { byId, ui } at call time
 *    `onAction(action, cert)` → host handles deselect / copy / show / pdf
 */
export function attachContextMenu({ getState: get, onAction }) {
  actionDispatch = onAction;

  document.addEventListener("contextmenu", e => {
    const card = e.target.closest("a.cert-card");
    if (!card) return;
    e.preventDefault();
    const { byId, ui } = get();
    const cert = byId.get(card.dataset.certId);
    if (!cert) return;
    render(cert, ui.labelLang, e.clientX, e.clientY, ui.selectedId);
  });

  document.addEventListener("click", e => {
    if (!menuEl || menuEl.style.display === "none") return;
    const item = e.target.closest(".ctx-item");
    if (item && !item.disabled) {
      e.stopPropagation();
      dispatchAction(item.dataset.action);
      return;
    }
    if (!e.target.closest("#cert-context-menu")) hide();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && menuEl && menuEl.style.display !== "none") {
      hide();
    }
  });

  // Hide on scroll / resize so the menu doesn't drift away from its anchor.
  window.addEventListener("scroll", hide, true);
  window.addEventListener("resize", hide);
}
