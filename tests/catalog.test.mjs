import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { matchCertIds } from "../assets/js/search.js";
import {
  filterCatalog,
  sortCatalog,
  matrixGroups,
  vendorIndex,
  certName,
  label,
} from "../assets/js/catalog.js";

const base = new URL("../data/", import.meta.url);
const json = async (path) =>
  JSON.parse(await readFile(new URL(path, base), "utf8"));
const manifest = await json("manifest.json");
const certs = await Promise.all(
  manifest.certs.map((entry) => json(entry.path)),
);
const state = {
  jp: true,
  vendors: null,
  q: "",
  domain: "",
  level: "",
  view: "map",
};
const ids = (entries) => entries.map((entry) => entry.id);

test("search accepts normalized mixed-width text and requires every term across name/vendor fields", () => {
  const source = [
    {
      id: "a",
      abbr: "AWS Security",
      name: "Cloud Specialist",
      name_ja: "クラウド資格",
      vendor: { name: "Amazon", slug: "aws" },
    },
    {
      id: "b",
      abbr: "Azure",
      name: "Security Engineer",
      vendor: { name: "Microsoft" },
    },
  ];
  assert.deepEqual([...matchCertIds(source, "ＡＷＳ　ＳＥＣ")], ["a"]);
  assert.deepEqual([...matchCertIds(source, "amazon specialist")], ["a"]);
  assert.deepEqual([...matchCertIds(source, "クラウド")], ["a"]);
  assert.deepEqual([...matchCertIds(source, "AWS Microsoft")], []);
  assert.equal(matchCertIds(source, " \n\t "), null);
});

test("search excludes evaluation prose and source metadata from discovery results", () => {
  assert.deepEqual(
    [
      ...matchCertIds(
        [
          {
            id: "a",
            name: "Basic Security",
            evaluation: { rationale: "needle" },
            sources: [{ url: "https://needle.test" }],
          },
        ],
        "needle",
      ),
    ],
    [],
  );
});

test("Japan and vendor filters distinguish all providers from an intentional empty selection", () => {
  const full = filterCatalog(certs, state);
  assert.equal(full.length, manifest.certs.length);
  const international = filterCatalog(certs, { ...state, jp: false });
  assert.ok(international.length > 0 && international.length < full.length);
  assert.ok(international.every((cert) => !cert.japan_only));
  assert.deepEqual(filterCatalog(certs, { ...state, vendors: [] }), []);
  const comptia = filterCatalog(certs, { ...state, vendors: ["comptia"] });
  assert.ok(comptia.length > 0);
  assert.ok(comptia.every((cert) => cert.vendor.slug === "comptia"));
  assert.deepEqual(
    filterCatalog(certs, { ...state, vendors: ["not-a-provider"] }),
    [],
  );
});

test("roadmap uses primary domains while Explore includes related domains", () => {
  const securityPlus = certs.find(
    (cert) => cert.id === "comptia.security-plus",
  );
  assert.ok(securityPlus.secondary_domains.includes("network-defense"));
  const scoped = { ...state, q: "Security+", domain: "network-defense" };
  assert.ok(!ids(filterCatalog(certs, scoped)).includes(securityPlus.id));
  assert.ok(
    ids(filterCatalog(certs, { ...scoped, view: "explore" })).includes(
      securityPlus.id,
    ),
  );
  assert.ok(
    ids(filterCatalog(certs, scoped, { overview: true })).includes(
      securityPlus.id,
    ),
  );
  const foundational = filterCatalog(certs, {
    ...state,
    level: "foundational",
  });
  assert.ok(foundational.length > 0);
  assert.ok(
    foundational.every(
      (cert) => cert.evaluation.computed_tier === "foundational",
    ),
  );
});

test("sorting puts introductory learning first and specialty last, without mutating input", () => {
  const fixtures = [
    "specialty",
    "expert",
    "introductory",
    "professional",
    "associate",
    "foundational",
  ].map((tier, index) => ({
    id: String(index),
    abbr: String(index),
    name: String(index),
    evaluation: { computed_tier: tier },
  }));
  const before = structuredClone(fixtures);
  assert.deepEqual(
    sortCatalog(fixtures).map((cert) => cert.evaluation.computed_tier),
    [
      "introductory",
      "foundational",
      "associate",
      "professional",
      "expert",
      "specialty",
    ],
  );
  assert.deepEqual(fixtures, before);
  const inputIds = ids(certs);
  sortCatalog(certs, "name", "ja");
  sortCatalog(certs, "vendor");
  assert.deepEqual(ids(certs), inputIds);
  assert.equal(
    sortCatalog([{ name: "Item 10" }, { name: "Item 2" }], "name")[0].name,
    "Item 2",
  );
});

test("every real certification occupies exactly one primary-domain matrix cell", () => {
  const grouped = matrixGroups(certs);
  const flattened = [...grouped.values()].flat();
  assert.equal(flattened.length, certs.length);
  assert.equal(new Set(ids(flattened)).size, certs.length);
  for (const [key, items] of grouped) {
    for (const cert of items)
      assert.equal(key, `${cert.evaluation.computed_tier}|${cert.domain}`);
  }
  const vendors = vendorIndex(certs);
  assert.equal(
    vendors.reduce((sum, vendor) => sum + vendor.count, 0),
    certs.length,
  );
});

test("localized naming preserves official fallback labels", () => {
  assert.equal(
    certName({ name: "Original", name_ja: "日本語" }, "ja"),
    "日本語",
  );
  assert.equal(certName({ name: "Original" }, "ja"), "Original");
  assert.equal(label({ id: "test", label_en: "English" }, "ja"), "English");
});
