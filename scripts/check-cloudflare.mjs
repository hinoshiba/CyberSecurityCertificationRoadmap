import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

// Exercise the actual Workers asset router locally, without deploying or logging in.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'http_dist');
const base = '/CyberSecurityCertificationRoadmap';
const controller = new AbortController();
let child, closed, temporary, origin, spawnError;
let childClosed = false;
let log = '';
let checks = 0;
const onInterrupt = () => controller.abort(new Error('Cloudflare check interrupted'));
process.once('SIGINT', onInterrupt);
process.once('SIGTERM', onInterrupt);

async function unusedPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

function request(urlPath, { method = 'GET', timeout = 10_000 } = {}) {
  return fetch(new URL(urlPath, origin), {
    method,
    redirect: 'manual',
    signal: AbortSignal.any([controller.signal, AbortSignal.timeout(timeout)])
  });
}

const mimeTypes = {
  '.html': /^text\/html\b/i,
  '.css': /^text\/css\b/i,
  '.js': /^(?:text|application)\/javascript\b/i,
  '.json': /^application\/json\b/i,
  '.svg': /^image\/svg\+xml\b/i
};

async function expectFile(urlPath, relativeFile) {
  const file = path.resolve(output, relativeFile);
  assert.ok(file.startsWith(output + path.sep), `Asset escapes output directory: ${relativeFile}`);
  const response = await request(urlPath);
  const body = Buffer.from(await response.arrayBuffer());
  assert.equal(response.status, 200, `${urlPath}: expected HTTP 200`);
  assert.equal(response.headers.get('location'), null, `${urlPath}: unexpected redirect`);
  assert.ok(body.equals(await fs.readFile(file)), `${urlPath}: served bytes differ from ${relativeFile}`);
  const mime = mimeTypes[path.extname(relativeFile)];
  if (mime) assert.match(response.headers.get('content-type') || '', mime, `${urlPath}: incorrect Content-Type`);
  checks++;
  return body;
}

async function listFiles(directory, prefix = '') {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const relative = `${prefix}${entry.name}`;
    if (entry.isDirectory()) files.push(...await listFiles(path.join(directory, entry.name), `${relative}/`));
    else {
      assert.ok(entry.isFile(), `Unexpected symlink or non-file in build: ${relative}`);
      files.push(relative);
    }
  }
  return files;
}

async function inParallel(items, check) {
  let next = 0;
  let failure;
  await Promise.all(Array.from({ length: Math.min(4, items.length) }, async () => {
    while (!failure && next < items.length) {
      const item = items[next++];
      try { await check(item); } catch (error) { failure ||= error; }
    }
  }));
  if (failure) throw failure;
}

async function waitUntilReady() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    controller.signal.throwIfAborted();
    if (spawnError) throw spawnError;
    if (childClosed) throw new Error(`Wrangler exited before startup (${child.exitCode ?? child.signalCode})`);
    try {
      const response = await request(`${base}/`, { timeout: 1_000 });
      await response.arrayBuffer();
      if (response.status < 500) return;
    } catch {
      controller.signal.throwIfAborted();
      // Connection refusal is expected while workerd starts.
    }
    await delay(150, undefined, { signal: controller.signal });
  }
  throw new Error('Local Wrangler did not become ready within 60 seconds');
}

