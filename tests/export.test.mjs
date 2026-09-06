import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { exportRoadmapPNG } from "../assets/js/export.js";

const base = new URL("../data/", import.meta.url);
const json = async (path) =>
  JSON.parse(await readFile(new URL(path, base), "utf8"));
const manifest = await json("manifest.json");
const certs = await Promise.all(
  manifest.certs.map((entry) => json(entry.path)),
);
const domains = (await json("domains.json")).domains;
const tiers = (await json("tiers.json")).tiers;

function replaceGlobal(t, name, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, {
    value,
    writable: true,
    configurable: true,
  });
  t.after(() =>
    descriptor
      ? Object.defineProperty(globalThis, name, descriptor)
      : delete globalThis[name],
  );
}

function browser(
  t,
  {
    blobFailure = false,
    contextFailure = false,
    clickFailure = false,
    encodeFailure = false,
  } = {},
) {
  const text = [],
    downloads = [],
    revoked = [],
    timers = [],
    urls = [];
  let removed = 0;
  const context = {
    font: "",
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    measureText(value) {
      return { width: [...String(value)].length * 7 };
    },
    fillRect() {},
    strokeRect() {},
    fillText(value, x, y) {
      text.push({ text: String(value), font: this.font, x, y });
    },
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => (contextFailure ? null : context),
    toBlob(callback, type) {
      assert.equal(type, "image/png");
      if (encodeFailure) throw new Error("encoder failed");
      callback(
        blobFailure ? null : new Blob(["PNG data"], { type: "image/png" }),
      );
    },
  };
  replaceGlobal(t, "document", {
    fonts: { ready: Promise.resolve() },
    body: { appendChild() {} },
    createElement(tag) {
      if (tag === "canvas") return canvas;
      assert.equal(tag, "a");
      return {
        click() {
          if (clickFailure) throw new Error("download blocked");
          downloads.push({ href: this.href, name: this.download });
        },
        remove() {
          removed++;
        },
      };
    },
  });
  replaceGlobal(t, "window", {
    location: {
      origin: "https://example.com",
      pathname: "/roadmap/",
      search: "?jp=1",
      hash: "#workspace",
    },
  });
  t.mock.method(globalThis, "fetch", async (path) => {
    assert.equal(
      path,
      "assets/version.json",
      "export must not fetch external libraries",
    );
    return {
      ok: true,
      json: async () => ({
        dataset_updated: "2026-05-02",
        commit_short: "abc123",
      }),
    };
  });
  t.mock.method(URL, "createObjectURL", (blob) => {
    assert.ok(blob.size > 0);
    const url = "blob:test-" + urls.length;
    urls.push(url);
    return url;
  });
  t.mock.method(URL, "revokeObjectURL", (url) => revoked.push(url));
  t.mock.method(globalThis, "setTimeout", (callback) => {
    timers.push(callback);
    return timers.length;
  });
  return {
    text,
    downloads,
    revoked,
    urls,
    canvas,
    cleanup: () => timers.forEach((callback) => callback()),
    removed: () => removed,
  };
}
const args = {
  certs,
  domains,
  tiers,
  lang: "en",
  queryLabel: "Japan included · all providers",
};

test("PNG contains every real certification label exactly once with readable fixed fonts and attribution", async (t) => {
  const mock = browser(t);
  const result = await exportRoadmapPNG(args);
  assert.equal(result.count, manifest.certs.length);
  assert.ok(result.width >= 2400);
  assert.ok(result.height > 0);
  const titleGroups = [];
  let current = null;
  for (const entry of mock.text) {
    const isCertTitle = entry.font.startsWith("700 14px") && entry.x > 200;
    if (isCertTitle) {
      if (!current) titleGroups.push((current = []));
      current.push(entry.text);
    } else current = null;
  }
  const normalize = (value) => value.replace(/\s/g, "");
  assert.deepEqual(
    titleGroups.map((lines) => normalize(lines.join(""))).sort(),
    certs.map((cert) => normalize(cert.abbr || cert.name || cert.id)).sort(),
  );
  const levelLabels = mock.text.filter(
    (entry) => entry.font.startsWith("700 16px") && entry.x < 200,
  );
  assert.deepEqual(
    levelLabels.map((entry) => entry.text),
    [
      "Expert",
      "Professional",
      "Associate",
      "Foundational",
      "Introductory",
      "Specialty",
    ],
  );
  assert.ok(
    levelLabels.find((entry) => entry.text === "Specialty").y >
      levelLabels.find((entry) => entry.text === "Introductory").y,
    "Specialty is drawn below the progression instead of implying a level above Expert",
  );
  const words = mock.text.map((entry) => entry.text).join(" ");
  for (const expected of [
    "Security Certification Roadmap",
    "by hinoshiba",
    "CC BY-SA 4.0",
    "Paul Jerimy",
    "CyberDudeKZ",
    "Specialty is a focused track, not a level above Expert.",
    "data 2026-05-02",
    "build abc123",
    "Generated",
    "UTC",
    args.queryLabel,
    "https://example.com/roadmap/?jp=1#workspace",
  ]) {
    assert.ok(words.includes(expected), expected);
  }
  assert.equal(mock.downloads.length, 1);
  assert.match(
    mock.downloads[0].name,
    /^security-certification-roadmap-.*\.png$/,
  );
  assert.equal(mock.removed(), 1);
  assert.equal(mock.canvas.width, 1, "bitmap released after encoding");
  mock.cleanup();
  assert.deepEqual(mock.revoked, mock.urls);
});

