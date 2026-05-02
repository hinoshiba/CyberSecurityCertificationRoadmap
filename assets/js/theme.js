import { getState, setState, subscribe } from "./url_state.js";

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

function effectiveTheme() {
  const fromUrl = getState().theme;
  if (fromUrl === "light" || fromUrl === "dark") return fromUrl;
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
  return "dark";
}

export function initThemeToggle(btn) {
  // Keep DOM in sync with URL on every state change (covers back/forward too).
  const sync = () => applyTheme(effectiveTheme());
  sync();
  subscribe(sync);

  if (!btn) return;
  btn.addEventListener("click", () => {
    const next = effectiveTheme() === "dark" ? "light" : "dark";
    setState({ theme: next });
  });
}
