// Local relay for the Stitch MCP endpoint.
//
// Why this process exists: the Streamable HTTP transport runs inside the Harness
// host process, which has no proxy option, and Node only honours HTTPS_PROXY when
// it was started with `--use-env-proxy`. Rather than depend on a launch flag, this
// relay opens the proxy tunnel itself with a plain CONNECT request and hands the
// socket to Node's HTTPS agent.
//
// Routing is decided per request, so a machine without a proxy needs no
// configuration at all:
//
//   no proxy configured  → direct first, then any proxy found on this machine
//   proxy configured     → that proxy first, direct as a fallback
//
// Where proxies are found: HTTP(S)_PROXY / ALL_PROXY in the environment, the
// Windows system proxy (when it is enabled), and the usual local proxy ports of a
// proxy client that runs without setting the system proxy.
//
// Configuration is read from <cwd>/config.json on every request:
//
//   { "apiKey": "AQ...", "accessToken": "...", "projectId": "...",
//     "proxy": "http://127.0.0.1:7897" }
//
// Listens on 127.0.0.1:<STITCH_RELAY_PORT>/mcp, plus GET /healthz.
// Forwards to https://stitch.googleapis.com/mcp.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import path from 'node:path';
import tls from 'node:tls';

const UPSTREAM = new URL('https://stitch.googleapis.com/mcp');
const PORT = Number(process.env.STITCH_RELAY_PORT || 7788);
const CONFIG_FILE = path.join(process.cwd(), 'config.json');
const CONNECT_TIMEOUT_MS = 8000;
// A direct connection either opens quickly or not at all, so waiting the full
// tunnel timeout only delays the fallback to a proxy.
const DIRECT_TIMEOUT_MS = 4000;
const LAST_GOOD_TTL_MS = 5 * 60_000;
const DETECT_TTL_MS = 2 * 60_000;

// Ports a local proxy client listens on when it does not set the system proxy.
const COMMON_PROXY_PORTS = [7897, 7890, 10809, 10808, 1080, 8118, 8889];

// Hop-by-hop headers, plus the credential headers: the relay is the only writer of
// those, so a blank value from the client can never shadow the real credential.
const DROP_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'keep-alive',
  'proxy-connection',
  'transfer-encoding',
  'upgrade',
  'content-length',
  'accept-encoding',
  'x-goog-api-key',
  'x-goog-user-project',
  'authorization',
]);

const DROP_RESPONSE_HEADERS = new Set(['connection', 'keep-alive', 'transfer-encoding']);

function log(message) {
  process.stderr.write('[stitch-relay ' + new Date().toISOString() + '] ' + message + '\n');
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {};
  }
}

// One agent per proxy URL. A changed proxy builds a new agent, so the setting
// applies to the next request instead of the next restart.
const agents = new Map();

function agentFor(proxy) {
  const key = proxy || '';
  if (agents.has(key)) return agents.get(key);
  const agent = proxy
    ? tunnelAgent(proxy)
    : new https.Agent({ keepAlive: true });
  agents.set(key, agent);
  return agent;
}

/** An HTTPS agent whose sockets are CONNECT tunnels through the HTTP proxy. */
function tunnelAgent(proxyUrl) {
  let proxy;
  try {
    proxy = new URL(proxyUrl);
  } catch {
    log('ignoring invalid proxy url: ' + proxyUrl);
    return new https.Agent({ keepAlive: true });
  }
  const proxyPort = Number(proxy.port) || (proxy.protocol === 'https:' ? 443 : 80);
  const auth =
    proxy.username || proxy.password
      ? 'Proxy-Authorization: Basic ' +
        Buffer.from(
          decodeURIComponent(proxy.username) + ':' + decodeURIComponent(proxy.password),
        ).toString('base64') +
        '\r\n'
      : '';

  const agent = new https.Agent({ keepAlive: true });
  // Assigned on the instance because the constructor option is not honoured; the
  // agent calls `this.createConnection(options, callback)` when it opens a socket.
  agent.createConnection = (options, callback) => {
    const host = options.host;
    const port = options.port || 443;
    const socket = net.connect({ host: proxy.hostname, port: proxyPort });
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      callback(error);
    };
    socket.setTimeout(CONNECT_TIMEOUT_MS, () => fail(new Error('proxy connect timeout')));
    socket.once('error', fail);
    socket.once('connect', () => {
      socket.write(
        'CONNECT ' + host + ':' + port + ' HTTP/1.1\r\nHost: ' + host + ':' + port + '\r\n' + auth + '\r\n',
      );
      let buffer = '';
      const onData = (chunk) => {
        buffer += chunk.toString('latin1');
        if (buffer.indexOf('\r\n\r\n') === -1) return;
        socket.removeListener('data', onData);
        const statusLine = buffer.slice(0, buffer.indexOf('\r\n'));
        if (!/ 200\b/.test(statusLine)) {
          fail(new Error('proxy CONNECT rejected: ' + statusLine));
          return;
        }
        socket.setTimeout(0);
        const secure = tls.connect({ socket, servername: host });
        secure.once('error', fail);
        secure.once('secureConnect', () => {
          if (settled) return;
          settled = true;
          callback(null, secure);
        });
      };
      socket.on('data', onData);
    });
  };
  return agent;
}

// ---------------------------------------------------------------------------
// Route discovery
// ---------------------------------------------------------------------------

let detected = { at: 0, list: [] };
let lastGood = { route: null, at: 0 };

function normalizeProxy(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^[a-z]+:\/\//i.test(trimmed) ? trimmed.replace(/\/+$/, '') : 'http://' + trimmed.replace(/\/+$/, '');
}

