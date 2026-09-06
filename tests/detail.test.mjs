import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderDetailPanel } from "../assets/js/detail_panel.js";
import { escapeHtml } from "../assets/js/catalog.js";

const base = new URL("../data/", import.meta.url);
const json = async (path) =>
  JSON.parse(await readFile(new URL(path, base), "utf8"));
const manifest = await json("manifest.json");
const certs = await Promise.all(
  manifest.certs.map((entry) => json(entry.path)),
);
const domains = (await json("domains.json")).domains;
const tiers = (await json("tiers.json")).tiers;
const byId = new Map(certs.map((cert) => [cert.id, cert]));
function mockWindow(t, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    value,
    writable: true,
    configurable: true,
  });
  t.after(() =>
    descriptor
      ? Object.defineProperty(globalThis, "window", descriptor)
      : delete globalThis.window,
  );
}
const render = (cert, language = "en", index = byId) => {
  const panel = { innerHTML: "" };
  renderDetailPanel(panel, cert, index, {
    labelLang: language,
    domains,
    tiers,
  });
  return panel.innerHTML;
};

test("every real certification renders in English and Japanese with its official name and evaluation evidence", (t) => {
  mockWindow(t, { location: { search: "?lang=ja&names=1&q=security" } });
  for (const cert of certs)
    for (const language of ["en", "ja"]) {
      const html = render(cert, language);
      assert.ok(html.includes(escapeHtml(cert.abbr)), cert.id);
      assert.ok(
        html.includes(
          escapeHtml(language === "ja" ? cert.name_ja || cert.name : cert.name),
        ),
        cert.id,
      );
      assert.ok(html.includes('id="detail-title"'), cert.id);
      assert.ok(html.includes(escapeHtml(cert.evaluation.rationale)), cert.id);
      for (const entry of cert.prerequisites?.formal || [])
        assert.ok(html.includes(escapeHtml(entry)), cert.id);
      assert.doesNotMatch(html, /\b(?:undefined|NaN)\b/, cert.id);
    }
});

test("zero fees, experience and renewal are preserved distinctly from absent data", (t) => {
  mockWindow(t, { location: { search: "" } });
  const fixture = {
    id: "test.zero",
    abbr: "ZERO",
    name: "Zero values",
    vendor: { name: "Test" },
    logistics: {
      cost_usd: 0,
      duration_min: 0,
      questions: 0,
      renewal_years: 0,
      ce_required: false,
    },
    prerequisites: { experience_years: 0, formal: [] },
  };
  const en = render(fixture);
  assert.match(en, /USD[\s\u00a0]*0/);
  assert.match(en, />0 years</);
  assert.match(en, /No renewal \(0 years\)/);
  assert.match(en, />0 min</);
  assert.match(en, />Not required</);
  assert.match(en, /No formal requirements recorded/);
  const ja = render(fixture, "ja");
  assert.match(ja, />0年</);
  assert.match(ja, /更新なし（0年）/);
  assert.match(
    render({ ...fixture, logistics: {}, prerequisites: {} }),
    />Not recorded</,
  );
});

