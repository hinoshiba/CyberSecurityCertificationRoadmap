function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function tierOf(cert) {
  return cert?.evaluation?.computed_tier || "specialty";
}

/**
 * Build a vendor list for the filter panel: { slug, name, count } sorted by count desc.
 * Counts are taken from the FULL cert set (not filtered) so the panel is stable.
 */
export function vendorIndex(allCerts) {
  const map = new Map();
  for (const c of allCerts) {
    const slug = c.vendor?.slug;
    if (!slug) continue;
    if (!map.has(slug)) map.set(slug, { slug, name: c.vendor.name, count: 0 });
    map.get(slug).count++;
  }
  return Array.from(map.values()).sort((a, b) =>
    b.count - a.count || a.name.localeCompare(b.name));
}

export function renderGrid(root, domains, tiers, certs, ui) {
  root.innerHTML = "";
  const lang = ui.labelLang === "ja" ? "ja" : "en";

  // Responsive 100% width:
  //   80px tier-label + 12 equal-fraction columns at minmax(70px, 1fr).
  // 70px floor accommodates one 60px card per row plus padding, so cards
  // wrap onto multiple rows in dense cells rather than pushing the matrix
  // wider than the viewport. Total min: 80 + 12×70 = 920px (fits standard
  // laptops); on FHD/2K each column expands to fit 2-3 cards per row.
  root.style.gridTemplateColumns =
    `80px repeat(${domains.length}, minmax(70px, 1fr))`;

  // Header row
  const corner = document.createElement("div");
  corner.className = "corner";
  corner.textContent = "Tier ↓ / Domain →";
  root.appendChild(corner);

  for (const d of domains) {
    const h = document.createElement("div");
    h.className = "domain-head";
    const label = lang === "ja" ? (d.label_ja || d.label_en) : d.label_en;
    h.innerHTML = `
      <span class="swatch" style="background:${escapeHtml(d.color || "#888")}"></span>
      <span class="label">${escapeHtml(label)}</span>
    `;
    root.appendChild(h);
  }

  // Bucket certs into (tier, domain) cells.
  const buckets = new Map();
  for (const t of tiers) {
    for (const d of domains) buckets.set(`${t.id}|${d.id}`, []);
  }
  for (const c of certs) {
    const key = `${tierOf(c)}|${c.domain}`;
    if (buckets.has(key)) buckets.get(key).push(c);
  }
  for (const list of buckets.values()) {
    list.sort((a, b) => {
      if (!!a.japan_only !== !!b.japan_only) return a.japan_only ? 1 : -1;
      return (a.abbr || "").localeCompare(b.abbr || "");
    });
  }

  // Body rows
  for (const t of tiers) {
    const tierLabel = lang === "ja" ? (t.label_ja || t.label_en) : t.label_en;

    const head = document.createElement("div");
    head.className = "tier-head";
    head.dataset.tier = t.id;
    head.textContent = tierLabel;
    root.appendChild(head);

    for (const d of domains) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.tier = t.id;
      cell.dataset.domain = d.id;

      const list = buckets.get(`${t.id}|${d.id}`) || [];
      if (list.length === 0) cell.classList.add("empty");

      for (const c of list) {
        const card = document.createElement("a");
        const availability = c.availability || "available";
        const classes = ["cert-card"];
        if (c.japan_only) classes.push("jp");
        if (availability !== "available") classes.push("unavail", `unavail-${availability}`);
        if (ui.selectedId === c.id) classes.push("selected");
        card.className = classes.join(" ");
        // Bookmarkable link with both ?cert= AND #anchor for completeness.
        card.href = `?cert=${encodeURIComponent(c.id)}`;
        card.dataset.certId = c.id;
        // Hover title carries vendor + full name since the compact card hides them.
        const availSuffix = availability !== "available" ? `  [${availability.toUpperCase()}]` : "";
        card.title = `${c.abbr} (${c.vendor?.name || ""}) — ${c.name}${availSuffix}`;
        card.innerHTML = `<span class="abbr">${escapeHtml(c.abbr)}</span>`;
        cell.appendChild(card);
      }
      root.appendChild(cell);
    }
  }
}
