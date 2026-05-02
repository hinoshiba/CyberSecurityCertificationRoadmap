/**
 * Build / dataset version. Populated by .github/workflows/pages.yml at deploy
 * time; in local dev the file holds {"commit":"dev",...}. UI shows it in the
 * About footer and PNG/PDF exports bake it into their captured footer line so
 * anyone receiving an export knows when it was generated and from which commit.
 */

let cached = null;

export async function loadVersion() {
  if (cached) return cached;
  try {
    const res = await fetch("assets/version.json", { cache: "no-cache" });
    if (res.ok) {
      cached = await res.json();
      return cached;
    }
  } catch (_) { /* fall through */ }
  cached = { commit: "dev", commit_short: "dev", commit_url: null, build_date: "dev", dataset_updated: "dev" };
  return cached;
}

export function versionLabel(v) {
  if (!v) return "";
  const dataset = v.dataset_updated && v.dataset_updated !== "dev" ? v.dataset_updated : "local";
  const commit  = v.commit_short && v.commit_short !== "dev" ? v.commit_short : "dev";
  return `data ${dataset} · build ${commit}`;
}
