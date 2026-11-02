// Local relay for the Stitch MCP endpoint.
//
// Why this process exists: the Streamable HTTP transport runs inside the Harness
// host process, which has no proxy option, and Node only honours HTTPS_PROXY when
// it was started with `--use-env-proxy` / NODE_USE_ENV_PROXY. Rather than depend on
// a launch flag — which an embedded runtime may not support — this relay opens the
// proxy tunnel itself with a plain CONNECT request and hands the socket to Node's
// HTTPS agent. It therefore works on any Node version, and the proxy, the
// credential and the project can all change at runtime.
//
// Configuration is read from <cwd>/config.json on every request:
//
//   { "apiKey": "AQ...", "accessToken": "...", "projectId": "...",
//     "proxy": "http://127.0.0.1:7897" }
//
// Listens on 127.0.0.1:<STITCH_RELAY_PORT>/mcp, plus GET /healthz.
// Forwards to https://stitch.googleapis.com/mcp.

import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import path from 'node:path';
import tls from 'node:tls';

const UPSTREAM = new URL('https://stitch.googleapis.com/mcp');
const PORT = Number(process.env.STITCH_RELAY_PORT || 7788);
const CONFIG_FILE = path.join(process.cwd(), 'config.json');

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

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function log(message) {
  process.stderr.write('[stitch-relay ' + new Date().toISOString() + '] ' + message + '\n');
}

// One agent per proxy URL. A changed proxy builds a new agent, so the setting
// applies to the next request instead of the next restart.
let cachedAgent;
let cachedProxy = null;

function agentFor(proxy) {
  const key = proxy || '';
  if (cachedAgent && cachedProxy === key) return cachedAgent;
  if (cachedAgent) cachedAgent.destroy();
  cachedProxy = key;
  cachedAgent = proxy ? tunnelAgent(proxy) : new https.Agent({ keepAlive: true });
  return cachedAgent;
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
      socket.setTimeout(20_000, () => fail(new Error('proxy connect timeout')));
      socket.once('error', fail);
      socket.once('connect', () => {
        socket.write(
          'CONNECT ' + host + ':' + port + ' HTTP/1.1\r\nHost: ' + host + ':' + port + '\r\n' + auth + '\r\n',
        );
        let buffer = '';
        const onData = (chunk) => {
          buffer += chunk.toString('latin1');
          const end = buffer.indexOf('\r\n\r\n');
          if (end === -1) return;
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

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    const config = readConfig();
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: true,
        pid: process.pid,
        port: PORT,
        proxy: config.proxy || null,
        credential: config.accessToken ? 'access-token' : config.apiKey ? 'api-key' : null,
      }),
    );
    return;
  }

  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
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

    const upstream = https.request(
      UPSTREAM,
      { method: req.method, headers, agent: agentFor(config.proxy) },
      (answer) => {
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
      },
    );

    upstream.on('error', (error) => {
      const reason = error?.code || error?.message || String(error);
      log('upstream failed: ' + reason + ' (proxy=' + (config.proxy || 'none') + ')');
      if (res.headersSent) {
        res.end();
        return;
      }
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'relay_upstream_failed', reason }));
    });

    if (body.length > 0) upstream.write(body);
    upstream.end();
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
