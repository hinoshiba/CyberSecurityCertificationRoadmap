/**
 * PNG export of the matrix (with arrows for the current selection).
 *
 * html2canvas captures .grid-and-arrows with the SVG VISIBLE. We
 * temporarily strip the SVG `filter` attributes (the Gaussian-blur glow
 * is what html2canvas chokes on) so paths and markers render at their
 * correct grid coordinates. The caller redraws arrows for the current
 * selection RIGHT BEFORE capture so the SVG matches the export-width
 * grid layout exactly.
 *
 * A footer band is composited under the matrix with credit + dataset
 * version + commit + generation timestamp.
 */

import { loadVersion, versionLabel } from "./version.js";

const HTML2CANVAS_SRC = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";

const FOOTER_TEXT = "Cyber Security Certification Roadmap · by hinoshiba · built with Claude";

const FONT_FAMILY = `-apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", sans-serif`;

/* ---------------- Helpers ---------------- */

function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[data-src="${src}"]`)) return res();
    const s = document.createElement("script");
    s.src = src;
    s.dataset.src = src;
    s.async = true;
    s.onload  = () => res();
    s.onerror = () => rej(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

function bg() {
  return resolveCssColor(getComputedStyle(document.body).getPropertyValue("background-color")) || "#0e1117";
}

/** Convert ANY valid CSS color expression — hex, rgb(), rgba(), hsl(),
 *  color-mix(), color(srgb …), named colors — to a plain "rgba(r, g, b, a)"
 *  string that legacy parsers (notably html2canvas v1.4) can handle.
 *  Done via a 1x1 canvas pixel readback so the browser does the work. */
function resolveCssColor(cssColor) {
  if (!cssColor) return cssColor;
  const s = String(cssColor).trim();
  if (/^#|^rgb\(|^rgba\(/i.test(s)) return s;
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "rgba(0,0,0,0)";
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = s;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
  } catch (_) {
    return s;
  }
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1500);
}

function timestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function generationLine(v) {
  const dt = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
  return [
    `${window.location.origin}${window.location.pathname}`,
    versionLabel(v),
    `generated ${dt}`,
  ].filter(Boolean).join("  ·  ");
}

/* ---------------- Matrix capture (with arrows) ----------------
 *
 * Exports use a FIXED virtual canvas size (FHD) regardless of the
 * user's actual viewport. This makes coordinates deterministic — a
 * 1366px viewport and a 4K viewport produce the same export.
 */

const EXPORT_WIDTH_FHD = 1920;
const EXPORT_WIDTH     = EXPORT_WIDTH_FHD;

async function captureMatrixWithArrows(redrawArrows) {
  const wrap       = document.querySelector(".grid-and-arrows");
  const matrixWrap = document.querySelector(".matrix-wrap");
  const svg        = document.getElementById("arrows-overlay");
  if (!wrap || !matrixWrap) throw new Error("matrix not found");

  const origMatrix = matrixWrap.style.cssText;
  const origBody   = document.body.style.cssText;
  const scrollX    = matrixWrap.scrollLeft;
  const scrollY    = matrixWrap.scrollTop;

  document.body.style.overflowX = "hidden";
  matrixWrap.style.width    = `${EXPORT_WIDTH}px`;
  matrixWrap.style.maxWidth = "none";
  matrixWrap.style.minWidth = `${EXPORT_WIDTH}px`;
  matrixWrap.style.overflow = "visible";

  await new Promise(r => requestAnimationFrame(r));
  if (typeof redrawArrows === "function") {
    redrawArrows();
    await new Promise(r => requestAnimationFrame(r));
  }

  const filteredEls = svg ? Array.from(svg.querySelectorAll("[filter]")) : [];
  const restored = filteredEls.map(el => [el, el.getAttribute("filter")]);
  for (const el of filteredEls) el.removeAttribute("filter");

  let canvas;
  try {
    canvas = await window.html2canvas(wrap, {
      backgroundColor: bg(),
      scale: 2,
      useCORS: true,
      width:  wrap.scrollWidth,
      height: wrap.scrollHeight,
      windowWidth:  wrap.scrollWidth,
      windowHeight: wrap.scrollHeight,
      onclone: (doc) => {
        // html2canvas v1.4 cannot parse modern CSS color-mix() / color()
        // functions used in our cell tier-tinted backgrounds. Pre-resolve
        // each tier's background to a flat rgba() via canvas pixel readback
        // and pin it as inline style on every clone cell.
        const tierBg = {};
        for (const tier of ["introductory","foundational","associate","professional","expert","specialty"]) {
          const live = document.querySelector(`.cell[data-tier="${tier}"]`);
          if (live) tierBg[tier] = resolveCssColor(getComputedStyle(live).backgroundColor);
        }
        for (const el of doc.querySelectorAll(".cell[data-tier]")) {
          const bg = tierBg[el.dataset.tier];
          if (bg) el.style.backgroundColor = bg;
        }

        // Flatten sticky positioning so headers land at the top of the
        // capture rather than at the user's current scroll offset.
        for (const el of doc.querySelectorAll(".corner, .domain-head, .tier-head")) {
          el.style.position = "static";
        }
        // Hide chrome that shouldn't appear in the export.
        for (const el of doc.querySelectorAll(".topbar, .controls, .about, .detail-panel, .vendor-panel, .show-details-cta")) {
          el.style.display = "none";
        }
        // Mirror the SVG's style.width/height onto the actual SVG attributes.
        const cs = doc.getElementById("arrows-overlay");
        if (cs) {
          const w = parseFloat(cs.style.width);
          const h = parseFloat(cs.style.height);
          if (w) cs.setAttribute("width",  String(w));
          if (h) cs.setAttribute("height", String(h));
        }
      },
    });
  } finally {
    for (const [el, val] of restored) el.setAttribute("filter", val);
    matrixWrap.style.cssText = origMatrix;
    document.body.style.cssText = origBody;
    matrixWrap.scrollLeft = scrollX;
    matrixWrap.scrollTop  = scrollY;
    if (typeof redrawArrows === "function") {
      await new Promise(r => requestAnimationFrame(r));
      redrawArrows();
    }
  }
  return canvas;
}

/* ---------------- Footer band ---------------- */

function withFooter(canvas, v) {
  const SCALE = 2;
  const PAD_X = 18 * SCALE;
  const FONT_PX  = 16 * SCALE;
  const SUB_PX   = 12 * SCALE;
  const FOOTER_H = 70 * SCALE;

  const out = document.createElement("canvas");
  out.width  = canvas.width;
  out.height = canvas.height + FOOTER_H;
  const ctx  = out.getContext("2d");

  ctx.fillStyle = bg();
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(canvas, 0, 0);

  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(0, canvas.height, out.width, FOOTER_H);

  ctx.strokeStyle = "rgba(88,166,255,0.8)";
  ctx.lineWidth = 2 * SCALE;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height + 1);
  ctx.lineTo(out.width, canvas.height + 1);
  ctx.stroke();

  ctx.fillStyle = "#e6edf3";
  ctx.font = `600 ${FONT_PX}px ${FONT_FAMILY}`;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(FOOTER_TEXT, PAD_X, canvas.height + 14 * SCALE);

  ctx.fillStyle = "#8b949e";
  ctx.font = `400 ${SUB_PX}px ${FONT_FAMILY}`;
  ctx.fillText(generationLine(v), PAD_X, canvas.height + 38 * SCALE);

  return out;
}

/* ---------------- Public ---------------- */

export async function exportMatrixPNG(redrawArrows) {
  await loadScript(HTML2CANVAS_SRC);
  const v = await loadVersion();
  const matrix = await captureMatrixWithArrows(redrawArrows);
  const final  = withFooter(matrix, v);
  await new Promise(res => final.toBlob(blob => {
    downloadBlob(blob, `roadmap-${timestamp()}.png`);
    res();
  }, "image/png"));
}
