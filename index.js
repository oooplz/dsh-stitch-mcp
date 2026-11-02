// Google Stitch as an MCP server for DeepSeek Harness — no helper process, no relay.
//
// Stitch is a *remote* MCP endpoint, documented as:
//
//   { "type": "http", "url": "https://stitch.googleapis.com/mcp",
//     "headers": { "X-Goog-Api-Key": "AQ...." } }
//
// The row below speaks to it directly, which is the whole point:
//
// * overseas users need nothing: the endpoint is reached directly;
// * a proxied network is the user's own choice. The card's switch is the only valve.
//   When it is on, this Host half puts one wrapper in front of undici's global
//   dispatcher (see `proxy.js`) and routes *only* `stitch.googleapis.com` through the
//   address the card stored; when it is off, none of our code is in the path and the
//   harness policy (an exported `HTTPS_PROXY` / `ALL_PROXY` or one in `$DSH_HOME/.env`)
//   keeps deciding for every origin, this endpoint included. The wrapper lives in the
//   running process, so a switch flip applies on the next poll instead of at the next
//   launch, and nothing is written to `$DSH_HOME/.env`;
// * when nothing can reach the endpoint the row reports its own transport error
//   instead of a fake connection, and `status.json` records which step failed.
//
// Two details decide the shape of the YAML:
//
// 1. The credential has to be in `headers` at compose time, so the row reads it
//    synchronously from the runtime `config.json` written here. Reading a file
//    (rather than the credentials service) is what makes a key saved in the card
//    usable at all: config expressions are evaluated before any plugin runs.
// 2. Because a saved key changes that file, the row has to be composed again for
//    the new header to apply. The Host half therefore asks the plugin manager to
//    reload just this entry after a credential change, which is the same live path
//    the Plugin Manager's own toggle uses — no harness restart.
//
// `server/discover` matters too: the MCP client probes it before `initialize`, and
// Stitch answers the probe with a JSON-RPC "method not supported" (HTTP 200), so
// the client falls back to the classic handshake. A 5xx there would end the
// connection attempt for good, which is why nothing in this path may return one.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createStitchRouter } from './proxy.js';

const ENDPOINT = 'https://stitch.googleapis.com/mcp';
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
const RUNTIME_DIR = path.join(DSH_HOME, 'dsh-runtimes', 'stitch-mcp');
const CONFIG_FILE = path.join(RUNTIME_DIR, 'config.json');
const STATUS_FILE = path.join(RUNTIME_DIR, 'status.json');
const LOG_FILE = path.join(RUNTIME_DIR, 'plugin.log');
const ENV_FILE = path.join(DSH_HOME, '.env');
const CREDENTIALS_FILE = path.join(DSH_HOME, '.credentials.yaml');

/** Loader entry id of the MCP row this bundle contributes. */
const MCP_ENTRY_ID = 'stitch-mcp';
/** Credential reference name → key in config.json. */
const FIELDS = {
  STITCH_API_KEY: 'apiKey',
  STITCH_ACCESS_TOKEN: 'accessToken',
  STITCH_PROJECT_ID: 'projectId',
  STITCH_HTTPS_PROXY: 'proxy',
};
// The block 0.6.x wrote into `$DSH_HOME/.env`. Nothing writes it any more; the markers
// survive only so {@link removeLegacyProxyEnv} can find and delete it verbatim.
const PROXY_BLOCK_START = '# >>> dsh-stitch-mcp proxy (managed; restart the harness to apply)';
const PROXY_BLOCK_END = '# <<< dsh-stitch-mcp proxy';

export async function apply(ctx) {
  // 0.6.x routed through a process-wide block in `$DSH_HOME/.env`. The switch scopes the
  // proxy to this endpoint now, so a leftover block would keep proxying everything else.
  removeLegacyProxyEnv();
  const config = await resolveConfig(ctx);
  const changed = writeConfig(config);
  const route = await applyProxyRoute(config.proxy);
  const status = await probe(config);
  writeStatus({ ...status, ...routeFields(route), reload: changed ? await reloadRow(ctx) : undefined });
  ctx.effect(() => () => {
    void uninstallProxyRoute();
  });
  keepAlive(ctx);
}