test("formal prerequisites and required routes remain distinct from provenance-labeled suggestions", (t) => {
  mockWindow(t, { location: { search: "?lang=ja&names=1" } });
  const related = [
    "required",
    "recommended",
    "ladder",
    "community",
    "after",
  ].map((type) => ({
    id: "test." + type,
    abbr: type,
    name: type + " credential",
    vendor: { name: "Test" },
  }));
  const cert = {
    id: "test.current",
    abbr: "CURRENT",
    name: "Current credential",
    prerequisites: {
      formal: ["An endorsement and five years of work are required."],
      required_certs: ["test.required"],
      recommended_certs: [
        {
          id: "test.recommended",
          source: "official-recommended",
          url: "https://example.com/route",
        },
        { id: "test.ladder", source: "vendor-ladder" },
        {
          id: "test.community",
          source: "community",
          rationale: "A useful route for practitioners.",
        },
        { id: "missing.cert", source: "community" },
      ],
    },
  };
  related.at(-1).prerequisites = { required_certs: [cert.id] };
  const index = new Map([...related, cert].map((item) => [item.id, item]));
  const html = render(cert, "en", index);
  for (const value of [
    "An endorsement and five years",
    "Official requirement",
    "Official recommendation",
    "AI-inferred vendor progression",
    "Community suggestion",
    "A useful route for practitioners.",
    "Not yet in this catalog",
    "Explore after this",
    "Relationship source",
  ])
    assert.ok(html.includes(value), value);
  assert.match(html, /data-cert-link="test\.after"/);
  assert.match(html, /lang=ja&amp;names=1&amp;cert=test\.required/);
  assert.match(html, /href="https:\/\/example\.com\/route"/);
});

test("untrusted names, requirements and source text are escaped and unsafe URLs never become links", (t) => {
  mockWindow(t, { location: { search: "" } });
  const attack = '<img src=x onerror="alert(1)">';
  const cert = {
    id: "test.hostile",
    abbr: attack,
    name: attack,
    vendor: { name: attack, url: "javascript:alert(1)" },
    official: {
      exam_url: "data:text/html,<script>alert(1)</script>",
      blueprint_url: "javascript:alert(1)",
    },
    prerequisites: { formal: [attack] },
    sources: [{ name: attack, type: "official", url: "javascript:alert(1)" }],
    evaluation: {
      rationale: attack,
      persona_scores: { reviewer: { rationale: attack } },
    },
    scoring_factors: {
      plus: [
        {
          code: attack,
          weight_hint: attack,
          note: attack,
          evidence: "javascript:alert(1)",
        },
      ],
    },
  };
  const html = render(cert);
  assert.ok(html.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"));
  assert.doesNotMatch(html, /<img|<script|href="(?:javascript|data):/i);
});

test("official, regulator, inspiration-only and evaluation provenance stay visible", (t) => {
  mockWindow(t, { location: { search: "" } });
  const cert = {
    id: "test.sources",
    abbr: "SRC",
    name: "Source evidence",
    sources: [
      { type: "official", url: "https://issuer.example/exam", use: "data" },
      { type: "regulator", url: "https://regulator.example/qualification" },
      {
        type: "third_party",
        url: "https://inspiration.example/map",
        use: "inspiration_only",
      },
    ],
    third_party_evaluations: [
      {
        source_id: "agency-id",
        level_hint: "professional",
        summary: "Agency assessment",
        url: "https://agency.example/evaluation",
        fetched_at: "2026-05-02",
      },
    ],
    scoring_factors: {
      plus: [
        {
          code: "HANDS_ON_EXAM",
          weight_hint: "high",
          note: "Practical assessment",
        },
      ],
      minus: [{ code: "VENDOR_SPECIFIC", weight_hint: "low" }],
    },
    evaluation: {
      computed_tier: "professional",
      computed_at: "2026-05-02T00:00:00Z",
      computed_by_skill: "three-personas@1",
      rationale: "Consensus",
      persona_scores: {
        "sample-reviewer": {
          tier: "professional",
          rationale: "A documented perspective",
        },
      },
    },
  };
  const html = render(cert);
  for (const value of [
    "Official issuer",
    "Regulator",
    "Inspiration only",
    "agency-id",
    "Agency assessment",
    "HANDS_ON_EXAM",
    "VENDOR_SPECIFIC",
    "Practical assessment",
    "three-personas@1",
    "A documented perspective",
    "UTC",
  ])
    assert.ok(html.includes(value), value);
});

test("clearing the selected certification clears the old detail content", () => {
  const panel = { innerHTML: "previous content" };
  renderDetailPanel(panel, null, byId);
  assert.equal(panel.innerHTML, "");
});
