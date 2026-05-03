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
 *
 * Updates use history.replaceState so the back/forward stack isn't polluted
 * with every keystroke; the URL still bookmarks correctly.
 */

const KEYS = ["theme", "lang", "jp", "v", "cert", "q"];

function readParams() {
  const sp = new URLSearchParams(window.location.search);
  let vendors = null;
  if (sp.has("v")) {
    vendors = (sp.get("v") || "").split(",").map(s => s.trim()).filter(Boolean);
  }
  return {
    theme:   sp.get("theme") || null,
    lang:    sp.get("lang") || null,
    jp:      sp.get("jp") === "1",
    vendors,
    cert:    sp.get("cert") || null,
    q:       sp.get("q") || "",
  };
}

function writeParams(state) {
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
  const qs = sp.toString();
  const url = window.location.pathname + (qs ? "?" + qs : "") + window.location.hash;
  window.history.replaceState(null, "", url);
}

const listeners = new Set();

let current = readParams();

export function getState() {
  return { ...current, vendors: current.vendors === null ? null : [...current.vendors] };
}

export function setState(patch, opts = {}) {
  const next = { ...current, ...patch };
  if ("vendors" in patch) {
    next.vendors = patch.vendors === null ? null : Array.from(new Set(patch.vendors));
  }
  current = next;
  writeParams(current);
  if (!opts.silent) {
    for (const l of listeners) l(current);
  }
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

window.addEventListener("popstate", () => {
  current = readParams();
  for (const l of listeners) l(current);
});
