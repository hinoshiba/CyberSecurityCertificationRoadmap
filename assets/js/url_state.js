/**
 * Single source of truth for filter / selection state in the URL.
 *
 * Param shape (all optional):
 *   ?theme=light|dark
 *   ?lang=en|ja
 *   ?jp=1                       (show Japan-only certs)
 *   ?v=isc2,offsec,giac         (vendor filter; absent param = no filter; empty = show none)
 *   ?cert=isc2.cissp            (selected cert id)
 *   ?q=GIAC                     (live header search query; matches abbr / name / vendor)
 *   ?vt=10                      (vendor-highlight threshold: tint cards whose
 *                                vendor publishes ≥ vt certs; 0/missing = off)
 *   ?domain=cloud-security      (primary domain)
 *   ?tier=professional          (AI-computed tier)
 *   ?examLang=ja                (recorded exam language code)
 *   ?view=list|map              (default: list)
 *
 * Discrete changes create a history entry. Callers pass { replace: true }
 * for initialization or continued typing within one search session.
 */

const KEYS = ["theme", "lang", "jp", "v", "cert", "q", "vt", "domain", "tier", "examLang", "view"];

function readParams() {
  const sp = new URLSearchParams(window.location.search);
  let vendors = null;
  if (sp.has("v")) {
    vendors = [...new Set((sp.get("v") || "").split(",").map(s => s.trim()).filter(Boolean))];
  }
  let vt = null;
  if (sp.has("vt")) {
    const n = parseInt(sp.get("vt"), 10);
    if (Number.isFinite(n) && n > 0) vt = n;
  }
  return {
    theme:   sp.get("theme") || null,
    lang:    sp.get("lang") || null,
    jp:      sp.get("jp") === "1",
    vendors,
    cert:    sp.get("cert") || null,
    q:       sp.get("q") || "",
    vt,
    domain:   sp.get("domain") || "",
    tier:     sp.get("tier") || "",
    examLang: sp.get("examLang") || "",
    view:     sp.get("view") === "map" ? "map" : "list",
  };
}

function writeParams(state, replace) {
  const sp = new URLSearchParams(window.location.search);
  for (const k of KEYS) sp.delete(k);
  if (state.theme)             sp.set("theme", state.theme);
  if (state.lang)              sp.set("lang", state.lang);
  if (state.jp)                sp.set("jp", "1");
  if (state.vendors !== null && state.vendors !== undefined) {
    sp.set("v", state.vendors.join(","));
  }
  if (state.cert)              sp.set("cert", state.cert);
  if (state.q)                 sp.set("q", state.q);
  if (state.vt && state.vt > 0) sp.set("vt", String(state.vt));
  if (state.domain)           sp.set("domain", state.domain);
  if (state.tier)             sp.set("tier", state.tier);
  if (state.examLang)         sp.set("examLang", state.examLang);
  if (state.view === "map")   sp.set("view", "map");
  const qs = sp.toString();
  const url = window.location.pathname + (qs ? "?" + qs : "") + window.location.hash;
  window.history[replace ? "replaceState" : "pushState"](window.history.state, "", url);
}

const listeners = new Set();

let current = readParams();

export function getState() {
  return { ...current, vendors: current.vendors === null ? null : [...current.vendors] };
}

export function setState(patch, opts = {}) {
  const next = { ...current, ...patch };
  if ("vendors" in patch) {
    next.vendors = patch.vendors == null ? null : Array.from(new Set(patch.vendors));
  }
  for (const key of ["domain", "tier", "examLang", "q"]) next[key] ||= "";
  next.view = next.view === "map" ? "map" : "list";
  // Vendor order has no effect on results. Reapplying the same filters,
  // including an explicit empty vendor selection, should be a no-op.
  const sameVendors = next.vendors === current.vendors || (
    next.vendors !== null && current.vendors !== null &&
    next.vendors.length === current.vendors.length &&
    next.vendors.every(v => current.vendors.includes(v))
  );
  const sameFields = Object.keys(next).every(key => key === "vendors" || next[key] === current[key]);
  if (sameVendors && sameFields) return;
  current = next;
  writeParams(current, opts.replace);
  if (!opts.silent) {
    for (const l of listeners) l(getState());
  }
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

window.addEventListener("popstate", () => {
  current = readParams();
  for (const l of listeners) l(getState());
});

/** A native link keeps display/filter state when opened in another tab. */
export function certHref(id) {
  const params = new URLSearchParams(window.location.search);
  params.set("cert", id);
  return `${window.location.pathname}?${params.toString()}${window.location.hash}`;
}
