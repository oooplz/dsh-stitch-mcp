# dsh-stitch-mcp

Google **Stitch** as native `mcp__stitch__*` tools inside [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness),
with an in-panel card for the API key and an outbound proxy.

Stitch is a **remote MCP endpoint**. This plugin connects to it with the Streamable
HTTP transport and authenticates with an API key header, which is the shape Google
documents for MCP clients:

```json
{ "servers": { "stitch": {
  "type": "http",
  "url": "https://stitch.googleapis.com/mcp",
  "headers": { "X-Goog-Api-Key": "AQ...." } } } }
```

## Tools

| Tool | Purpose |
| :-- | :-- |
| `stitch_find` | List projects, screens or design systems |
| `stitch_get` | Fetch one resource by id |
| `stitch_create` | Create one resource |
| `stitch_edit` | Partial update of one resource |
| `stitch_delete` | Remove a project |
| `stitch_generate` | Start a backend generation job (screens, variants) |
| `stitch_url` | Canonical Stitch Canvas web URL for a project or screen |

## Install

```bash
dsh plugin --profile web add dsh-stitch-mcp
```

Use your own profile name when the harness is launched with another one.

## API key

Settings → Plugins → **Google Stitch** → paste the key → **Save**, then restart the
harness. The key is stored through the host `credentials` service (write-only: the
card only ever shows whether it is configured) and reaches the MCP row as the
`X-Goog-Api-Key` header.

Create a key at <https://stitch.withgoogle.com/settings> → **API key** → **Create key**.
The full key is shown only once.

## Outbound proxy

The HTTP transport runs **inside the harness process**, and Node's built-in `fetch`
ignores `HTTPS_PROXY` unless `NODE_USE_ENV_PROXY=1` was present when that process
started. A plugin cannot set that for its host, so launch the harness through the
bundled script when `stitch.googleapis.com` is only reachable through a proxy:

- `scripts/start-with-proxy.ps1` (PowerShell)
- `scripts/start-with-proxy.cmd` (double-click / shortcut target)

Both set `NODE_USE_ENV_PROXY=1`, `HTTPS_PROXY` and `HTTP_PROXY` before starting the
application. Edit `PROXY` in the script if the proxy listens elsewhere.

The card's proxy fields are kept for reference and for a stdio fallback; on the HTTP
transport the launcher is what takes effect.

## Troubleshooting

| Symptom | Cause |
| :-- | :-- |
| Tools missing from the tool list | The endpoint could not be reached; start through the proxy launcher |
| `AUTH_REQUIRED` / `NOT_AUTHENTICATED` | The key did not reach the header; re-save it and restart |
| `MISSING_CANVAS_CREDENTIALS` | No API key configured for Canvas resources |

## Layout

| File | Role |
| :-- | :-- |
| `cordis.patch.yml` | Inserts the host entry and the `dsh-mcp-client` row (HTTP transport) |
| `index.js` | Host half: resolves stored credentials into the process environment |
| `client.js` | Client half: the credential card in `plugins.bundle.config`, with `I18N` dictionaries |
| `locale/{en,zh}.json` | Plugin title and description per locale |
| `scripts/` | Proxy-aware launchers for the harness |
| `CHANGELOG.md` | Release history |
| `market/listing.json` | DSH Plugin Market submission entry |

## Internationalization

`locale/{en,zh}.json` carries the meta title and description the plugin manager
renders without activating the plugin. UI copy lives in the `I18N` table inside
`client.js`, because a client half cannot import modules: it reads the harness locale
service (`ctx.get('locale')`) and falls back to `navigator.language`.

## License

MIT.