/** Credentials service → credentials file → environment → previous config. */
async function resolveConfig(ctx) {
  const previous = readJson(CONFIG_FILE);
  const service = safeGet(ctx, 'credentials');
  const stored = readCredentialsFile();
  // Turning the proxy switch off clears the stored reference, so the value kept in
  // config.json must not be inherited again; the endpoint is then reached directly.
  const proxyDisabled = (await proxyConfigured(service)) === false;
  const resolved = {};

  for (const [ref, key] of Object.entries(FIELDS)) {
    const candidates = [
      async () => (service ? await readService(service, ref) : undefined),
      () => stored[ref],
      () => process.env[ref],
      () => (proxyDisabled && key === 'proxy' ? undefined : previous[key]),
    ];
    for (const candidate of candidates) {
      try {
        const value = await candidate();
        if (typeof value === 'string' && value.trim() !== '') {
          resolved[key] = value.trim();
          break;
        }
      } catch {
        // Fall through to the next source.
      }
    }
  }
  return resolved;
}

async function readService(credentials, ref) {
  const result = await credentials.resolve(ref);
  return typeof result?.value === 'string' ? result.value : undefined;
}

/** Whether the stored proxy reference exists; undefined when it cannot be told. */
async function proxyConfigured(service) {
  if (!service || typeof service.describe !== 'function') return undefined;
  try {
    const result = await service.describe(['STITCH_HTTPS_PROXY']);
    if (!result || result.ok !== true) return undefined;
    const entry = (result.value || {})['STITCH_HTTPS_PROXY'];
    return Boolean(entry && entry.configured === true);
  } catch {
    return undefined;
  }
}

/** The credentials store is a small YAML document with a flat `refs:` map. */
function readCredentialsFile() {
  try {
    const text = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
    const lines = text.split(/\r?\n/);
    const start = lines.findIndex((line) => /^refs:\s*$/.test(line));
    if (start === -1) return {};
    const refs = {};
    for (const line of lines.slice(start + 1)) {
      if (/^\S/.test(line)) break;
      const match = line.match(/^\s{2}([A-Za-z0-9_.-]+):\s*(.*)$/);
      if (!match) continue;
      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (value !== '') refs[match[1]] = value;
    }
    return refs;
  } catch {
    return {};
  }
}

/** Write config.json when it changed. Returns true when the file changed. */
function writeConfig(config) {
  try {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
    // Nothing resolved anywhere: keep whatever worked before rather than
    // destroying it.
    if (Object.keys(config).length === 0) return false;
    const next = JSON.stringify(config, null, 2) + '\n';
    let current = '';
    try {
      current = fs.readFileSync(CONFIG_FILE, 'utf8');
    } catch {
      // The file is created below.
    }
    if (current === next) return false;
    fs.writeFileSync(CONFIG_FILE, next, { mode: 0o600 });
    log('wrote config.json (credential: ' + (config.accessToken ? 'access-token' : config.apiKey ? 'api-key' : 'none') + ')');
    return true;
  } catch (error) {
    log('could not write config.json: ' + (error?.message || String(error)));
    // A read-only DSH home only costs the credential, never activation.
    return false;
  }
}

/**
 * Remove the block 0.6.x wrote into `$DSH_HOME/.env`, and nothing else.
 *
 * That block set `HTTPS_PROXY` for the whole harness, which is exactly the behaviour this
 * release replaces: the switch must decide for the Stitch origin alone. The file belongs to
 * the user, so only the two marker lines and what sits between them are dropped; a missing
 * file, unreadable file or absent block is not an error.
 */
function removeLegacyProxyEnv() {
  try {
    const text = fs.readFileSync(ENV_FILE, 'utf8');
    const lines = text.split(/\r?\n/);
    const start = lines.indexOf(PROXY_BLOCK_START);
    const end = lines.indexOf(PROXY_BLOCK_END);
    if (start === -1 || end === -1 || end < start) return;
    const kept = [...lines.slice(0, start), ...lines.slice(end + 1)];
    const next = kept.join('\n').replace(/^(?:[ \t]*\n)+/, '');
    fs.writeFileSync(ENV_FILE, next);
    log('removed the legacy process-wide proxy block from ' + ENV_FILE);
  } catch {
    // No `.env`, no block, or a read-only home: nothing to migrate.
  }
}

