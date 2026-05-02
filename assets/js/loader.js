async function fetchJson(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

export async function loadAll(manifestPath) {
  const manifest = await fetchJson(manifestPath);
  const baseDir  = manifestPath.replace(/[^/]+$/, "");

  const [domainsDoc, tiersDoc] = await Promise.all([
    fetchJson(baseDir + manifest.domains_path),
    fetchJson(baseDir + manifest.tiers_path)
  ]);

  const certResults = await Promise.allSettled(
    (manifest.certs || []).map(entry => fetchJson(baseDir + entry.path))
  );

  const certs = [];
  for (const r of certResults) {
    if (r.status === "fulfilled") certs.push(r.value);
    else console.warn("cert fetch failed:", r.reason);
  }

  return {
    domains: domainsDoc.domains,
    tiers:   tiersDoc.tiers.sort((a, b) => a.order - b.order),
    certs
  };
}
