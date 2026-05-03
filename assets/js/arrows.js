/**
 * SVG overlay drawing arrows from the selected cert outwards through its
 * prerequisite and successor graphs, up to MAX_DEPTH hops.
 *
 * Edge priority (used for the MAX_VISIBLE_EDGES cap):
 *   1. required        — prereq.required_certs[] entries (hard requirement)
 *   2. official        — recommended_certs[].source == "official-recommended"
 *   3. vendor-ladder   — recommended_certs[].source == "vendor-ladder"
 *   4. community       — recommended_certs[].source == "community"
 *
 * When more than MAX_VISIBLE_EDGES candidate edges exist, lower-priority
 * edges are dropped FIRST. Required edges are never dropped (they are
 * sacred — the user must know about them). Within the same priority,
 * shallower depth wins.
 *
 * Required edges render as a solid, full-opacity, thicker stroke; the
 * three "recommended" sources share the existing depth-based style so
 * the eye can group them together.
 */

const SVG_NS = "http://www.w3.org/2000/svg";
const MAX_DEPTH = 3;
const MAX_VISIBLE_EDGES = 20;

// Lower number = higher priority. Required is the floor; capping never
// touches it.
const SOURCE_RANK = {
  required:               0,
  "official-recommended": 1,
  "vendor-ladder":        2,
  community:              3,
};

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
    // Required-edge marker: full-opacity, slightly larger.
    markers.push(`
      <marker id="arr-${kind}-required" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 12 6 L 0 12 L 3 6 Z" fill="${color}" opacity="1" />
      </marker>
    `);
  }
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

/** Extract id from either a string (legacy) or {id, source?} object. */
function entryId(e) { return typeof e === "string" ? e : e.id; }

/** Return [{id, source}, …] for the cert's prereq neighbors. Required
 *  certs come first, tagged source: "required". */
function prereqNeighbors(cert) {
  const required = (cert.prerequisites?.required_certs || []).map(e => ({
    id: entryId(e), source: "required",
  }));
  const recommended = (cert.prerequisites?.recommended_certs || []).map(e => {
    if (typeof e === "string") return { id: e, source: "vendor-ladder" };  // legacy fallback
    return { id: e.id, source: e.source || "vendor-ladder" };
  });
  return [...required, ...recommended];
}

/** Inverse map: for each cert id, list of {id, source} that point AT it.
 *  This is the successor graph. Source carries the *upstream* relation's
 *  source so the cap can prioritize symmetrically. */
export function buildInverseMap(byId) {
  const inv = new Map();
  for (const id of byId.keys()) inv.set(id, []);
  for (const [downstreamId, c] of byId) {
    for (const n of prereqNeighbors(c)) {
      if (inv.has(n.id)) {
        inv.get(n.id).push({ id: downstreamId, source: n.source });
      }
    }
  }
  return inv;
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
        ? prereqNeighbors(f)
        : (inverseMap.get(fid) || []);
      for (const n of neighbors) {
        if (visited.has(n.id)) continue;
        visited.add(n.id);
        const edge = { depth, kind, source: n.source };
        if (kind === "prereq") { edge.fromId = n.id; edge.toId = fid; }
        else                   { edge.fromId = fid;  edge.toId = n.id; }
        edges.push(edge);
        next.push(n.id);
      }
    }
    frontier = next;
  }
  return edges;
}

/** Compose a sortable priority key — lower = drawn first / kept when capping.
 *
 *    primary  : depth (shallower wins). Connectivity must be preserved —
 *               if we kept a depth-2 edge but dropped its depth-1 parent,
 *               the parent node would render with arrows leaving it but no
 *               arrow reaching it (ORPHAN EDGE BUG, reproduced via
 *               "ipa.ap → CISSP (community, depth 1)" being dropped while
 *               "CISSP → ISSAP/ISSEP/ISSMP (vendor-ladder, depth 2)" was
 *               kept). Depth-first sort guarantees no kept edge is
 *               orphaned: when budget runs out at some depth d, we drop
 *               from depth d+ before dropping anything at depth d-1.
 *    secondary: source rank (required = 0, community = 3) — within the
 *               same depth, higher-trust edges survive first.            */
function priorityKey(edge) {
  const s = SOURCE_RANK[edge.source] ?? 9;
  return edge.depth * 10 + s;
}

/** When the same neighbor cert is reached BOTH as a prereq (in prereq
 *  BFS) AND as a successor (in next BFS), drop the next-direction edge so
 *  only the prereq arrow renders. Otherwise the two arrows overlap with
 *  different colors + dash patterns and produce a confusing "striped"
 *  visual. User-specified resolution: prereq wins.
 *
 *  Per-direction BFS already dedupes within each direction (visited
 *  set), so each non-selected node has at most one prereq edge and at
 *  most one next edge — the filter below preserves at most one entry per
 *  (other-node, kind) pair. */
function dedupeBidirectionalPairs(edges) {
  // For each non-selected node, collect which kinds of edge touch it.
  const otherKinds = new Map();   // otherId → Set<"prereq" | "next">
  for (const e of edges) {
    const other = e.kind === "prereq" ? e.fromId : e.toId;
    if (!otherKinds.has(other)) otherKinds.set(other, new Set());
    otherKinds.get(other).add(e.kind);
  }
  return edges.filter(e => {
    const other = e.kind === "prereq" ? e.fromId : e.toId;
    const kinds = otherKinds.get(other);
    if (kinds.size > 1 && e.kind === "next") return false;   // drop next, keep prereq
    return true;
  });
}

