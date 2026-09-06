import { readFile, readdir, access } from "node:fs/promises";
import { resolve, dirname, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? walk(resolve(directory, entry.name))
        : [resolve(directory, entry.name)],
    ),
  );
  return nested.flat();
}
const failures = [];
const files = (
  await Promise.all(
    ["assets/js", "scripts", "tests"].map((path) => walk(resolve(root, path))),
  )
)
  .flat()
  .filter((path) => [".js", ".mjs"].includes(extname(path)));
let references = 0;
async function checkReference(from, target) {
  if (!target || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target)) return;
  const clean = target.split(/[?#]/)[0];
  if (!clean) return;
  const path = resolve(dirname(from), clean);
  references++;
  try {
    await access(path);
  } catch {
    failures.push(`${relative(root, from)} references missing ${target}`);
  }
}
for (const path of files) {
  const result = spawnSync(process.execPath, ["--check", path], {
    encoding: "utf8",
  });
  if (result.status !== 0)
    failures.push(
      result.stderr || `Syntax check failed: ${relative(root, path)}`,
    );
  const source = await readFile(path, "utf8");
  const imports = source.matchAll(
    /(?:\bfrom\s*|\bimport\s*\(?\s*)(['"])([^'"]+)\1/g,
  );
  for (const match of imports) {
    if (match[2].startsWith(".")) await checkReference(path, match[2]);
  }
}
const index = resolve(root, "index.html");
const html = await readFile(index, "utf8");
for (const match of html.matchAll(
  /<(?:script|link|img|source)\b[^>]*?\b(?:src|href)\s*=\s*(['"])(.*?)\1/gi,
)) {
  await checkReference(index, match[2]);
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Frontend check passed: ${files.length} JavaScript modules, ${references} local references.`,
  );
}