test("PNG uses exactly the supplied certifications and localizes full names with English fallback", async (t) => {
  const mock = browser(t);
  const selected = [
    certs.find((cert) => cert.id === "ipa.ip"),
    certs.find((cert) => cert.id === "comptia.security-plus"),
  ];
  assert.ok(
    selected[0].name_ja && !selected[1].name_ja,
    "covers Japanese names and the English fallback",
  );
  const result = await exportRoadmapPNG({
    ...args,
    certs: selected,
    lang: "ja",
    queryLabel: "IPA / CompTIAのみ",
  });
  assert.equal(result.count, 2);
  const words = mock.text.map((entry) => entry.text).join("");
  assert.ok(words.includes("IPA / CompTIAのみ"));
  assert.ok(words.includes("生成日時"));
  assert.ok(
    words.includes(
      "スペシャリティは専門領域であり、エキスパートの上位ではありません。",
    ),
  );
  const fullNames = mock.text
    .filter((entry) => entry.font.startsWith("400 14px") && entry.x > 200)
    .map((entry) => entry.text)
    .join("")
    .replace(/\s/g, "");
  for (const cert of selected)
    assert.ok(
      fullNames.includes((cert.name_ja || cert.name).replace(/\s/g, "")),
      cert.id,
    );
  assert.ok(
    !fullNames.includes(selected[0].name.replace(/\s/g, "")),
    "Japanese export does not substitute the English full name",
  );
  for (const tier of tiers) assert.ok(words.includes(tier.label_ja), tier.id);
  assert.ok(!words.includes("OSCP"));
  mock.cleanup();
});

test("empty data and unknown certification placement fail without downloading an incomplete image", async (t) => {
  const mock = browser(t);
  await assert.rejects(
    exportRoadmapPNG({ ...args, certs: [] }),
    /No certifications/,
  );
  await assert.rejects(
    exportRoadmapPNG({
      ...args,
      certs: [{ ...certs[0], domain: "unknown-domain" }],
    }),
    /Cannot place certification/,
  );
  assert.equal(mock.downloads.length, 0);
  assert.equal(mock.urls.length, 0);
});

test("missing canvas support and failed PNG encoding never report success", async (t) => {
  const mock = browser(t, { contextFailure: true });
  await assert.rejects(exportRoadmapPNG(args), /does not support PNG export/);
  assert.equal(mock.downloads.length, 0);
});

test("a null PNG Blob produces a useful failure without creating a download URL", async (t) => {
  const mock = browser(t, { blobFailure: true });
  await assert.rejects(
    exportRoadmapPNG({ ...args, certs: certs.slice(0, 1) }),
    /could not create the PNG/,
  );
  assert.equal(mock.urls.length, 0);
});

test("a synchronous encoder error is reported instead of hanging the export", async (t) => {
  const mock = browser(t, { encodeFailure: true });
  await assert.rejects(
    exportRoadmapPNG({ ...args, certs: certs.slice(0, 1) }),
    /could not encode the PNG/,
  );
  assert.equal(mock.urls.length, 0);
});

test("download failure still removes the anchor and revokes its object URL", async (t) => {
  const mock = browser(t, { clickFailure: true });
  await assert.rejects(
    exportRoadmapPNG({ ...args, certs: certs.slice(0, 1) }),
    /download blocked/,
  );
  assert.equal(mock.removed(), 1);
  mock.cleanup();
  assert.deepEqual(mock.revoked, mock.urls);
});
