import { t } from "./i18n.js";

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function tierOf(cert) {
  return cert?.evaluation?.computed_tier || "specialty";
}

const DOMAIN_SHORT = {
  "governance-risk": "GRC",
  "security-architecture": "Arc",
  iam: "IAM",
  "network-defense": "Net",
  "endpoint-mobile": "End",
  "cloud-security": "Cld",
  "application-appsec": "App",
  "offensive-redteam": "Red",
  "incident-forensics": "IR",
  "threat-intel": "CTI",
  "ot-ics-iot": "OT",
  "privacy-data-protection": "Pri",
};

const TIER_SHORT_EN = {
  specialty: "Spec",
  expert: "Exp",
  professional: "Pro",
  associate: "Assoc",
  foundational: "Found",
  introductory: "Intro",
};

const TIER_SHORT_JA = {
  specialty: "特化",
  expert: "上級",
  professional: "プロ",
  associate: "中級",
  foundational: "基礎",
  introductory: "入門",
};

function shortDomainLabel(domain) {
  return DOMAIN_SHORT[domain.id] || domain.id.slice(0, 4);
}

function shortTierLabel(tier, lang) {
  const map = lang === "ja" ? TIER_SHORT_JA : TIER_SHORT_EN;
  return map[tier.id] || (lang === "ja" ? (tier.label_ja || tier.label_en) : tier.label_en).slice(0, 5);
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

  // Vendor-highlight: tint cards whose vendor publishes ≥ threshold certs.
  // The count is over the FULL (unfiltered) cert set so toggling JP / vendor
  // filters doesn't change which vendors qualify — the threshold reflects
  // the vendor's portfolio breadth, not what's currently visible.
  const vt = Number.isFinite(ui.vendorThreshold) && ui.vendorThreshold > 0
    ? ui.vendorThreshold : 0;
  const vendorCounts = ui.vendorCounts || new Map();
  const isProminent = slug => vt > 0 && (vendorCounts.get(slug) || 0) >= vt;

  // Per-domain cert counts → sqrt-weighted column fractions.
  // Domains with many certs (governance-risk has 76) get more horizontal
  // space than sparse domains (threat-intel has 7) without dominating —
  // sqrt softens the spread so the densest column is ~3× the sparsest
  // rather than ~10× under linear weighting. Each column still has a
  // minmax floor so single-card cells stay readable.
  const countsByDomain = new Map(domains.map(d => [d.id, 0]));
  for (const c of certs) {
    if (countsByDomain.has(c.domain)) {
      countsByDomain.set(c.domain, countsByDomain.get(c.domain) + 1);
    }
  }
  const fractions = domains.map(d => {
    const n = countsByDomain.get(d.id) || 0;
    // sqrt with a floor of 4 so a 0-cert domain doesn't collapse and a
    // 1-cert domain still gets a sane minimum width. Multiplied so the
    // numbers are >1 (CSS rounds 0.x fr unpredictably across browsers).
    return Math.max(2, Math.sqrt(Math.max(n, 4)) * 1.4);
  });
  const colTemplate = fractions
    .map(f => `minmax(56px, ${f.toFixed(2)}fr)`)
    .join(" ");
  // 70px tier-label column + N proportional domain columns. 70 leaves
  // enough room for the longest tier label "プロフェッショナル" without
  // ugly wrapping at the new smaller tier-head font size.
  root.style.gridTemplateColumns = `70px ${colTemplate}`;

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

  const overview = document.createElement("section");
  overview.className = "mobile-overview";
  overview.setAttribute("aria-label", t("overview_aria", lang));
  overview.innerHTML = `
    <div class="mobile-overview-head">
      <span class="mobile-overview-title">${escapeHtml(t("overview_title", lang))}</span>
      <span class="mobile-overview-note">${escapeHtml(t("overview_note", lang))}</span>
    </div>
  `;
  const overviewGrid = document.createElement("div");
  overviewGrid.className = "mobile-overview-grid";
  overviewGrid.style.setProperty("--overview-domain-count", domains.length);

  const overviewCorner = document.createElement("div");
  overviewCorner.className = "overview-corner";
  overviewCorner.textContent = t("overview_tier_axis", lang);
  overviewGrid.appendChild(overviewCorner);
  for (const d of domains) {
    const h = document.createElement("div");
    h.className = "overview-domain";
    h.title = lang === "ja" ? (d.label_ja || d.label_en) : d.label_en;
    h.style.setProperty("--domain-color", d.color || "#888");
    h.textContent = shortDomainLabel(d);
    overviewGrid.appendChild(h);
  }

  for (const t of tiers) {
    const tierLabel = lang === "ja" ? (t.label_ja || t.label_en) : t.label_en;
    const rowHead = document.createElement("div");
    rowHead.className = "overview-tier";
    rowHead.dataset.tier = t.id;
    rowHead.textContent = shortTierLabel(t, lang);
    rowHead.title = tierLabel;
    overviewGrid.appendChild(rowHead);

    for (const d of domains) {
      const domainLabel = lang === "ja" ? (d.label_ja || d.label_en) : d.label_en;
      const list = buckets.get(`${t.id}|${d.id}`) || [];
      const count = list.length;
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "overview-cell";
      cell.dataset.overviewTier = t.id;
      cell.dataset.overviewDomain = d.id;
      cell.style.setProperty("--domain-color", d.color || "#888");
      cell.style.setProperty("--density", `${Math.min(72, 14 + count * 4)}%`);
      cell.title = `${tierLabel} / ${domainLabel}: ${count}`;
      cell.setAttribute("aria-label", `${tierLabel} / ${domainLabel}: ${count}`);
      if (count === 0) {
        cell.classList.add("empty");
        cell.disabled = true;
      } else {
        cell.textContent = count > 99 ? "99+" : String(count);
      }
      if (list.some(c => c.id === ui.selectedId)) cell.classList.add("selected");
      overviewGrid.appendChild(cell);
    }
  }
  overview.appendChild(overviewGrid);
  root.appendChild(overview);

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
      cell.dataset.domainLabel = lang === "ja" ? (d.label_ja || d.label_en) : d.label_en;
      cell.style.setProperty("--domain-color", d.color || "#888");

      const list = buckets.get(`${t.id}|${d.id}`) || [];
      if (list.length === 0) cell.classList.add("empty");
      // Density-adaptive sizing: thresholds tuned from the actual data
      // distribution where the densest cell holds ~26 certs and most
      // populated cells hold 5–13. The classes shrink card width / height
      // / font-size proportionally in CSS.
      else if (list.length >= 18) cell.classList.add("cell-very-dense");
      else if (list.length >= 10) cell.classList.add("cell-dense");
      else if (list.length >= 5)  cell.classList.add("cell-medium");

      for (const c of list) {
        const card = document.createElement("a");
        const availability = c.availability || "available";
        const classes = ["cert-card"];
        if (c.japan_only) classes.push("jp");
        if (availability !== "available") classes.push("unavail", `unavail-${availability}`);
        if (ui.selectedId === c.id) classes.push("selected");
        if (isProminent(c.vendor?.slug)) classes.push("vendor-prominent");
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
