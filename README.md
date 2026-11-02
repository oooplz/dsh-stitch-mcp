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

The endpoint exposes 16 tools; they register as `mcp__stitch__*`:

| Tool | Purpose |
| :-- | :-- |
| `list_projects` / `get_project` / `create_project` / `delete_project` | Projects |
| `list_screens` / `get_screen` / `download_file` | Screens and their files |
| `generate_screen_from_text` / `edit_screens` / `generate_variants` | Generate and edit UI |
| `list_design_systems` / `create_design_system` / `create_design_system_from_design_md` / `update_design_system` / `apply_design_system` | Design systems |
| `upload_design_md` | Upload a DESIGN.md |

## Install

```bash
dsh plugin --profile web add dsh-stitch-mcp
```

Use your own profile name when the harness is launched with another one.

## Credentials

Settings → Plugins → **Google Stitch** → paste the key → **Save**. The widget has two
tabs:

- **API Key** — the documented shape, `X-Goog-Api-Key`.
- **OAuth** — `Authorization: Bearer <access token>`, optionally pinned to a project
  with `X-Goog-User-Project`.

Each credential is stored through the host `credentials` service (write-only: the card
only shows whether it is configured). The host half resolves it into
`~/.dsh/dsh-runtimes/stitch-mcp/config.json`, which the relay re-reads on every
request, so saving a new value takes effect immediately — no restart.

Create a key at <https://stitch.withgoogle.com/settings> → **API key** → **Create key**.
The full key is shown only once.

## Proxy

`stitch.googleapis.com` is not reachable directly on some networks, and the
Streamable HTTP transport runs inside the harness process, which has no proxy
option. The plugin therefore starts `relay.js` — a small child process that opens the
proxy tunnel itself with a plain `CONNECT` request — and the MCP row points at
`127.0.0.1:7788`.

Nothing has to be launched specially: the proxy is configured in the same card
(switch, IP, port) and stored next to the credential. The relay opens a tunnel only
when a proxy is set; without one it connects directly.

The host half checks the relay every 30s, restarts it when it is gone, and writes a
round-trip result to `~/.dsh/dsh-runtimes/stitch-mcp/status.json`:

```json
{ "ok": true, "credential": "api-key", "proxy": "http://127.0.0.1:7897", "tools": 16 }
```

## Troubleshooting

| Symptom | Cause |
| :-- | :-- |
| `mcp-client(stitch): server is disconnected` | The relay could not reach the endpoint; read `status.json` and `relay.log` |
| `ok: false, error: no credential configured` | Nothing saved in the card yet |
| `UND_ERR_CONNECT_TIMEOUT` / `ETIMEDOUT` | The proxy is set but not running, or direct access is blocked |
| Tools missing from the tool list | Check `status.json`; the MCP row reconnects on its own once the relay answers |

## Layout

| File | Role |
| :-- | :-- |
| `cordis.patch.yml` | Inserts the host entry and the `dsh-mcp-client` row (HTTP transport, reconnect) |
| `index.js` | Host half: resolves credentials, keeps `config.json` and the relay alive, writes `status.json` |
| `relay.js` | Local relay: proxy tunnel, credential headers, request forwarding |
| `client.js` | Client half: the credential card in `plugins.bundle.config`, with `I18N` dictionaries |
| `locale/{en,zh}.json` | Plugin title and description per locale |
| `scripts/` | Optional proxy-aware launchers, kept for other plugins that need the env flag |
| `CHANGELOG.md` | Release history |
| `market/listing.json` | DSH Plugin Market submission entry |

## Internationalization

`locale/{en,zh}.json` carries the meta title and description the plugin manager
renders without activating the plugin. UI copy lives in the `I18N` table inside
`client.js`, because a client half cannot import modules: it reads the harness locale
service (`ctx.get('locale')`) and falls back to `navigator.language`.

## License

MIT.
