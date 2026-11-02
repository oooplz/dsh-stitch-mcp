/**
 * Host half.
 *
 * Stitch is a *remote* MCP endpoint: `streamable-http` to
 * https://stitch.googleapis.com/mcp with an `X-Goog-Api-Key` (or an OAuth
 * `Authorization: Bearer` plus `X-Goog-User-Project`) header. Two constraints
 * decide how that is wired here:
 *
 * 1. The transport runs inside the Harness process, which only honours
 *    HTTPS_PROXY when NODE_USE_ENV_PROXY was set at launch, and the transport has
 *    no proxy option of its own. A plugin cannot change either.
 * 2. A `!!js` config expression may be evaluated before this plugin activates, so
 *    the MCP row must not carry the credential itself.
 *
 * So this entry keeps one source of truth on disk — config.json in the runtime
 * directory — starts relay.js (a child that owns the proxy flag and injects the
 * credential headers), and points the MCP row at that relay on localhost.
 *
 * The credential is resolved from the credentials service, then from the
 * credentials file on disk, then from the environment, then from the previous
 * config.json, and the result is merged instead of overwritten: a plugin that
 * activates before the credentials service is ready must not erase a working
 * setup.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RELAY_SCRIPT = fileURLToPath(new URL('./relay.js', import.meta.url));
const RELAY_PORT = Number(process.env.STITCH_RELAY_PORT || 7788);
const RUNTIME_DIR = path.join(os.homedir(), '.dsh', 'dsh-runtimes', 'stitch-mcp');
const CONFIG_FILE = path.join(RUNTIME_DIR, 'config.json');
const LOG_FILE = path.join(RUNTIME_DIR, 'relay.log');
const STATUS_FILE = path.join(RUNTIME_DIR, 'status.json');
const CREDENTIALS_FILE = path.join(os.homedir(), '.dsh', '.credentials.yaml');

/** Credential reference name → key in config.json. */
const FIELDS = {
  STITCH_API_KEY: 'apiKey',
  STITCH_ACCESS_TOKEN: 'accessToken',
  STITCH_PROJECT_ID: 'projectId',
  STITCH_HTTPS_PROXY: 'proxy',
};

export async function apply(ctx) {
  const config = await resolveConfig(ctx);
  writeConfig(config);
  await ensureRelay(config);
  writeStatus(await probe(config));
  keepAlive(ctx);
}

/** Credentials service → credentials file → environment → previous config. */
async function resolveConfig(ctx) {
  const previous = readJson(CONFIG_FILE);
  const service = safeGet(ctx, 'credentials');
  const stored = readCredentialsFile();
  const resolved = {};

  for (const [ref, key] of Object.entries(FIELDS)) {
    const candidates = [
      async () => (service ? await readService(service, ref) : undefined),
      () => stored[ref],
      () => process.env[ref],
      () => previous[key],
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

function writeConfig(config) {
  try {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
    // Nothing resolved anywhere: keep whatever worked before rather than
    // destroying it.
    if (Object.keys(config).length === 0) return;
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
  } catch {
    // A read-only home directory only costs the relay, never activation.
  }
}

/** Start the relay unless it already answers on the port. */
async function ensureRelay(config) {
  if (await health()) return true;

  try {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
    const log = fs.openSync(LOG_FILE, 'a');
    const child = spawn(process.execPath, [RELAY_SCRIPT], {
      cwd: RUNTIME_DIR,
      env: {
        ...process.env,
        // The relay follows the documented MCP request flow, so it can run as a
        // plain Node script under the embedded runtime.
        ELECTRON_RUN_AS_NODE: '1',
        STITCH_RELAY_PORT: String(RELAY_PORT),
      },
      detached: true,
      stdio: ['ignore', log, log],
      windowsHide: true,
    });
    child.unref();
  } catch {
    return false;
  }
  return waitFor(() => health().then((value) => value !== undefined), 6000);
}

async function waitFor(predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await predicate()) return true;
    if (Date.now() > deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

async function health() {
  try {
    const res = await fetch(`http://127.0.0.1:${RELAY_PORT}/healthz`, {
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return undefined;
    return await res.json();
  } catch {
    return undefined;
  }
}

/** Round-trip through the relay so a bad credential becomes a readable status. */
async function probe(config) {
  const endpoint = `http://127.0.0.1:${RELAY_PORT}/mcp`;
  const headers = { 'content-type': 'application/json', accept: 'application/json' };
  const post = async (body) => {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    return { status: res.status, text: await res.text() };
  };
  const base = {
    credential: config.accessToken ? 'access-token' : config.apiKey ? 'api-key' : null,
    proxy: config.proxy || null,
    checkedAt: new Date().toISOString(),
  };
  if (!base.credential) return { ok: false, ...base, error: 'no credential configured' };
  try {
    await post({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'deepseek-harness', version: '1' },
      },
    });
    const listed = await post({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    const payload = JSON.parse(listed.text);
    const tools = payload?.result?.tools;
    if (Array.isArray(tools)) return { ok: true, ...base, tools: tools.length };
    return { ok: false, ...base, httpStatus: listed.status, error: listed.text.slice(0, 400) };
  } catch (error) {
    return { ok: false, ...base, error: error?.cause?.code || error?.message || String(error) };
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
 * The MCP connection is created once, at activation. If the relay is late, dead or
 * holding a stale credential, recover it here so the tools do not stay broken
 * until the next restart.
 */
function keepAlive(ctx) {
  const timer = setInterval(() => {
    recover(ctx).catch(() => {});
  }, 30_000);
  if (typeof timer.unref === 'function') timer.unref();
  ctx.effect(() => () => clearInterval(timer));
}

async function recover(ctx) {
  const config = await resolveConfig(ctx);
  const merged = { ...readJson(CONFIG_FILE), ...config };
  writeConfig(merged);
  await ensureRelay(merged);
  writeStatus(await probe(merged));
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
