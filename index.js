/**
 * Host half.
 *
 * Stitch is a *remote* MCP endpoint that wants the API key in an `X-Goog-Api-Key`
 * header. Two facts shape this file:
 *
 * 1. The Streamable HTTP transport runs inside the Harness process, which only
 *    honours HTTPS_PROXY when NODE_USE_ENV_PROXY was set at its launch. A plugin
 *    cannot do that for its host.
 * 2. A `!!js` config expression may be evaluated before this plugin activates, so
 *    the MCP row must not depend on values written here.
 *
 * So this entry spawns `relay.js` — a child that has the proxy flag in its own
 * environment — waits until it listens, and the MCP row points at it on localhost.
 * The relay attaches the API key and does the proxying; the MCP client needs
 * neither.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RELAY_PORT = Number(process.env.STITCH_RELAY_PORT || 7788);
const RELAY_SCRIPT = fileURLToPath(new URL('./relay.js', import.meta.url));
const RUNTIME_DIR = path.join(os.homedir(), '.dsh', 'dsh-runtimes', 'stitch-mcp');
const ENV_FILE = path.join(RUNTIME_DIR, '.env');

const ENV_REFS = [
  'STITCH_API_KEY',
  'STITCH_ACCESS_TOKEN',
  'STITCH_PROJECT_ID',
  'STITCH_BASE_URL',
];

export async function apply(ctx) {
  const credentials = ctx.get('credentials');
  const values = {};

  if (credentials !== undefined) {
    for (const name of ENV_REFS) {
      const value = await read(credentials, name);
      if (value !== undefined) {
        process.env[name] = value;
        values[name] = value;
      }
    }
    const proxy = await read(credentials, 'STITCH_HTTPS_PROXY');
    if (proxy !== undefined) {
      process.env.HTTPS_PROXY = proxy;
      process.env.HTTP_PROXY = proxy;
      values.HTTPS_PROXY = proxy;
      values.HTTP_PROXY = proxy;
    }
  }

  writeEnvFile(values);
  await ensureRelay();
  writeStatus(await probe());
  keepAlive(ctx);
}

/**
 * Round-trip through the relay so a broken credential or a missing proxy shows up
 * as a readable status file instead of silently absent tools.
 */
async function probe() {
  const endpoint = `http://127.0.0.1:${RELAY_PORT}/mcp`;
  const headers = { 'content-type': 'application/json', accept: 'application/json' };
  const post = async (body) => {
    const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
    return { status: res.status, text: await res.text() };
  };
  try {
    await post({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'dsh', version: '1' } },
    });
    const listed = await post({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    const payload = JSON.parse(listed.text);
    const tools = payload?.result?.tools;
    if (Array.isArray(tools)) return { ok: true, tools: tools.length, checkedAt: new Date().toISOString() };
    return { ok: false, httpStatus: listed.status, error: listed.text.slice(0, 400) };
  } catch (error) {
    return { ok: false, error: error?.cause?.code || String(error?.message || error) };
  }
}

function writeStatus(status) {
  try {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
    fs.writeFileSync(path.join(RUNTIME_DIR, 'status.json'), JSON.stringify(status, null, 2) + '\n');
  } catch {
    // Diagnostics only.
  }
}

/**
 * The MCP connection is established once, at activation, so a relay that dies
 * later would leave the tools broken until the next restart. Re-check the port and
 * spawn it again instead.
 */
function keepAlive(ctx) {
  const timer = setInterval(() => {
    ensureRelay()
      .then((ready) => (ready ? probe().then(writeStatus) : undefined))
      .catch(() => {});
  }, 30_000);
  if (typeof timer.unref === 'function') timer.unref();
  ctx.effect(() => () => clearInterval(timer));
}

/** Mirror the resolved values into the relay's working directory. */
function writeEnvFile(values) {
  try {
    const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
    if (lines.length === 0) {
      fs.rmSync(ENV_FILE, { force: true });
      return;
    }
    fs.mkdirSync(path.dirname(ENV_FILE), { recursive: true });
    fs.writeFileSync(ENV_FILE, lines.join('\n') + '\n', { mode: 0o600 });
  } catch {
    // A read-only home directory only costs the fallback path, never activation.
  }
}

/** Start the relay unless something already listens on the port. */
async function ensureRelay() {
  if (await canConnect(RELAY_PORT)) return true;
  try {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
    const log = fs.openSync(path.join(RUNTIME_DIR, 'relay.log'), 'a');
    const child = spawn(process.execPath, [RELAY_SCRIPT], {
      cwd: RUNTIME_DIR,
      env: {
        ...process.env,
        // The relay is a Node process of our own, so it can carry the flag the
        // Harness host cannot.
        ELECTRON_RUN_AS_NODE: '1',
        NODE_USE_ENV_PROXY: '1',
        STITCH_RELAY_PORT: String(RELAY_PORT),
      },
      detached: true,
      // Keep the relay's own diagnostics: a silent spawn is impossible to debug.
      stdio: ['ignore', log, log],
      windowsHide: true,
    });
    child.unref();
  } catch {
    return false;
  }
  for (let i = 0; i < 60; i += 1) {
    if (await canConnect(RELAY_PORT)) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

function canConnect(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    socket.setTimeout(500, () => done(false));
  });
}

async function read(credentials, name) {
  try {
    const resolved = await credentials.resolve(name);
    if (resolved !== undefined && typeof resolved.value === 'string' && resolved.value.length > 0) {
      return resolved.value;
    }
  } catch {
    // An unresolvable reference simply keeps whatever is already in the environment.
  }
  return undefined;
}
