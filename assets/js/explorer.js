import { applyFilters } from "./filter.js";

const COPY = {
  ja: {
    vendor: "認定団体",
    domain: "主分野",
    tier: "Tier（AI評価の目安）",
    languages: "受験言語（記録済み）",
    availability: "受付状況",
    unknown: "記録なし",
    japanOnly: "日本限定資格",
    details: "詳細を見る",
    map: "図で見る",
    noResults: "一致する資格がありません",
    reduceFilters: "検索語を短くするか、分野・Tier・認定団体などの条件を減らしてください。",
    reset: "検索・絞り込みを解除",
    includeJp: "日本限定資格を追加して探す",
    jpMatches: count => `同じ条件で一致する日本限定資格が ${count} 件あります。`,
    overview: "主分野を選ぶ",
    overviewNote: "気になる分野から資格を探せます。件数は現在の表示条件に一致する資格です。",
    count: count => `${count} 件`,
    available: "受付中",
    paused: "一時停止",
    retired: "終了",
    "coming-soon": "開始予定",
  },
  en: {
    vendor: "Certification body",
    domain: "Primary domain",
    tier: "Tier (AI estimate)",
    languages: "Exam languages (recorded)",
    availability: "Availability",
    unknown: "Unknown",
    japanOnly: "Japan-only",
    details: "View details",
    map: "View on map",
    noResults: "No certifications match",
    reduceFilters: "Try a shorter search or remove a domain, tier, certification body, or another filter.",
    reset: "Clear search and filters",
    includeJp: "Include Japan-only certifications",
    jpMatches: count => `${count} Japan-only certification${count === 1 ? " matches" : "s match"} the same filters.`,
    overview: "Choose a primary domain",
    overviewNote: "Start with an area that interests you. Counts reflect certifications matching the current filters.",
    count: count => `${count} certification${count === 1 ? "" : "s"}`,
    available: "Available",
    paused: "Paused",
    retired: "Retired",
    "coming-soon": "Coming soon",
  },
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function localizedLabel(item, lang) {
  return item?.[`label_${lang}`] || item?.label_en || item?.id || "";
}

function domainColor(domain) {
  return /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(domain?.color || "")
    ? domain.color : "#607d8b";
}

function languageLabels(codes, lang, unknown) {
  if (!Array.isArray(codes) || codes.length === 0) return unknown;
  let names;
  try {
    names = new Intl.DisplayNames([lang], { type: "language" });
  } catch {
    // Keep the recorded code readable on browsers without DisplayNames.
  }
  return [...new Set(codes)].map(code => {
    try { return names?.of(code) || code; }
    catch { return code; }
  }).join(lang === "ja" ? "、" : ", ");
}

function fact(label, value) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

/** Render the already-filtered result set. All actions are delegated by app.js. */
export function renderExplorer(root, { certs, allCerts, domains, tiers, ui }) {
  const lang = ui.labelLang === "ja" ? "ja" : "en";
  const copy = COPY[lang];
  if (!certs.length) {
    // Relax only the JP switch; query and every other filter remain active.
    const hiddenJp = !ui.showJp
      ? applyFilters(allCerts, { ...ui, showJp: true }).filter(cert => cert.japan_only).length
      : 0;
    root.innerHTML = `<section class="empty-results">
      <h3>${copy.noResults}</h3>
      <p>${copy.reduceFilters}</p>
      ${hiddenJp ? `<p>${escapeHtml(copy.jpMatches(hiddenJp))}</p>` : ""}
      <div class="result-actions">
        ${hiddenJp ? `<button type="button" data-include-jp>${copy.includeJp}</button>` : ""}
        <button type="button" data-reset-filters>${copy.reset}</button>
      </div>
    </section>`;
    return;
  }

  const domainById = new Map(domains.map(domain => [domain.id, domain]));
  const tierById = new Map(tiers.map(tier => [tier.id, tier]));
  root.innerHTML = certs.map(cert => {
    const domain = domainById.get(cert.domain);
    const tier = tierById.get(cert.evaluation?.computed_tier);
    const name = lang === "ja" ? (cert.name_ja || cert.name) : cert.name;
    const alternate = lang === "ja" ? cert.name : cert.name_ja;
    // The existing roadmap treats an omitted availability as available.
    const availability = cert.availability || "available";
    const availabilityLabel = copy[availability] || copy.unknown;
    const availabilityBadge = ["paused", "retired", "coming-soon"].includes(availability);
    const id = escapeHtml(cert.id);
    const abbr = escapeHtml(cert.abbr || name);
    return `<article class="result-card${ui.selectedId === cert.id ? " is-selected" : ""}" data-result-id="${id}" style="--domain-color:${domainColor(domain)}">
      <div class="result-card-head">
        <h3>${abbr}</h3>
        ${cert.japan_only ? `<span class="result-jp-badge">${copy.japanOnly}</span>` : ""}
      </div>
      <p class="result-name" lang="${lang === "ja" && cert.name_ja ? "ja" : "en"}">${escapeHtml(name)}</p>
      ${alternate && alternate !== name ? `<p class="result-name-alternate" lang="${lang === "ja" ? "en" : "ja"}">${escapeHtml(alternate)}</p>` : ""}
      <dl class="result-facts">
        ${fact(copy.vendor, cert.vendor?.name || copy.unknown)}
        ${fact(copy.domain, localizedLabel(domain, lang) || cert.domain || copy.unknown)}
        ${fact(copy.tier, localizedLabel(tier, lang) || copy.unknown)}
        ${fact(copy.languages, languageLabels(cert.logistics?.languages, lang, copy.unknown))}
        <div class="result-availability"><dt>${copy.availability}</dt><dd>${availabilityBadge ? `<span class="avail-badge avail-${availability}">${escapeHtml(availabilityLabel)}</span>` : escapeHtml(availabilityLabel)}</dd></div>
      </dl>
      <div class="result-actions">
        <button type="button" data-detail-id="${id}" aria-label="${abbr}: ${copy.details}">${copy.details}</button>
        <button type="button" data-map-id="${id}" aria-label="${abbr}: ${copy.map}">${copy.map}</button>
      </div>
    </article>`;
  }).join("");
}

/** A compact, readable entry point into the twelve primary domains. */
export function renderDomainOverview(root, { certs, domains, tiers, ui }) {
  const lang = ui.labelLang === "ja" ? "ja" : "en";
  const copy = COPY[lang];
  const counts = new Map(domains.map(domain => [domain.id, 0]));
  for (const cert of certs) {
    if (counts.has(cert.domain)) counts.set(cert.domain, counts.get(cert.domain) + 1);
  }
  root.innerHTML = `<div class="domain-overview-head">
      <h2>${copy.overview}</h2>
      <p>${copy.overviewNote}</p>
    </div>
    <div class="domain-overview-grid">
      ${domains.map(domain => {
        const label = localizedLabel(domain, lang);
        const count = counts.get(domain.id) || 0;
        return `<button type="button" class="domain-overview-card" data-domain-id="${escapeHtml(domain.id)}" aria-pressed="${ui.domain === domain.id}" style="--domain-color:${domainColor(domain)}">
          <span class="domain-overview-label">${escapeHtml(label)}</span>
          <span class="domain-overview-count">${escapeHtml(copy.count(count))}</span>
        </button>`;
      }).join("")}
    </div>`;
}
