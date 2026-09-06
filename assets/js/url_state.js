/** Bookmarkable state. Discrete navigation pushes history; text search replaces it. */
const KEYS = [
  "theme",
  "lang",
  "jp",
  "v",
  "cert",
  "q",
  "vt",
  "d",
  "level",
  "view",
  "sort",
  "names",
];
export function parseState(search) {
  const sp = new URLSearchParams(search);
  const vt = Number(sp.get("vt"));
  return {
    theme: ["light", "dark"].includes(sp.get("theme")) ? sp.get("theme") : null,
    lang: sp.get("lang") === "ja" ? "ja" : "en",
    jp: sp.get("jp") === "1",
    vendors: sp.has("v")
      ? [
          ...new Set(
            (sp.get("v") || "")
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean),
          ),
        ]
      : null,
    cert: sp.get("cert") || null,
    q: sp.get("q") || "",
    vt: Number.isInteger(vt) && vt > 0 ? vt : null,
    domain: sp.get("d") || "",
    level: sp.get("level") || "",
    view: sp.get("view") === "explore" ? "explore" : "map",
    sort: ["level", "name", "vendor"].includes(sp.get("sort"))
      ? sp.get("sort")
      : "level",
    names: sp.get("names") === "1",
  };
}
export function serializeState(state, search = "") {
  const sp = new URLSearchParams(search);
  KEYS.forEach((k) => sp.delete(k));
  if (state.theme) sp.set("theme", state.theme);
  if (state.lang === "ja") sp.set("lang", "ja");
  if (state.jp) sp.set("jp", "1");
  if (state.vendors != null) sp.set("v", [...new Set(state.vendors)].join(","));
  if (state.cert) sp.set("cert", state.cert);
  if (state.q) sp.set("q", state.q);
  if (state.vt > 0) sp.set("vt", String(state.vt));
  if (state.domain) sp.set("d", state.domain);
  if (state.level) sp.set("level", state.level);
  if (state.view === "explore") sp.set("view", "explore");
  if (state.sort && state.sort !== "level") sp.set("sort", state.sort);
  if (state.names) sp.set("names", "1");
  const query = sp.toString();
  return query ? "?" + query : "";
}
const listeners = new Set();
let current = parseState(
  typeof window === "undefined" ? "" : window.location.search,
);
export const getState = () => ({
  ...current,
  vendors: current.vendors == null ? null : [...current.vendors],
});
export function setState(patch, opts = {}) {
  current = { ...current, ...patch };
  if (typeof window !== "undefined") {
    const url =
      window.location.pathname +
      serializeState(current, window.location.search) +
      window.location.hash;
    if (
      url !==
      window.location.pathname + window.location.search + window.location.hash
    ) {
      window.history[opts.replace ? "replaceState" : "pushState"](
        null,
        "",
        url,
      );
    }
  }
  if (!opts.silent) listeners.forEach((fn) => fn(getState()));
}
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
if (typeof window !== "undefined")
  window.addEventListener("popstate", () => {
    current = parseState(window.location.search);
    listeners.forEach((fn) => fn(getState()));
  });