/**
 * The wrapper currently installed, if any: `{ dispatcher, setProxy, close, previous }`.
 * Kept module-wide because the dispatcher outlives one `apply()` call and has to be
 * restored when the bundle is disabled.
 */
let router;

/** The undici module, once resolved; `null` marks a failure that is not retried. */
let undici;
let undiciUnavailable = false;

/**
 * Resolve `undici` lazily.
 *
 * The harness already routes every `fetch` through undici's global dispatcher, so the only
 * thing this plugin needs from the package is `ProxyAgent` plus the two accessors. A profile
 * where it cannot be resolved keeps working: the switch simply stays inert and
 * `status.json` says why, instead of the bundle failing to activate.
 */
async function loadUndici() {
  if (undici) return undici;
  if (undiciUnavailable) return undefined;
  try {
    undici = await import('undici');
    return undici;
  } catch (error) {
    undiciUnavailable = true;
    log('undici is unavailable; the proxy switch stays inert: ' + (error?.message || String(error)));
    return undefined;
  }
}

/**
 * Put the card's switch into effect.
 *
 * On: install the wrapper (once) and point it at `proxyUrl`. Off: restore the dispatcher
 * that was in charge before us, so the harness policy decides for every origin again. The
 * call is idempotent — the keep-alive poll runs it on every tick.
 *
 * @param {string} [proxyUrl] - the stored address; empty or missing means off.
 * @returns {Promise<{applied: boolean, reason?: string}>} what the status file should say.
 */
async function applyProxyRoute(proxyUrl) {
  const wanted = typeof proxyUrl === 'string' ? proxyUrl.trim() : '';
  const module = await loadUndici();
  if (!module) return { applied: false, reason: 'undici unavailable' };

  if (wanted === '') {
    const stale = router;
    router = undefined;
    if (stale) {
      if (module.getGlobalDispatcher() === stale.dispatcher) module.setGlobalDispatcher(stale.previous);
      await stale.close();
      log('proxy route removed; the previous dispatcher is back in charge');
    }
    return { applied: false };
  }

  if (!router || module.getGlobalDispatcher() !== router.dispatcher) {
    // Nothing installed yet, or something replaced the global dispatcher after us. Wrap
    // whatever is in charge now, so the chain below us stays reachable and the switch keeps
    // working instead of silently pointing at a detached object.
    const stale = router;
    const previous = stale && module.getGlobalDispatcher() === stale.dispatcher ? stale.previous : module.getGlobalDispatcher();
    router = { ...createStitchRouter({ previous, undici: module }), previous };
    module.setGlobalDispatcher(router.dispatcher);
    if (stale) await stale.close();
    log('proxy route installed for the Stitch origin only');
  }

  try {
    router.setProxy(wanted);
  } catch (error) {
    const reason = error?.message || String(error);
    log('proxy address rejected: ' + reason);
    return { applied: false, reason };
  }
  return { applied: true };
}

/** Undo {@link applyProxyRoute} — the bundle was disabled or reloaded away. */
async function uninstallProxyRoute() {
  const stale = router;
  router = undefined;
  if (!stale) return;
  try {
    if (undici && undici.getGlobalDispatcher() === stale.dispatcher) {
      undici.setGlobalDispatcher(stale.previous);
    }
    await stale.close();
  } catch (error) {
    log('could not restore the previous dispatcher: ' + (error?.message || String(error)));
  }
}

/** The status fields that describe where Stitch traffic actually went. */
function routeFields(route) {
  const fields = { route: route.applied ? 'proxy' : 'direct' };
  if (route.reason) fields.proxyError = route.reason;
  return fields;
}

/**
 * Ask the plugin manager to compose the MCP row again, so the new credential in
 * config.json reaches its `headers`. This is the same live reconcile the Plugin
 * Manager's toggle performs; it keeps the tools working without a restart.
 */