async function stopWrangler() {
  if (!child?.pid) return;
  const groupExists = () => {
    if (process.platform === 'win32') return child.exitCode === null && child.signalCode === null;
    try { process.kill(-child.pid, 0); return true; }
    catch (error) {
      if (error.code === 'ESRCH') return false;
      throw error;
    }
  };
  const stop = signal => {
    try {
      // Stop this check's process group, including workerd, without affecting other previews.
      if (process.platform === 'win32') child.kill(signal);
      else process.kill(-child.pid, signal);
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  };
  stop('SIGTERM');
  const deadline = Date.now() + 3_000;
  while (groupExists() && Date.now() < deadline) await delay(50);
  if (groupExists()) stop('SIGKILL');
  await Promise.race([closed, delay(3_000, undefined, { ref: false })]);
  child.stdout?.destroy();
  child.stderr?.destroy();
  child.unref();
}

try {
  const config = JSON.parse(await fs.readFile(path.join(root, 'wrangler.jsonc'), 'utf8'));
  assert.equal(config.assets.base_path, base, 'Assets must use the existing public URL prefix');
  assert.equal(config.assets.html_handling, 'none', 'Keep the existing index.html URL accessible');
  assert.equal(config.assets.not_found_handling, 'none', 'Do not serve the app for missing resources');
  // Local dev does not emulate Cloudflare's edge Route matching. Assert that the
  // production pattern also captures the slashless URL with query parameters.
  assert.ok(config.routes?.some(route => route.pattern === `www.hinoshiba.com${base}*` && route.zone_name === 'hinoshiba.com'),
    'Production Route must capture the existing prefix, bare path, and query parameters');

  const files = await listFiles(output);
  assert.ok(files.includes('index.html') && files.includes('_redirects'), 'Build the site before checking Cloudflare');
  const manifest = JSON.parse(await fs.readFile(path.join(output, 'data/manifest.json'), 'utf8'));
  assert.ok(manifest.certs?.length, 'The manifest must include certification records');
  const requiredData = [manifest.domains_path, manifest.tiers_path, manifest.agencies_path, ...manifest.certs.map(cert => cert.path)];
  for (const relative of requiredData) {
    assert.ok(typeof relative === 'string' && !relative.startsWith('/') && !relative.split('/').includes('..'), `Unsafe manifest path: ${relative}`);
    assert.ok(files.includes(`data/${relative}`), `Missing manifest dependency: ${relative}`);
  }

  const port = await unusedPort();
  origin = `http://127.0.0.1:${port}`;
  temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'roadmap-cloudflare-check-'));
  child = spawn(process.execPath, [
    path.join(root, 'node_modules/wrangler/bin/wrangler.js'),
    'dev', '--config', path.join(root, 'wrangler.jsonc'), '--local',
    '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', '0',
    '--persist-to', temporary, '--log-level', 'warn', '--show-interactive-dev-session=false'
  ], {
    cwd: root,
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false', NO_COLOR: '1' }
  });
  const capture = chunk => { log = (log + chunk.toString()).slice(-12_000); };
  child.stdout.on('data', capture);
  child.stderr.on('data', capture);
  child.once('error', error => { spawnError = error; });
  closed = new Promise(resolve => child.once('close', () => { childClosed = true; resolve(); }));
  await waitUntilReady();

  const publicFiles = files.filter(file => !['_redirects', '_headers', '.assetsignore'].includes(file));
  await inParallel(publicFiles, file => expectFile(`${base}/${file}`, file));
  await expectFile(`${base}/`, 'index.html');

  for (const query of ['', '?theme=light&lang=en&jp=1', '?theme=dark&lang=ja&jp=0&q=%E6%97%A5%E6%9C%AC%E8%AA%9E%20%2B%20CISSP']) {
    const response = await request(base + query);
    await response.arrayBuffer();
    assert.equal(response.status, 308, 'The bare path must redirect before resolving relative assets');
    const location = response.headers.get('location');
    assert.ok(location, 'Bare-path redirect has no Location');
    const redirected = new URL(location, origin);
    assert.equal(redirected.origin, origin, 'Redirect must stay on the same host');
    assert.equal(redirected.pathname, `${base}/`, 'Redirect must add only the trailing slash');
    assert.equal(redirected.search, query, 'Redirect must preserve query parameters');
    checks++;
    await expectFile(redirected.pathname + redirected.search, 'index.html');
    await expectFile(`${base}/index.html${query}`, 'index.html');
  }

  const version = JSON.parse(await expectFile(`${base}/assets/version.json`, 'assets/version.json'));
  assert.match(version.commit, /^[a-f0-9]{40}$/i, 'Published version must identify the actual build commit');
  assert.equal(version.commit_short, version.commit.slice(0, 7));
  assert.equal(version.commit_url, `https://github.com/hinoshiba/CyberSecurityCertificationRoadmap/commit/${version.commit}`);
  assert.ok(Number.isFinite(Date.parse(version.build_date)), 'Build timestamp must be valid');
  assert.ok(version.dataset_updated === 'unknown' || /^\d{4}-\d{2}-\d{2}$/.test(version.dataset_updated), 'Dataset update date must be a date or unknown');

  for (const url of [`${base}/`, `${base}/index.html`, `${base}/data/manifest.json`]) {
    const response = await request(url, { method: 'HEAD' });
    assert.equal(response.status, 200, `${url}: HEAD must succeed`);
    assert.equal(response.headers.get('location'), null, `${url}: HEAD must not redirect`);
    assert.equal((await response.arrayBuffer()).byteLength, 0, `${url}: HEAD must have no body`);
    checks++;
  }

  const hiddenFiles = ['AGENTS.md', 'README.md', 'package.json', 'package-lock.json', 'wrangler.jsonc', 'scripts/build.mjs', '.github/workflows/pages.yml', '.git/config', '.env', '_redirects', '.assetsignore'];
  const missing = ['/', '/index.html', '/assets/js/app.js', '/data/manifest.json', `${base}-other/`, `${base}ball/`, `${base}/missing`, `${base}/missing.json`, ...hiddenFiles.map(file => `${base}/${file}`)];
  for (const url of missing) {
    const response = await request(url);
    await response.arrayBuffer();
    assert.equal(response.status, 404, `${url}: must not expose source files or fall back to the roadmap`);
    checks++;
  }
  console.log(`Cloudflare check passed: ${publicFiles.length} assets, ${manifest.certs.length} certifications, ${checks} HTTP checks. No deployment performed.`);
} catch (error) {
  console.error(`Cloudflare check failed: ${error.message}`);
  if (log.trim()) console.error(log.trim());
  process.exitCode = 1;
} finally {
  try { await stopWrangler(); }
  finally {
    if (temporary) await fs.rm(temporary, { recursive: true, force: true });
    process.removeListener('SIGINT', onInterrupt);
    process.removeListener('SIGTERM', onInterrupt);
  }
}
