# dsh-stitch-mcp

Google **Stitch** as native `mcp__stitch__*` tools inside [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness),
with an in-panel card for the API key and an optional proxy.

Stitch is a **remote MCP endpoint**. This plugin connects to it directly with the
Streamable HTTP transport and authenticates with an API key header, which is the
shape Google documents for MCP clients:

```json
{ "servers": { "stitch": {
  "type": "http",
  "url": "https://stitch.googleapis.com/mcp",
  "headers": { "X-Goog-Api-Key": "AQ...." } } } }
```

There is no helper process, no local port and no launcher script: the row talks to
Google, and the harness owns the network.

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
dsh plugin --profile web add dsh-stitch-mcp@latest
```

Use your own profile name when the harness is launched with another one, and keep
`@latest`: the harness deliberately holds back releases that are minutes old
(`minimumReleaseAge`), so a bare `add dsh-stitch-mcp` can resolve to an older version
that is not this one. Versions below 0.6.0 needed the Google `stitch` CLI installed
by hand and reported `server is disconnected` on a fresh machine.

## Credentials

Settings → Plugins → **Google Stitch** → paste the key → **Save**. The widget has two
tabs:

- **API Key** — the documented shape, `X-Goog-Api-Key`.
- **OAuth** — `Authorization: Bearer <access token>`, optionally pinned to a project
  with `X-Goog-User-Project`.

Create a key at <https://stitch.withgoogle.com/settings> → **API key** → **Create key**.
The full key is shown only once. The OAuth tab takes an access token, e.g. the output of
`gcloud auth print-access-token`.

Values are stored through the host `credentials` service (write-only: the card only
shows whether a value is configured). The Host half resolves them into
`~/.dsh/dsh-runtimes/stitch-mcp/config.json`, which the MCP row reads when its
`headers` are composed. Saving in the card therefore triggers a reload of that one
entry, so the new credential applies **without restarting the harness**.

## Endpoint and proxy

**The default is a direct connection, and a network that reaches Google needs no
configuration at all.**

The card's **Use a proxy** switch is the only valve. Switching it on stores
`http://<ip>:<port>` and routes **only this plugin's Stitch requests** through it:
everything else in the harness — the model API, web search, other MCP servers — keeps
the route it already had. The change applies inside the running process within a few
seconds, so there is no restart, and nothing is written to `~/.dsh/.env`.

Switching it off stores nothing and takes the plugin out of the path again: Stitch then
connects directly, or — when you exported `HTTPS_PROXY` / `ALL_PROXY` for the harness
yourself — whatever that policy says. The harness resolves one outbound policy per
process; with the switch off it is in charge for every origin, this one included.

Upgrading from 0.6.0 removes the managed `HTTPS_PROXY` block that release wrote into
`~/.dsh/.env`. A stored proxy address keeps the switch on.

If nothing can reach the endpoint, nothing is faked: the MCP row reports its own
transport error, and `~/.dsh/dsh-runtimes/stitch-mcp/status.json` says what failed:

```json
{ "ok": false, "endpoint": "https://stitch.googleapis.com/mcp",
  "credential": "api-key", "proxy": null, "route": "direct", "reachable": false,
  "error": "UND_ERR_CONNECT_TIMEOUT", "checkedAt": "..." }
```

A healthy one looks like:

```json
{ "ok": true, "endpoint": "https://stitch.googleapis.com/mcp",
  "credential": "api-key", "proxy": "http://127.0.0.1:7897", "route": "proxy",
  "reachable": true, "tools": 16, "checkedAt": "..." }
```

## Troubleshooting

| Symptom | Meaning |
| :-- | :-- |
| `server is disconnected` | The transport cannot reach `stitch.googleapis.com` at all. `status.json` → `error` names the reason (`UND_ERR_CONNECT_TIMEOUT`, `fetch failed`, …). Give the process a proxy and restart. |
| Tools listed, calls answer “Request is missing required authentication credential” | No credential saved yet — paste an API key in the card. The handshake itself needs no key, which is why the tools appear first. |
| `status.json` says `credential: null` | The card has nothing stored; the host `credentials` service is unreachable. |
| Proxy on but still unreachable | Check the address in the card, then `status.json` → `proxyError` / `error`. Switching the proxy off hands Stitch back to the harness policy. |
| `status.json` says `route: "direct"` with the switch on | `undici` could not be resolved in this profile, so the switch stays inert; `proxyError` says so. Reinstall the plugin. |
| Row gave up after many attempts | The MCP client stops retrying permanently; saving a credential reloads the entry, and restarting the harness also re-arms it. |

## Layout

| File | Role |
| :-- | :-- |
| `cordis.patch.yml` | Inserts the host entry and the `dsh-mcp-client` row (direct HTTPS transport, credential headers, reconnect) |
| `index.js` | Host half: resolves credentials, keeps `config.json` / `status.json`, installs the per-origin proxy wrapper, reloads the row on a change |
| `proxy.js` | Per-origin dispatcher wrapper: routes `stitch.googleapis.com` only, and only while the card's switch is on |
| `client.js` | Client half: the credential card in `plugins.bundle.config`, with `I18N` dictionaries |
| `locale/{en,zh}.json` | Plugin title and description per locale |
| `CHANGELOG.md` | Release history |
| `market/listing.json` | DSH Plugin Market submission entry |

## Why the credential is read from a file

Config expressions are evaluated before any plugin runs, so the row cannot ask the
`credentials` service for the key. It reads `config.json` synchronously instead
(`process.getBuiltinModule('fs')`), and the Host half writes that file whenever the
card changes. That keeps the header in one place, and the reload after a save is what
makes it apply immediately.

## Internationalization

`locale/{en,zh}.json` carries the meta title and description the plugin manager
renders without activating the plugin. UI copy lives in the `I18N` table inside
`client.js`, because a client half cannot import modules: it reads the harness locale
service (`ctx.get('locale')`) and falls back to `navigator.language`.

## License

MIT.
