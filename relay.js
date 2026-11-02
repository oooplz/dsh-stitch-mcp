// Local relay for the Stitch MCP endpoint.
//
// Why this exists: the Streamable HTTP transport runs inside the Harness host
// process, and Node only honours HTTPS_PROXY when NODE_USE_ENV_PROXY=1 was set
// when that process started. A plugin cannot set that for its host, so this
// process — spawned by the plugin, with the flag in its own environment — does the
// proxying and attaches the API key. The MCP client then talks to 127.0.0.1 and
// needs neither a proxy nor the key.
//
// Reads  <cwd>/.env                     for STITCH_API_KEY / HTTPS_PROXY
// Listens on 127.0.0.1:STITCH_RELAY_PORT (default 7788), path /mcp
// Forwards to https://stitch.googleapis.com/mcp

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const UPSTREAM = 'https://stitch.googleapis.com/mcp';
const PORT = Number(process.env.STITCH_RELAY_PORT || 7788);

function readEnvFile() {
  try {
    const text = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
    const out = {};
    for (const line of text.split('\n')) {
      const i = line.indexOf('=');
      if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
    return out;
  } catch {
    return {};
  }
}

const envFile = readEnvFile();
const apiKey = process.env.STITCH_API_KEY || envFile.STITCH_API_KEY || '';
const accessToken = process.env.STITCH_ACCESS_TOKEN || envFile.STITCH_ACCESS_TOKEN || '';
const projectId = process.env.STITCH_PROJECT_ID || envFile.STITCH_PROJECT_ID || '';

const HOP_BY_HOP = new Set([
  'host',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'content-length',
  'accept-encoding',
]);

const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', async () => {
    const body = Buffer.concat(chunks);
    const headers = {};
    for (const [name, value] of Object.entries(req.headers)) {
      if (HOP_BY_HOP.has(name.toLowerCase())) continue;
      const text = Array.isArray(value) ? value.join(', ') : value;
      // An empty header would otherwise shadow the credential below: the client
      // sends X-Goog-Api-Key with an empty value when the config expression ran
      // before the Host half published the stored key.
      if (text === undefined || text === '') continue;
      headers[name] = text;
    }
    // Documented credential headers: an OAuth access token authenticates the
    // caller, an API key authenticates the request, and X-Goog-User-Project pins
    // the quota project. Only one credential is sent — Google rejects a mix.
    if (accessToken && !headers['authorization'] && !headers['Authorization']) {
      headers.Authorization = 'Bearer ' + accessToken;
    }
    if (!headers['authorization'] && !headers['Authorization'] && apiKey) {
      headers['X-Goog-Api-Key'] = apiKey;
    }
    if (projectId && !headers['x-goog-user-project'] && !headers['X-Goog-User-Project']) {
      headers['X-Goog-User-Project'] = projectId;
    }

    try {
      const upstream = await fetch(UPSTREAM, {
        method: req.method,
        headers,
        body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
      });
      res.writeHead(upstream.status, {
        'content-type': upstream.headers.get('content-type') || 'application/json',
        ...(upstream.headers.get('mcp-session-id')
          ? { 'mcp-session-id': upstream.headers.get('mcp-session-id') }
          : {}),
        ...(upstream.headers.get('cache-control')
          ? { 'cache-control': upstream.headers.get('cache-control') }
          : {}),
      });
      if (upstream.body) {
        const reader = upstream.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(Buffer.from(value));
        }
      }
      res.end();
    } catch (error) {
      const message = error && error.cause && error.cause.code ? error.cause.code : String(error);
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'relay_upstream_failed', message }));
    }
  });
});

server.on('error', (error) => {
  // A busy port means another instance already relays; that instance is fine.
  process.stderr.write('[stitch-relay] ' + (error && error.code ? error.code : String(error)) + '\n');
  process.exit(0);
});

server.listen(PORT, '127.0.0.1', () => {
  process.stderr.write('[stitch-relay] listening on http://127.0.0.1:' + PORT + '/mcp\n');
});
