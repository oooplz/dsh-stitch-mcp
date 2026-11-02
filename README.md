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
configuration at all.** Proxy support is not implemented by this plugin: DeepSeek
Harness resolves one outbound proxy policy for the whole process from `HTTPS_PROXY` /
`HTTP_PROXY` / `ALL_PROXY` (exported, or listed in `~/.dsh/.env`), and every `fetch` in
the process follows it — this MCP transport included.

The card's **Use a proxy** switch is therefore just a convenience: it writes

```dotenv
# >>> dsh-stitch-mcp proxy (managed; restart the harness to apply)
HTTPS_PROXY=http://127.0.0.1:7897
HTTP_PROXY=http://127.0.0.1:7897
# <<< dsh-stitch-mcp proxy
```

into `~/.dsh/.env` (other lines are preserved), so the next launch routes the whole
harness through that proxy. Turning the switch off removes the block again. Because the
launcher reads that file once at startup, a proxy change applies after a restart; a
credential change does not.

If nothing can reach the endpoint, nothing is faked: the MCP row reports its own
transport error, and `~/.dsh/dsh-runtimes/stitch-mcp/status.json` says what failed:

```json
{ "ok": false, "endpoint": "https://stitch.googleapis.com/mcp",
  "credential": "api-key", "proxy": null, "reachable": false,
  "error": "UND_ERR_CONNECT_TIMEOUT", "checkedAt": "..." }
```

A healthy one looks like:

```json
{ "ok": true, "endpoint": "https://stitch.googleapis.com/mcp",
  "credential": "api-key", "proxy": "http://127.0.0.1:7897",
  "reachable": true, "tools": 16, "checkedAt": "..." }
```

## Troubleshooting

| Symptom | Meaning |
| :-- | :-- |
| `server is disconnected` | The transport cannot reach `stitch.googleapis.com` at all. `status.json` → `error` names the reason (`UND_ERR_CONNECT_TIMEOUT`, `fetch failed`, …). Give the process a proxy and restart. |
| Tools listed, calls answer “Request is missing required authentication credential” | No credential saved yet — paste an API key in the card. The handshake itself needs no key, which is why the tools appear first. |
| `status.json` says `credential: null` | The card has nothing stored; the host `credentials` service is unreachable. |
| Proxy set but still unreachable | The proxy is written to `~/.dsh/.env`; restart the harness and check the block is there. |
| Row gave up after many attempts | The MCP client stops retrying permanently; saving a credential reloads the entry, and restarting the harness also re-arms it. |

## Layout

| File | Role |
| :-- | :-- |
| `cordis.patch.yml` | Inserts the host entry and the `dsh-mcp-client` row (direct HTTPS transport, credential headers, reconnect) |
| `index.js` | Host half: resolves credentials, keeps `config.json` / `status.json`, manages the proxy block in `~/.dsh/.env`, reloads the row on a credential change |
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
