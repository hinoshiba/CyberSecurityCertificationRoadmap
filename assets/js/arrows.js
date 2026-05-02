/**
 * SVG overlay drawing arrows from the selected cert outwards through its
 * prerequisite and successor graphs, up to MAX_DEPTH hops.
 *
 * Modern visual style: thinner strokes, subtle glow filter, soft saturated
 * colors that read on both dark and light themes.
 */

const SVG_NS = "http://www.w3.org/2000/svg";
const MAX_DEPTH = 3;

/** Read arrow palette from CSS variables so it tracks the active theme.
 *  Recomputed on every drawArrows() call so theme switches show up
 *  without needing a manual subscriber. */
function arrowColors() {
  const root = getComputedStyle(document.documentElement);
  return {
    prereq: (root.getPropertyValue("--rel-prereq").trim()) || "#818cf8",
    next:   (root.getPropertyValue("--rel-next").trim())   || "#34d399",
  };
}

function clearSvg(svg) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
}

function buildDefs(colors) {
  const defs = document.createElementNS(SVG_NS, "defs");
  const markers = [];
  for (const kind of ["prereq", "next"]) {
    const color = colors[kind];
    for (let d = 1; d <= MAX_DEPTH; d++) {
      const opacity = depthOpacity(d);
      markers.push(`
        <marker id="arr-${kind}-${d}" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 12 6 L 0 12 L 3 6 Z" fill="${color}" opacity="${opacity}" />
        </marker>
      `);
    }
  }
  // Subtle glow filter so arrows lift off dim cards.
  markers.push(`
    <filter id="arr-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="1.4" result="b" />
      <feMerge>
        <feMergeNode in="b" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  `);
  defs.innerHTML = markers.join("");
  return defs;
}

function depthOpacity(d) {
  return [null, 1.0, 0.60, 0.32][d] ?? 0.20;
}

function depthStrokeWidth(d) {
  return [null, 1.8, 1.2, 0.8][d] ?? 0.6;
}

function cardCenter(cardEl, originRect) {
  const r = cardEl.getBoundingClientRect();
  return {
    x: r.left - originRect.left + r.width / 2,
    y: r.top  - originRect.top  + r.height / 2,
  };
}

function smoothPath(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;
  const bend = Math.min(56, dist * 0.18);
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const px = -dy / dist;
  const py =  dx / dist;
  const cx = mx + px * bend;
  const cy = my + py * bend;
  return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
}

function bfs(startId, byId, inverseMap, kind) {
  const edges = [];
  const visited = new Set([startId]);
  let frontier = [startId];
  for (let depth = 1; depth <= MAX_DEPTH; depth++) {
    const next = [];
    for (const fid of frontier) {
      const f = byId.get(fid);
      if (!f) continue;
      const neighbors = (kind === "prereq")
        ? (f.prerequisites?.recommended_certs || [])
        : (inverseMap.get(fid) || []);
      for (const nid of neighbors) {
        if (visited.has(nid)) continue;
        visited.add(nid);
        if (kind === "prereq") edges.push({ fromId: nid, toId: fid, depth, kind });
        else                   edges.push({ fromId: fid, toId: nid, depth, kind });
        next.push(nid);
      }
    }
    frontier = next;
  }
  return edges;
}

export function buildInverseMap(byId) {
  const inv = new Map();
  for (const id of byId.keys()) inv.set(id, []);
  for (const [id, c] of byId) {
    for (const pid of (c.prerequisites?.recommended_certs || [])) {
      if (inv.has(pid)) inv.get(pid).push(id);
    }
  }
  return inv;
}

export function drawArrows(svg, gridEl, selectedId, byId, inverseMap) {
  clearSvg(svg);
  for (const c of gridEl.querySelectorAll(".rel-prereq, .rel-next, .rel-d2, .rel-d3")) {
    c.classList.remove("rel-prereq", "rel-next", "rel-d2", "rel-d3");
  }
  if (!selectedId) {
    svg.style.width = "0";
    svg.style.height = "0";
    return;
  }
  if (!byId.has(selectedId)) return;

  const selCard = gridEl.querySelector(`.cert-card[data-cert-id="${CSS.escape(selectedId)}"]`);
  if (!selCard) return;

  svg.style.width  = `${gridEl.scrollWidth}px`;
  svg.style.height = `${gridEl.scrollHeight}px`;
  const colors = arrowColors();
  svg.appendChild(buildDefs(colors));

  const origin = gridEl.getBoundingClientRect();

  const edges = [
    ...bfs(selectedId, byId, inverseMap, "prereq"),
    ...bfs(selectedId, byId, inverseMap, "next"),
  ];
  edges.sort((a, b) => b.depth - a.depth);

  for (const e of edges) {
    const fromCard = gridEl.querySelector(`.cert-card[data-cert-id="${CSS.escape(e.fromId)}"]`);
    const toCard   = gridEl.querySelector(`.cert-card[data-cert-id="${CSS.escape(e.toId)}"]`);
    if (!fromCard || !toCard) continue;
    const a = cardCenter(fromCard, origin);
    const b = cardCenter(toCard,   origin);
    const color = colors[e.kind];

    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", smoothPath(a, b));
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", color);
    path.setAttribute("stroke-width", String(depthStrokeWidth(e.depth)));
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("stroke-opacity", String(depthOpacity(e.depth)));
    if (e.kind === "next") path.setAttribute("stroke-dasharray", "4 5");
    path.setAttribute("filter", "url(#arr-glow)");
    path.setAttribute("marker-end", `url(#arr-${e.kind}-${e.depth})`);
    svg.appendChild(path);

    const otherId = e.kind === "prereq" ? e.fromId : e.toId;
    const otherCard = gridEl.querySelector(`.cert-card[data-cert-id="${CSS.escape(otherId)}"]`);
    if (otherCard) {
      otherCard.classList.add(e.kind === "prereq" ? "rel-prereq" : "rel-next");
      if (e.depth === 2) otherCard.classList.add("rel-d2");
      if (e.depth === 3) otherCard.classList.add("rel-d3");
    }
  }
}
