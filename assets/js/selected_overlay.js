/**
 * Floating "spotlight" element drawn on top of the arrow SVG so the
 * selected cert's abbreviation stays readable even when many edges
 * converge on the same card.
 *
 * Positioning model: the overlay is an absolutely-positioned child of
 * .grid-and-arrows, so its coordinates are relative to that container's
 * top-left and it scrolls in lock-step with the grid + arrows.
 */

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Slightly outset so the overlay frames the card rather than sitting
 *  flush with its outline (which itself is `outline-offset: 1`). */
const OUTSET = 3;

export function updateSelectedOverlay(overlayEl, gridEl, selectedId, byId) {
  if (!overlayEl) return;
  if (!selectedId || !byId.has(selectedId)) {
    overlayEl.classList.remove("visible");
    overlayEl.setAttribute("aria-hidden", "true");
    overlayEl.innerHTML = "";
    return;
  }
  const card = gridEl.querySelector(`.cert-card[data-cert-id="${CSS.escape(selectedId)}"]`);
  if (!card) {
    overlayEl.classList.remove("visible");
    overlayEl.setAttribute("aria-hidden", "true");
    return;
  }

  const parent = overlayEl.offsetParent || overlayEl.parentElement;
  const cardRect = card.getBoundingClientRect();
  const parentRect = parent.getBoundingClientRect();

  const left = cardRect.left - parentRect.left + parent.scrollLeft - OUTSET;
  const top  = cardRect.top  - parentRect.top  + parent.scrollTop  - OUTSET;

  overlayEl.style.left   = `${left}px`;
  overlayEl.style.top    = `${top}px`;
  overlayEl.style.width  = `${cardRect.width + OUTSET * 2}px`;
  overlayEl.style.height = `${cardRect.height + OUTSET * 2}px`;

  const cert = byId.get(selectedId);
  overlayEl.innerHTML = `<span class="overlay-abbr">${escapeHtml(cert.abbr)}</span>`;
  overlayEl.classList.add("visible");
  overlayEl.setAttribute("aria-hidden", "false");
}
