async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-cache" });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}
/** Fail visibly instead of silently presenting an incomplete roadmap as complete. */
export async function loadAll(manifestPath) {
  const manifest = await fetchJson(manifestPath);
  const base = manifestPath.replace(/[^/]+$/, "");
  const [domains, tiers] = await Promise.all([
    fetchJson(base + manifest.domains_path),
    fetchJson(base + manifest.tiers_path),
  ]);
  const entries = manifest.certs || [];
  if (!entries.length) throw new Error("The catalog manifest is empty.");
  const certs = new Array(entries.length);
  let cursor = 0;
  // Bound requests to avoid flooding a mobile connection with 317 concurrent fetches.
  await Promise.all(
    Array.from({ length: Math.min(12, entries.length) }, async () => {
      while (cursor < entries.length) {
        const index = cursor++;
        const cert = await fetchJson(base + entries[index].path);
        if (cert.id !== entries[index].id)
          throw new Error(`Certification ID mismatch: ${entries[index].path}`);
        certs[index] = cert;
      }
    }),
  );
  return {
    domains: domains.domains,
    tiers: tiers.tiers.sort((a, b) => a.order - b.order),
    certs,
  };
}