async function reloadRow(ctx) {
  const manager = safeGet(ctx, 'pluginManager');
  if (!manager || typeof manager.reload !== 'function') {
    return { reloaded: false, reason: 'plugin manager unavailable' };
  }
  try {
    const result = await manager.reload([MCP_ENTRY_ID]);
    if (result && result.restartReason) {
      return { reloaded: false, reason: result.restartReason };
    }
    log('reloaded MCP entry ' + MCP_ENTRY_ID + ' to apply the new credential');
    return { reloaded: true };
  } catch (error) {
    return { reloaded: false, reason: error?.message || String(error) };
  }
}

/**
 * Round-trip the endpoint the same way the MCP transport will — through the global
 * dispatcher, so the proxy wrapper installed by {@link applyProxyRoute} is on this path
 * too — and let `status.json` say whether the network route, not just the credential,
 * is in place.
 */
async function probe(config) {
  const credential = config.accessToken ? 'access-token' : config.apiKey ? 'api-key' : null;
  const base = {
    endpoint: ENDPOINT,
    credential,
    proxy: config.proxy || null,
    checkedAt: new Date().toISOString(),
  };
  const headers = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
  if (config.accessToken) headers.Authorization = 'Bearer ' + config.accessToken;
  else if (config.apiKey) headers['X-Goog-Api-Key'] = config.apiKey;
  if (config.projectId) headers['X-Goog-User-Project'] = config.projectId;

  try {
    const initialized = await fetch(ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'deepseek-harness', version: '1' },
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!initialized.ok) {
      return { ok: false, ...base, reachable: false, error: 'HTTP ' + initialized.status };
    }
    const listed = await fetch(ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await listed.json().catch(() => null);
    const tools = payload?.result?.tools;
    return {
      ok: Array.isArray(tools),
      ...base,
      reachable: true,
      tools: Array.isArray(tools) ? tools.length : undefined,
      ...(Array.isArray(tools) ? {} : { error: 'unexpected tools/list response' }),
    };
  } catch (error) {
    return {
      ok: false,
      ...base,
      reachable: false,
      error: error?.cause?.code || error?.message || String(error),
    };
  }
}

function writeStatus(status) {
  try {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
    fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2) + '\n');
  } catch {
    // Diagnostics only.
  }
}

/**
 * A credential saved in the card has to reach the MCP row without a restart, and a
 * row that ran out of reconnect attempts has to come back by itself. Both are the
 * same action: notice the change, then compose the entry again.
 */
function keepAlive(ctx) {
  let fingerprint = '';
  let probing = false;
  const tick = async () => {
    if (probing) return;
    probing = true;
    try {
      const config = await resolveConfig(ctx);
      const next = JSON.stringify([
        config.apiKey || '',
        config.accessToken || '',
        config.projectId || '',
        config.proxy || '',
      ]);
      if (next === fingerprint) return;
      const first = fingerprint === '';
      fingerprint = next;
      const changed = writeConfig(config);
      const route = await applyProxyRoute(config.proxy);
      if (first && !changed) return;
      const status = await probe(config);
      writeStatus({ ...status, ...routeFields(route), reload: changed ? await reloadRow(ctx) : undefined });
    } catch {
      // A probe failure is recorded by the next round.
    } finally {
      probing = false;
    }
  };
  // A card save must take effect while the user is looking at it, so the first
  // minutes are polled closely and the interval relaxes afterwards.
  const fast = setInterval(tick, 2_500);
  const slow = setInterval(tick, 30_000);
  for (const timer of [fast, slow]) {
    if (typeof timer.unref === 'function') timer.unref();
  }
  ctx.effect(() => () => {
    clearInterval(fast);
    clearInterval(slow);
  });
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function safeGet(ctx, name) {
  try {
    return typeof ctx.get === 'function' ? ctx.get(name) : undefined;
  } catch {
    return undefined;
  }
}

function log(message) {
  try {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, '[' + new Date().toISOString() + '] ' + message + '\n');
  } catch {
    // Diagnostics only.
  }
}
