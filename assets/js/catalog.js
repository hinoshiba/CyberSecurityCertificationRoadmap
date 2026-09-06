import { matchCertIds } from "./search.js";

export const LEVEL_ORDER = [
  "introductory",
  "foundational",
  "associate",
  "professional",
  "expert",
  "specialty",
];
export const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const label = (item, lang) =>
  item?.[lang === "ja" ? "label_ja" : "label_en"] ||
  item?.label_en ||
  item?.id ||
  "";
export const certName = (cert, lang) =>
  lang === "ja" && cert.name_ja ? cert.name_ja : cert.name;
export const certTier = (cert) => cert.evaluation?.computed_tier || "unrated";
export function filterCatalog(certs, state, { overview = false } = {}) {
  const matches = matchCertIds(certs, state.q);
  const vendors = state.vendors == null ? null : new Set(state.vendors);
  return certs.filter(
    (c) =>
      (state.jp || !c.japan_only) &&
      (!vendors || vendors.has(c.vendor?.slug)) &&
      (!matches || matches.has(c.id)) &&
      (overview ||
        !state.domain ||
        c.domain === state.domain ||
        (state.view !== "map" &&
          (c.secondary_domains || []).includes(state.domain))) &&
      (overview || !state.level || certTier(c) === state.level),
  );
}
export function sortCatalog(certs, sort = "level", lang = "en") {
  const collator = new Intl.Collator(lang, {
    numeric: true,
    sensitivity: "base",
  });
  return [...certs].sort((a, b) => {
    if (sort === "vendor")
      return (
        collator.compare(a.vendor?.name || "", b.vendor?.name || "") ||
        collator.compare(a.abbr, b.abbr)
      );
    if (sort === "name")
      return collator.compare(certName(a, lang), certName(b, lang));
    const rank = (id) =>
      LEVEL_ORDER.includes(id) ? LEVEL_ORDER.indexOf(id) : LEVEL_ORDER.length;
    return (
      rank(certTier(a)) - rank(certTier(b)) || collator.compare(a.abbr, b.abbr)
    );
  });
}
export function vendorIndex(certs) {
  const entries = new Map();
  for (const c of certs) {
    const slug = c.vendor?.slug;
    if (!slug) continue;
    if (!entries.has(slug))
      entries.set(slug, { slug, name: c.vendor.name, count: 0 });
    entries.get(slug).count++;
  }
  return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name));
}
export function matrixGroups(certs) {
  const groups = new Map();
  for (const c of certs) {
    const key = `${certTier(c)}|${c.domain}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  return groups;
}
