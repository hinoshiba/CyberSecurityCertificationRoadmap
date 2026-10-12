import test from "node:test";
import assert from "node:assert/strict";

// Model browser history, including actual URL movement and popstate. Each
// test gets a fresh module/window so no state leaks between scenarios.
function browserAt(initial = "https://example.test/roadmap/") {
  const entries = [new URL(initial)];
  const listeners = new Map();
  const writes = [];
  let index = 0;
  const move = amount => {
    const next = index + amount;
    if (next < 0 || next >= entries.length) return;
    index = next;
    for (const listener of listeners.get("popstate") || []) listener({ type: "popstate" });
  };
  const browser = {
    get location() { return entries[index]; },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    writes,
    history: {
      state: { retained: true },
      get length() { return entries.length; },
      pushState(state, title, url) {
        entries.splice(index + 1);
        entries.push(new URL(url, entries[index]));
        index += 1;
        this.state = state;
        writes.push("push");
      },
      replaceState(state, title, url) {
        entries[index] = new URL(url, entries[index]);
        this.state = state;
        writes.push("replace");
      },
      back() { move(-1); },
      forward() { move(1); },
    },
  };
  globalThis.window = browser;
  return browser;
}

let moduleId = 0;
async function stateAt(url) {
  const browser = browserAt(url);
  const state = await import(`../assets/js/url_state.js?test=${moduleId++}`);
  return { browser, ...state };
}

browserAt();
const { applyFilters } = await import("../assets/js/filter.js");
const { matchCertIds } = await import("../assets/js/search.js");

const certs = [
  {
    id: "isc2.cissp", abbr: "CISSP",
    name: "Certified Information Systems Security Professional",
    name_ja: "情報システムセキュリティプロフェッショナル認定",
    vendor: { slug: "isc2", name: "ISC2" },
    domain: "governance-risk", secondary_domains: ["cloud-security"],
    evaluation: { computed_tier: "expert" },
    logistics: { languages: ["en", "ja", "pt-BR"] },
  },
  {
    id: "aws.security", abbr: "SCS",
    name: "AWS Certified Security Specialty",
    vendor: { slug: "aws", name: "Amazon Web Services" },
    domain: "cloud-security", evaluation: { computed_tier: "professional" },
    logistics: { languages: ["en", "ja"] },
  },
  {
    id: "ipa.sc", abbr: "SC", name: "Information Security Exam",
    name_ja: "情報処理安全確保支援士試験", japan_only: true,
    vendor: { slug: "ipa", name: "IPA", name_ja: "情報処理推進機構" },
    domain: "cloud-security", evaluation: { computed_tier: "professional" },
    logistics: { languages: ["ja"] },
  },
  {
    id: "other.unknown", abbr: "UNKNOWN", name: "Unknown exam logistics",
    vendor: { slug: "other", name: "Other" }, domain: "cloud-security",
  },
];
const ids = list => list.map(cert => cert.id);
const base = { showJp: true, vendors: null };

test("search normalizes compatibility characters before case-folding and ANDs terms", () => {
  assert.deepEqual([...matchCertIds(certs, "𝐂𝐈𝐒𝐒𝐏")], ["isc2.cissp"]);
  assert.deepEqual([...matchCertIds(certs, "　ＡＷＳ　　security \t")], ["aws.security"]);
  assert.deepEqual([...matchCertIds(certs, "ISC2 情報システム")], ["isc2.cissp"]);
  assert.deepEqual([...matchCertIds(certs, "情報処理推進機構 支援士")], ["ipa.sc"]);
  assert.equal(matchCertIds(certs, " \t　"), null);
  assert.equal(matchCertIds(certs, "CISSP missing-term").size, 0);
});

test("filters intersect JP, vendor, primary domain, tier, exam language, and search", () => {
  const filtered = applyFilters(certs, {
    showJp: false, vendors: ["aws", "ipa"], domain: "cloud-security",
    tier: "professional", examLang: "ja", searchQuery: "security",
  });
  assert.deepEqual(ids(filtered), ["aws.security"]);
  assert.deepEqual(ids(applyFilters(certs, { ...base, domain: "cloud-security" })),
    ["aws.security", "ipa.sc", "other.unknown"]);
  assert.deepEqual(ids(applyFilters(certs, { ...base, tier: "specialty" })), ["other.unknown"]);
});

test("missing language facts do not imply availability, and language codes remain exact", () => {
  assert.deepEqual(ids(applyFilters(certs, { ...base, examLang: "pt-BR" })), ["isc2.cissp"]);
  assert.deepEqual(ids(applyFilters(certs, { ...base, examLang: "en" })), ["isc2.cissp", "aws.security"]);
  assert.deepEqual(applyFilters(certs, { ...base, examLang: "pt" }), []);
});

test("empty vendor selection and zero-match searches produce no results", () => {
  assert.deepEqual(applyFilters(certs, { ...base, vendors: [] }), []);
  assert.deepEqual(applyFilters(certs, { ...base, searchQuery: "does-not-exist" }), []);
  assert.equal(applyFilters(certs, base).length, certs.length);
  assert.equal(applyFilters(certs, { showJp: true }).length, certs.length);
});

