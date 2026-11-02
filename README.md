# dsh-stitch-mcp

Google **Stitch** as native `mcp__stitch__*` tools inside [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness),
plus an in-panel guide for choosing between **API Key** and **OAuth** credentials.

The official `@google/stitch` CLI is attached as an MCP server over stdio — the same entry
point `stitch mcp install` registers with other editors.

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

Use your own profile name instead of `web` if you launch the harness with another one
(this machine runs `desktop`). Installing the bundle does **not** fetch the CLI runtime —
complete the prerequisites below.

## Prerequisites

1. **Runtime** — the pinned official CLI, installed once outside the plugin:

   ```bash
   npm install "https://registry.npmjs.org/@google/stitch/-/stitch-0.12.1.tgz" \
     --prefix "$HOME/.dsh/dsh-runtimes/stitch-mcp" --ignore-scripts --no-audit --no-fund
   ```

   The patch resolves `<DSH home>/dsh-runtimes/stitch-mcp/node_modules/@google/stitch/dist/mcp.js`.

2. **A Node ≥ 20 interpreter** — `@google/stitch` needs Node ≥ 20 (its bundle uses `RegExp`
   `v`-flag syntax and dies on Node 18 with `Invalid regular expression flags`). The patch
   launches the CLI with the Host's own interpreter (`process.execPath`, Electron's Node 24)
   under `ELECTRON_RUN_AS_NODE=1` instead of relying on whatever `node` is on `PATH`.
   If the Host is not Electron-based and `process.execPath` is older than Node 20, point
   `command` at an absolute Node ≥ 20 path.

3. **Credentials** — see the next section.

## Credentials: API Key vs OAuth

The plugin page (**Settings → Plugins → Google Stitch**) renders a **credential card** with two
tabs:

- **API Key** — press *Open settings and create an API Key*, click **Create key** in the
  **API key** card of the Stitch settings page, then paste the key and press **Save**. It is
  stored through the Host `credentials` service (`ctx.remote.credentials.set`) under the
  reference `STITCH_API_KEY`. The store is write-only: the UI never reads the secret back,
  only whether it is configured.
- **OAuth** — Google sign-in has to run through the CLI, because the authorization callback is
  delivered to a loopback port the CLI opens; a plain browser tab ends on the homepage with no
  token. Press *Copy login command*, run it in a terminal, and the CLI stores and refreshes the
  token locally. A pasted access token is stored under `STITCH_ACCESS_TOKEN`.

How it reaches the MCP server: the Host half (`index.js`) resolves those references at
activation and republishes them into `process.env`; the `stitch-mcp` row's `!!js` expressions
read `process.env` and pass the values to the CLI child. **Restart the harness after saving**
so the MCP child is respawned with the new credentials.

| | API Key | OAuth (`stitch login`) |
| :-- | :-- | :-- |
| Setup | card → API Key tab, or `STITCH_API_KEY=…` | card → OAuth tab, or `stitch login` |
| Covers | Canvas resources: projects, screens, design systems | workspaces, priorities, insights, solutions |
| Best for | automation, unattended machines | interactive use |

```bash
# OAuth via CLI (stores and refreshes tokens locally)
node "$HOME/.dsh/dsh-runtimes/stitch-mcp/node_modules/@google/stitch/dist/stitch.js" login
```

Canvas resources require an API key **in addition to** Google sign-in, so the two are often
used together. The bridge strips names matching `KEY`/`PASSWORD`/`SECRET`/`TOKEN` from the
ambient environment, so `cordis.patch.yml` forwards `STITCH_API_KEY`, `STITCH_ACCESS_TOKEN`,
`STITCH_PROJECT_ID`, `STITCH_BASE_URL`, `HTTPS_PROXY` and `HTTP_PROXY` explicitly.

Restart the harness after changing credentials so the MCP child process is respawned.

## Alternative: remote HTTP transport

`https://stitch.googleapis.com/mcp` is a stateless Streamable HTTP MCP server and needs no
local runtime. Replace the `stitch-mcp` row's `config` with:

```yaml
        transport: streamable-http
        url: https://stitch.googleapis.com/mcp
        headers:
          Authorization: !!js "process.env.STITCH_ACCESS_TOKEN ? `Bearer ${process.env.STITCH_ACCESS_TOKEN}` : undefined"
```

It runs inside the Host process (no Node ≥ 20 needed) but requires a bearer token
(`stitch status --token`) and Host-level proxy support.

## Troubleshooting

- **No `mcp__stitch__*` tools** — activation is non-fatal (`failOnStartupError: false`), so
  check the Host log for `stitch-mcp` output; a missing runtime path or a Node `< 20`
  interpreter are the usual causes.
- **`MISSING_CANVAS_CREDENTIALS`** — the CLI started but has no Canvas credentials.
- **`Invalid regular expression flags`** — the CLI ran on Node < 20.

## Layout

| File | Role |
| :-- | :-- |
| `cordis.patch.yml` | Inserts the Host entry and the `dsh-mcp-client` row |
| `index.js` | Host half: republishes stored credentials into `process.env` |
| `client.js` | Client half: the credential card in `plugins.bundle.config`, with its `I18N` dictionaries |
| `locale/{en,zh}.json` | Plugin title and description per locale |
| `icon.svg` | Plugin icon |
| `CHANGELOG.md` | Release history |
| `market/listing.json` | DSH Plugin Market submission entry |

## Internationalization

`locale/{en,zh}.json` carries the plugin's meta title and description, which the plugin
manager renders without activating the plugin. UI copy lives in the `I18N` table inside
`client.js`, because a client half cannot import modules: it picks the language from the
harness locale service (`ctx.get('locale')`) and falls back to `navigator.language`.

## License

MIT (this plugin). It does not vendor Google code: the runtime step installs `@google/stitch`
(Apache-2.0, © Google LLC) from npm, and its licence stays with that package.
