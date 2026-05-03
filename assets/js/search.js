/**
 * Lightweight cert search — matches a query against the noise-free fields
 * the user is most likely to type (abbreviation, English name, Japanese
 * name, vendor name in either language). Intentionally NOT included:
 * scoring_factors, sources, third-party evals, rationales — those produce
 * too many spurious matches.
 *
 * The match set is exposed as a Set<cert.id> via `matchCertIds()`. The
 * renderer uses that to apply `.search-match` class on cards; a body
 * class `has-search` enables the dim-non-matches visual.
 */

function normalize(s) {
  if (!s) return "";
  return String(s).toLowerCase().normalize("NFKC");
}

/** Build the searchable haystack for one cert (lowercased, NFKC-normalized,
 *  joined with "|" so substring matching across fields still works). */
function haystack(cert) {
  const parts = [
    cert.abbr,
    cert.name,
    cert.name_ja,
    cert.vendor?.name,
    cert.vendor?.slug,
  ].filter(Boolean);
  return parts.map(normalize).join("|");
}

/** Returns Set<cert.id> for certs matching `query`. Empty/whitespace
 *  query returns null (caller should treat as "no search active"). */
export function matchCertIds(allCerts, query) {
  const q = normalize(query).trim();
  if (!q) return null;
  // Split on whitespace so "AWS sec" matches certs containing both terms
  // in any of the searchable fields.
  const terms = q.split(/\s+/).filter(Boolean);
  const out = new Set();
  for (const c of allCerts) {
    const hay = haystack(c);
    if (terms.every(t => hay.includes(t))) out.add(c.id);
  }
  return out;
}