test("legacy URLs retain theme, language, JP, explicit empty vendors, selection, q, and vt", async () => {
  const { browser, getState, setState } = await stateAt(
    "https://example.test/roadmap/?theme=light&lang=ja&jp=1&v=&cert=isc2.cissp&q=CISSP&vt=10&campaign=guide#about"
  );
  assert.deepEqual(getState(), {
    theme: "light", lang: "ja", jp: true, vendors: [], cert: "isc2.cissp", q: "CISSP", vt: 10,
    domain: "", tier: "", examLang: "", view: "list",
  });
  setState({ domain: "governance-risk", tier: "expert", examLang: "ja", view: "map" });
  const sp = browser.location.searchParams;
  for (const [key, value] of Object.entries({
    theme: "light", lang: "ja", jp: "1", v: "", cert: "isc2.cissp", q: "CISSP", vt: "10",
    domain: "governance-risk", tier: "expert", examLang: "ja", view: "map", campaign: "guide",
  })) assert.equal(sp.get(key), value, key);
  assert.equal(browser.location.hash, "#about");
  assert.deepEqual(browser.history.state, { retained: true });
  assert.deepEqual(browser.writes, ["push"]);
});

test("new filters round-trip from a bookmarked URL and default to list", async () => {
  const { getState } = await stateAt(
    "https://example.test/roadmap/?domain=cloud-security&tier=professional&examLang=pt-BR&view=map&v=aws,aws,isc2"
  );
  assert.deepEqual(getState(), {
    theme: null, lang: null, jp: false, vendors: ["aws", "isc2"], cert: null, q: "", vt: null,
    domain: "cloud-security", tier: "professional", examLang: "pt-BR", view: "map",
  });
  const { getState: invalidState } = await stateAt("https://example.test/roadmap/?view=unexpected&vt=0");
  assert.equal(invalidState().view, "list");
  assert.equal(invalidState().vt, null);
});

test("search typing replaces its own entry while discrete filters support back and forward", async () => {
  const { browser, getState, setState, subscribe } = await stateAt();
  const observed = [];
  subscribe(state => observed.push({ q: state.q, tier: state.tier }));
  setState({ q: "C" });
  setState({ q: "CI" }, { replace: true });
  setState({ q: "CISSP" }, { replace: true });
  setState({ tier: "expert" });
  assert.equal(browser.history.length, 3);
  assert.deepEqual(browser.writes, ["push", "replace", "replace", "push"]);
  browser.history.back();
  assert.equal(getState().q, "CISSP");
  assert.equal(getState().tier, "");
  browser.history.back();
  assert.equal(getState().q, "");
  browser.history.forward();
  browser.history.forward();
  assert.equal(getState().q, "CISSP");
  assert.equal(getState().tier, "expert");
  assert.deepEqual(observed.slice(-4), [
    { q: "CISSP", tier: "" }, { q: "", tier: "" },
    { q: "CISSP", tier: "" }, { q: "CISSP", tier: "expert" },
  ]);
});

test("reset clears filter params, preserves display preferences and restores through history", async () => {
  const { browser, getState, setState } = await stateAt(
    "https://example.test/roadmap/?theme=dark&lang=ja&jp=1&v=&q=test&domain=iam&tier=expert&examLang=ja&view=map&source=link#roadmap"
  );
  setState({ vendors: null, q: "", domain: "", tier: "", examLang: "" });
  for (const key of ["v", "q", "domain", "tier", "examLang"]) {
    assert.equal(browser.location.searchParams.has(key), false, key);
  }
  assert.equal(browser.location.searchParams.get("theme"), "dark");
  assert.equal(browser.location.searchParams.get("lang"), "ja");
  assert.equal(browser.location.searchParams.get("jp"), "1");
  assert.equal(browser.location.searchParams.get("view"), "map");
  assert.equal(browser.location.searchParams.get("source"), "link");
  assert.equal(browser.location.hash, "#roadmap");
  browser.history.back();
  assert.deepEqual(getState().vendors, []);
  assert.equal(getState().q, "test");
  browser.history.forward();
  assert.equal(getState().vendors, null);
  assert.equal(getState().q, "");
});

test("no-op state updates do not create history entries or duplicate notifications", async () => {
  const { browser, setState, subscribe } = await stateAt("https://example.test/roadmap/?v=aws,isc2");
  let notifications = 0;
  subscribe(() => notifications++);
  setState({ vendors: ["isc2", "aws", "aws"] });
  setState({ view: "list", q: "", domain: "" });
  assert.equal(browser.history.length, 1);
  assert.equal(notifications, 0);
  setState({ vendors: [] });
  setState({ vendors: [] });
  assert.equal(browser.history.length, 2);
  assert.equal(notifications, 1);
});

test("silent replacement, unsubscribe, and copied state protect subscription behavior", async () => {
  const { browser, getState, setState, subscribe } = await stateAt();
  let notifications = 0;
  const stop = subscribe(state => { notifications++; state.vendors?.push("mutated"); });
  setState({ vendors: ["aws"] }, { silent: true, replace: true });
  assert.equal(notifications, 0);
  assert.equal(browser.history.length, 1);
  assert.deepEqual(browser.writes, ["replace"]);
  const copy = getState();
  copy.vendors.push("isc2");
  assert.deepEqual(getState().vendors, ["aws"]);
  setState({ tier: "professional" });
  assert.equal(notifications, 1);
  assert.deepEqual(getState().vendors, ["aws"]);
  stop();
  setState({ tier: "expert" });
  assert.equal(notifications, 1);
});

test("native cert links retain display preferences, filters, unknown parameters, and hash", async () => {
  const { certHref, browser } = await stateAt("https://example.test/roadmap/?theme=light&lang=ja&jp=1&v=isc2&q=CISSP&domain=governance-risk&campaign=test#about");
  const link = new URL(certHref("isc2.cc"), browser.location);
  assert.equal(link.pathname, "/roadmap/");
  assert.equal(link.searchParams.get("cert"), "isc2.cc");
  for (const key of ["theme", "lang", "jp", "v", "q", "domain", "campaign"]) {
    assert.equal(link.searchParams.get(key), browser.location.searchParams.get(key));
  }
  assert.equal(link.hash, "#about");
  assert.equal(browser.writes.length, 0);
});
