import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Package only public files. Do not upload the repository or fetch remote data.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'http_dist');
const config = JSON.parse(await fs.readFile(path.join(root, 'wrangler.jsonc'), 'utf8'));
const basePath = config.assets.base_path;
assert.match(basePath, /^\/[A-Za-z0-9_-]+$/);

async function filesUnder(directory) {
  const files = [];
  for (const entry of await fs.readdir(path.join(root, directory), { withFileTypes: true })) {
    const relative = path.posix.join(directory, entry.name);
    if (entry.name.startsWith('.')) continue;
    assert.ok(!entry.isSymbolicLink(), `Public assets must not be symlinks: ${relative}`);
    if (entry.isDirectory()) files.push(...await filesUnder(relative));
    else if (entry.isFile()) files.push(relative);
  }
  return files.sort();
}

const dataFiles = await filesUnder('data');
const documents = new Map();
for (const file of dataFiles.filter(file => file.endsWith('.json'))) {
  documents.set(file, JSON.parse(await fs.readFile(path.join(root, file), 'utf8')));
}
const manifest = documents.get('data/manifest.json');
assert.ok(manifest?.certs?.length, 'Missing or empty certification manifest');
for (const key of ['domains_path', 'tiers_path', 'agencies_path']) {
  assert.ok(documents.has(`data/${manifest[key]}`), `Missing manifest resource: ${key}`);
}
const indexed = new Set();
const ids = new Set();
for (const cert of manifest.certs) {
  assert.match(cert.path, /^certs\/[^/.][^/]*\/[^/.][^/]*\.json$/);
  const relative = `data/${cert.path}`;
  assert.ok(documents.has(relative), `Missing certification: ${relative}`);
  assert.ok(!indexed.has(relative) && !ids.has(cert.id), `Duplicate manifest entry: ${cert.id}`);
  indexed.add(relative);
  ids.add(cert.id);
  assert.equal(documents.get(relative).id, cert.id, `Certification ID mismatch: ${relative}`);
  const sha = createHash('sha256').update(await fs.readFile(path.join(root, relative))).digest('hex').slice(0, 16);
  assert.equal(cert.sha, sha, `Stale manifest: ${relative}. Run make manifest and commit the result.`);
}
assert.deepEqual([...indexed].sort(), dataFiles.filter(file => file.startsWith('data/certs/') && file.endsWith('.json')).sort(), 'Manifest must include every certification');

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const commit = git('rev-parse', 'HEAD');
assert.match(commit, /^[a-f0-9]{40,64}$/);
// A shallow boundary can look like the last data change even when it is not.
const shallow = git('rev-parse', '--is-shallow-repository') === 'true';
const version = {
  commit,
  commit_short: commit.slice(0, 7),
  commit_url: `https://github.com/hinoshiba/CyberSecurityCertificationRoadmap/commit/${commit}`,
  build_date: new Date().toISOString(),
  dataset_updated: shallow ? 'unknown' : (git('log', '-1', '--format=%cs', '--', 'data/') || 'unknown')
};

const publicFiles = ['index.html', 'LICENSE', 'NOTICE', ...await filesUnder('assets'), ...dataFiles];
await fs.rm(output, { recursive: true, force: true });
for (const file of publicFiles) {
  assert.ok((await fs.lstat(path.join(root, file))).isFile(), `Not a regular public file: ${file}`);
  const destination = path.join(output, file);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(path.join(root, file), destination);
}
await fs.writeFile(path.join(output, 'assets/version.json'), JSON.stringify(version, null, 2) + '\n');
await fs.writeFile(path.join(output, '_redirects'), `${basePath} ${basePath}/ 308\n${basePath}/ ${basePath}/index.html 200\n`);
console.log(`Built ${publicFiles.length} public files and ${manifest.certs.length} certifications in http_dist/ (${basePath}/).`);
if (shallow) console.log('Shallow Git history: dataset_updated is unknown; certification dates and data are unchanged.');
