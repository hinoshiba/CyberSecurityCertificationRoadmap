import test from "node:test";
import assert from "node:assert/strict";
import {
  parseState,
  serializeState,
  getState,
  setState,
  subscribe,
} from "../assets/js/url_state.js";

test("defaults and invalid discrete values remain usable", () => {
  assert.deepEqual(parseState(""), {
    theme: null,
    lang: "en",
    jp: false,
    vendors: null,
    cert: null,
    q: "",
    vt: null,
    domain: "",
    level: "",
    view: "map",
    sort: "level",
    names: false,
  });
  const invalid = parseState(
    "?theme=neon&lang=xx&jp=true&vt=-1&view=wrong&sort=cost&names=yes",
  );
  assert.equal(invalid.theme, null);
  assert.equal(invalid.lang, "en");
  assert.equal(invalid.jp, false);
  assert.equal(invalid.vt, null);
  assert.equal(invalid.view, "map");
  assert.equal(invalid.sort, "level");
  assert.equal(invalid.names, false);
  for (const value of ["NaN", "Infinity", "1.5", "0", "-8"])
    assert.equal(parseState("?vt=" + value).vt, null);
});

test("links round-trip every discovery setting including full names and Japanese queries", () => {
  const state = {
    theme: "dark",
    lang: "ja",
    jp: true,
    vendors: ["ipa", "isc2"],
    cert: "isc2.cissp",
    q: "情報 security+",
    vt: 12,
    domain: "governance-risk",
    level: "expert",
    view: "explore",
    sort: "vendor",
    names: true,
  };
  const serialized = serializeState(state);
  assert.deepEqual(parseState(serialized), state);
  assert.equal(new URLSearchParams(serialized).get("cert"), "isc2.cissp");
});

test("empty provider selection survives sharing and duplicate vendors are normalized", () => {
  const none = parseState("?v=");
  assert.deepEqual(none.vendors, []);
  assert.deepEqual(parseState(serializeState(none)).vendors, []);
  assert.equal(
    parseState(serializeState({ ...none, vendors: null })).vendors,
    null,
  );
  assert.deepEqual(parseState("?v=ipa,ipa,%20isc2,%20").vendors, [
    "ipa",
    "isc2",
  ]);
});

test("serialization preserves unknown URL parameters and clears replaced known state", () => {
  const value = serializeState(
    parseState(""),
    "?utm_source=community&custom=a%2Bb&cert=old&names=1&q=old",
  );
  const query = new URLSearchParams(value);
  assert.equal(query.get("utm_source"), "community");
  assert.equal(query.get("custom"), "a+b");
  assert.equal(query.has("cert"), false);
  assert.equal(query.has("names"), false);
  assert.equal(query.has("q"), false);
  // Unknown catalog identities are preserved so the application can report stale links.
  assert.equal(
    parseState("?cert=unknown.cert&d=unknown-domain").cert,
    "unknown.cert",
  );
  assert.equal(parseState("?d=unknown-domain").domain, "unknown-domain");
});

test("state subscriptions and snapshots do not leak mutable vendor arrays", () => {
  const events = [];
  const off = subscribe((state) => events.push(state));
  setState({ q: "CISSP", vendors: ["isc2"] });
  const snapshot = getState();
  snapshot.vendors.push("comptia");
  assert.deepEqual(getState().vendors, ["isc2"]);
  assert.equal(events.length, 1);
  setState({ q: "CC" }, { silent: true });
  assert.equal(events.length, 1);
  off();
  setState({ q: "" });
  assert.equal(events.length, 1);
});