function canConnect(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(400, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

function windowsSystemProxy() {
  if (process.platform !== 'win32') return null;
  try {
    const script =
      "$p=Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' -ErrorAction SilentlyContinue; " +
      'if ($p.ProxyEnable -eq 1) { [Console]::Out.Write([string]$p.ProxyServer) }';
    const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true,
    }).trim();
    if (!out) return null;
    // ProxyServer is either "host:port" or "http=host:port;https=host:port".
    const entry = out
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.toLowerCase().startsWith('https='));
    return normalizeProxy(entry ? entry.slice(entry.indexOf('=') + 1) : out.split(';')[0]);
  } catch {
    return null;
  }
}

/** Proxies available on this machine, best guess first. Cached for two minutes. */
async function detectProxies() {
  if (Date.now() - detected.at < DETECT_TTL_MS) return detected.list;
  const found = [];
  const push = (value) => {
    const normalized = normalizeProxy(value);
    if (normalized && !found.includes(normalized)) found.push(normalized);
  };
  for (const name of ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy']) {
    push(process.env[name]);
  }
  push(windowsSystemProxy());
  for (const port of COMMON_PROXY_PORTS) {
    if (await canConnect(port)) push('http://127.0.0.1:' + port);
  }
  detected = { at: Date.now(), list: found };
  if (found.length > 0) log('detected proxy candidates: ' + found.join(', '));
  return found;
}

/** Ordered routes to try for one request. */
function routePlan(config) {
  const plan = [];
  const explicit = normalizeProxy(config.proxy);
  if (explicit) {
    plan.push({ kind: 'proxy', url: explicit });
    plan.push({ kind: 'direct', url: null });
  } else {
    plan.push({ kind: 'direct', url: null });
  }
  if (lastGood.route && Date.now() - lastGood.at < LAST_GOOD_TTL_MS) {
    const index = plan.findIndex((route) => route.url === lastGood.route);
    if (index > 0) plan.unshift(plan.splice(index, 1)[0]);
  }
  return plan;
}

// ---------------------------------------------------------------------------
// Request forwarding
// ---------------------------------------------------------------------------

/** One attempt. Resolves once the upstream answered, rejects on connection errors. */
function attempt(route, req, body, headers) {
  return new Promise((resolve, reject) => {
    const timeout = route.url ? CONNECT_TIMEOUT_MS : DIRECT_TIMEOUT_MS;
    const upstream = https.request(
      UPSTREAM,
      {
        method: req.method,
        headers,
        agent: agentFor(route.url),
        timeout,
      },
      (answer) => resolve(answer),
    );
    upstream.on('timeout', () => upstream.destroy(new Error('upstream timeout')));
    upstream.on('error', reject);
    if (body.length > 0) upstream.write(body);
    upstream.end();
  });
}

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    const config = readConfig();
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: true,
        pid: process.pid,
        port: PORT,
        proxy: normalizeProxy(config.proxy),
        route: lastGood.route === undefined ? null : lastGood.route,
        credential: config.accessToken ? 'access-token' : config.apiKey ? 'api-key' : null,
      }),
    );
    return;
  }

  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', async () => {
    const body = Buffer.concat(chunks);
    const config = readConfig();
    const headers = {};
    for (const [name, value] of Object.entries(req.headers)) {
      if (DROP_REQUEST_HEADERS.has(name.toLowerCase())) continue;
      const text = Array.isArray(value) ? value.join(', ') : value;
      if (text) headers[name] = text;
    }
    // An OAuth access token authenticates the caller, an API key authenticates the
    // request, and X-Goog-User-Project pins the quota project. Google rejects a mix
    // of the two credentials, so only one is ever sent.
    if (config.accessToken) {
      headers.Authorization = 'Bearer ' + config.accessToken;
    } else if (config.apiKey) {
      headers['X-Goog-Api-Key'] = config.apiKey;
    }
    if (config.projectId) headers['X-Goog-User-Project'] = config.projectId;

    const plan = routePlan(config);
    if (!normalizeProxy(config.proxy)) {
      // Nothing was configured, so the direct attempt gets to fail before the
      // machine is scanned for a proxy.
      for (const proxy of await detectProxies()) plan.push({ kind: 'proxy', url: proxy });
    }

    let failure = null;
    for (const route of plan) {
      try {
        const answer = await attempt(route, req, body, headers);
        lastGood = { route: route.url, at: Date.now() };
        const out = {};
        for (const [name, value] of Object.entries(answer.headers)) {
          if (DROP_RESPONSE_HEADERS.has(name.toLowerCase())) continue;
          if (value !== undefined) out[name] = value;
        }
        if (!out['content-type']) out['content-type'] = 'application/json';
        res.writeHead(answer.statusCode || 502, out);
        answer.pipe(res);
        answer.on('error', (error) => {
          log('upstream body failed: ' + (error?.code || error?.message || String(error)));
          res.end();
        });
        return;
      } catch (error) {
        failure = error;
        log(
          'route ' + (route.url || 'direct') + ' failed: ' + (error?.code || error?.message || String(error)),
        );
      }
    }

    const reason = failure?.code || failure?.message || String(failure);
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'relay_upstream_failed', reason }));
  });
});

server.on('error', (error) => {
  // A busy port means another relay already serves it, which is fine.
  log('listen failed: ' + (error?.code || String(error)));
  process.exit(0);
});

server.listen(PORT, '127.0.0.1', () => {
  log('listening on http://127.0.0.1:' + PORT + '/mcp');
});
