import test from "node:test";
import assert from "node:assert/strict";
import { loadAll } from "../assets/js/loader.js";

function fixture(count = 1) {
  const entries = Array.from({ length: count }, (_, index) => ({
    id: `vendor.cert-${index}`,
    path: `certs/${index}.json`,
  }));
  const routes = new Map([
    [
      "data/manifest.json",
      {
        domains_path: "domains.json",
        tiers_path: "tiers.json",
        certs: entries,
      },
    ],
    ["data/domains.json", { domains: [{ id: "domain" }] }],
    [
      "data/tiers.json",
      {
        tiers: [
          { id: "base", order: 2 },
          { id: "expert", order: 1 },
        ],
      },
    ],
    ...entries.map((entry) => ["data/" + entry.path, { id: entry.id }]),
  ]);
  return { entries, routes };
}
const response = (data) => ({
  ok: true,
  status: 200,
  json: async () => structuredClone(data),
});

test("loader returns the complete catalog in manifest order and bounds concurrent cert requests to 12", async (t) => {
  const { entries, routes } = fixture(37);
  let active = 0,
    maximum = 0;
  const requested = [];
  t.mock.method(globalThis, "fetch", async (path, options) => {
    requested.push(path);
    assert.equal(options.cache, "no-cache");
    assert.ok(routes.has(path), path);
    if (path.includes("/certs/")) {
      maximum = Math.max(maximum, ++active);
      await new Promise((resolve) => setImmediate(resolve));
      active--;
    }
    return response(routes.get(path));
  });
  const result = await loadAll("data/manifest.json");
  assert.deepEqual(
    result.certs.map((cert) => cert.id),
    entries.map((entry) => entry.id),
  );
  assert.equal(new Set(requested).size, 40);
  assert.ok(maximum > 1, "loads certificates concurrently");
  assert.ok(maximum <= 12, "keeps the request budget suitable for mobile");
  assert.equal(active, 0);
  assert.deepEqual(
    result.tiers.map((tier) => tier.id),
    ["expert", "base"],
  );
});

test("one failed certification rejects the roadmap instead of reporting partial success", async (t) => {
  const { routes } = fixture();
  t.mock.method(globalThis, "fetch", async (path) =>
    path.endsWith("/0.json")
      ? { ok: false, status: 503 }
      : response(routes.get(path)),
  );
  await assert.rejects(
    loadAll("data/manifest.json"),
    /certs\/0\.json: HTTP 503/,
  );
});

test("loader rejects a cert whose ID disagrees with its manifest entry", async (t) => {
  const { routes } = fixture();
  routes.set("data/certs/0.json", { id: "wrong.identity" });
  t.mock.method(globalThis, "fetch", async (path) =>
    response(routes.get(path)),
  );
  await assert.rejects(
    loadAll("data/manifest.json"),
    /Certification ID mismatch/,
  );
});

test("empty manifest and unavailable structural data fail visibly", async (t) => {
  const { routes } = fixture(0);
  t.mock.method(globalThis, "fetch", async (path) =>
    response(routes.get(path)),
  );
  await assert.rejects(loadAll("data/manifest.json"), /manifest is empty/);
  globalThis.fetch = async (path) =>
    path.endsWith("domains.json")
      ? { ok: false, status: 404 }
      : response(routes.get(path));
  await assert.rejects(
    loadAll("data/manifest.json"),
    /domains\.json: HTTP 404/,
  );
});

test("transport and invalid JSON failures propagate to the retry state", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("offline");
  });
  await assert.rejects(loadAll("data/manifest.json"), /offline/);
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => {
      throw new SyntaxError("invalid JSON");
    },
  });
  await assert.rejects(loadAll("data/manifest.json"), /invalid JSON/);
});