/** Remove edges whose path back to the selected cert is broken because
 *  some intermediate edge was dropped. Walks from each kept edge toward
 *  the selected cert; if the parent edge in its BFS path isn't present,
 *  the edge is an orphan and is dropped.
 *
 *  For prereq edges: parent is the edge whose `toId` matches our `fromId`.
 *  For next   edges: parent is the edge whose `toId` matches our `fromId`.
 *  In both cases, an edge at depth d>1 needs a same-kind edge at depth d-1
 *  whose endpoint matches its origin.
 */
function pruneOrphans(edges, selectedId) {
  // Index kept edges by (kind, toId) for fast parent lookup.
  // For prereq edges going A→B (where B is the SELECTED side of the BFS
  // step), A's depth-d-1 parent is the edge whose `toId === A.fromId`'s
  // BFS-frontier ancestor. Simpler: for kind=prereq the BFS expansion
  // step at depth d looks at f's prereqNeighbors and adds edges with
  // toId=f. So an edge at depth d has fromId = neighbor, toId = f, and
  // f is some node visited at depth d-1. Its parent edge (the one that
  // brought f into the visited set) has toId=f at depth d-1 (or f is the
  // selected node itself, in which case no parent is needed).
  //
  // For kind=next, the expansion at depth d looks at f's inverseMap; the
  // edge added has fromId = f, toId = neighbor. Its parent edge has
  // toId = f at depth d-1.

  // Build set of "reachable nodes from selected" via the kept edges,
  // walking outward from the selected node up to MAX_DEPTH.
  const keptSet = new Set();
  const byKindAndOrigin = { prereq: new Map(), next: new Map() };
  for (const e of edges) {
    // For BFS reachability tracking: the "origin" (the side closer to
    // the selected cert) of the edge.
    //   prereq: edge fromId=neighbor, toId=closer-to-selected → origin = toId
    //   next  : edge fromId=closer-to-selected, toId=neighbor → origin = fromId
    const origin = e.kind === "prereq" ? e.toId : e.fromId;
    if (!byKindAndOrigin[e.kind].has(origin)) byKindAndOrigin[e.kind].set(origin, []);
    byKindAndOrigin[e.kind].get(origin).push(e);
  }

  const out = [];
  // Walk outward from selectedId for each kind, BFS, only following edges
  // present in the kept set. Anything reachable that way is non-orphan.
  for (const kind of ["prereq", "next"]) {
    const visited = new Set([selectedId]);
    let frontier = [selectedId];
    while (frontier.length) {
      const nextFrontier = [];
      for (const node of frontier) {
        const outgoing = byKindAndOrigin[kind].get(node) || [];
        for (const e of outgoing) {
          // The endpoint farther from selected:
          //   prereq: fromId is the prereq (farther)
          //   next  : toId is the successor (farther)
          const farther = e.kind === "prereq" ? e.fromId : e.toId;
          if (visited.has(farther)) continue;
          visited.add(farther);
          out.push(e);
          nextFrontier.push(farther);
        }
      }
      frontier = nextFrontier;
    }
  }
  return out;
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

  let edges = [
    ...bfs(selectedId, byId, inverseMap, "prereq"),
    ...bfs(selectedId, byId, inverseMap, "next"),
  ];

  // Dedupe bidirectional pairs: when the same neighbor cert is reached as
  // BOTH a prereq AND a successor of the selected (possible via multi-hop
  // cycles in the recommended_certs graph), keep only the prereq edge.
  // Without this, both arrows draw on top of each other — solid prereq
  // (blue) underneath + dashed next (green) on top — producing a visually
  // confusing "blue striped" arrow. User preference: prereq wins.
  edges = dedupeBidirectionalPairs(edges);

  // Cap to MAX_VISIBLE_EDGES, dropping lower-priority edges first.
  // Required edges (priority 0 within depth-1) are always retained because
  // they sit at the top of the sorted list and the cap is set well above
  // the typical required-cert count for any single cert.
  edges.sort((a, b) => priorityKey(a) - priorityKey(b));
  if (edges.length > MAX_VISIBLE_EDGES) {
    edges = edges.slice(0, MAX_VISIBLE_EDGES);
  }

  // Defense-in-depth orphan prune: drop any kept edge whose path back to
  // the selected cert isn't fully present. With depth-first priorityKey
  // this should be a no-op; kept here as a safety net so future ordering
  // changes can't reintroduce the orphan-edge visualization bug.
  edges = pruneOrphans(edges, selectedId);

  // Now reverse for drawing order: deeper edges drawn first so shallow
  // ones land on top of them.
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
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("filter", "url(#arr-glow)");

    if (e.source === "required") {
      // Hard prereq — solid, full opacity, thicker.
      path.setAttribute("stroke-width", "2.4");
      path.setAttribute("stroke-opacity", "1");
      path.setAttribute("marker-end", `url(#arr-${e.kind}-required)`);
    } else {
      path.setAttribute("stroke-width",   String(depthStrokeWidth(e.depth)));
      path.setAttribute("stroke-opacity", String(depthOpacity(e.depth)));
      // Successor direction stays dashed; community-source edges get an
      // extra-faint dash so the eye can spot them as "soft" suggestions.
      if (e.kind === "next")             path.setAttribute("stroke-dasharray", "4 5");
      else if (e.source === "community") path.setAttribute("stroke-dasharray", "2 4");
      path.setAttribute("marker-end", `url(#arr-${e.kind}-${e.depth})`);
    }
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
