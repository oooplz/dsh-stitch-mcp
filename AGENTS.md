# AGENTS.md — dsh-stitch-mcp

Orientation for anyone — human or agent — picking this repository up cold.

`dsh-stitch-mcp` publishes Google **Stitch** as native `mcp__stitch__*` tools inside
DeepSeek Harness. Stitch is a **remote MCP endpoint** (`https://stitch.googleapis.com/mcp`,
Streamable HTTP); the bundle contributes one direct MCP row for it and a credential card
on the plugin page. MIT licensed, published on npm as `dsh-stitch-mcp`.

The 0.6.0 line has **no helper process, no local port and no launcher script**: the MCP
row talks to Google itself, and the harness owns the network. Older releases carried a
local relay; nothing in this tree does that any more, and nothing should reintroduce it.

## 1. Architecture

```
card  (client.js, slot `plugins.bundle.config`)
  │   credentials service: set / describe / unset  (write-only from the UI)
  ▼
Host half  (index.js + proxy.js)
  ├─→ $DSH_HOME/dsh-runtimes/stitch-mcp/config.json   0600, the only source of truth
  ├─→ $DSH_HOME/dsh-runtimes/stitch-mcp/status.json   self-check result
  ├─→ undici global dispatcher                        Stitch origin only, while the switch is on
  └─→ pluginManager.reload(['stitch-mcp'])            re-compose the row after a save
        ▼
@deepseek-ai/dsh-mcp-client  (streamable-http)  ──https──→  stitch.googleapis.com/mcp
```

`$DSH_HOME` is `DSH_HOME` when set, otherwise `~/.dsh`.

| File | Role |
| :-- | :-- |
| `cordis.patch.yml` | Inserts the Host entry, then the `@deepseek-ai/dsh-mcp-client` row (`streamable-http`, credential headers, `reconnect`) |
| `index.js` | Host half: resolves credentials, keeps `config.json` / `status.json` / `plugin.log`, installs the proxy wrapper, reloads the MCP row on a change, and publishes the masked credential on `/api/dsh-stitch-mcp/credential-mask` |
| `proxy.js` | Per-origin dispatcher wrapper: routes the Stitch origin through the card's proxy and hands every other request to the dispatcher that was there before |
| `client.js` | Client half: the credential card (API Key / OAuth tabs, proxy switch, `I18N` dictionaries) |
| `locale/{en,zh}.json` | Plugin title and description shown before activation |
| `package.json` | Manifest: `dsh.bundle.patch`, `dsh.client`, and the `files` allowlist for npm |
| `market/listing.json` | Plugin Market submission; its `spec` / `version` must match `package.json` |
| `README.md`, `CHANGELOG.md`, `LICENSE` | User-facing docs, release history, MIT licence |
| `icon.svg` | Plugin icon |

Runtime files (created on demand, **not** part of the repository):

| Path | Meaning |
| :-- | :-- |
| `dsh-runtimes/stitch-mcp/config.json` | `apiKey` / `accessToken` / `projectId` / `proxy`, mode `0600` |
| `dsh-runtimes/stitch-mcp/status.json` | `ok`, `endpoint`, `credential`, `proxy`, `route` (`proxy` / `direct`), `proxyError`, `reachable`, `tools`, `error`, `checkedAt`, and `reload` (`{reloaded, reason}`) whenever the config file changed |
| `dsh-runtimes/stitch-mcp/plugin.log` | One line per config write / proxy route / row reload |
| `.env` | Nothing is written here any more. A block between `# >>> dsh-stitch-mcp proxy …` and `# <<< dsh-stitch-mcp proxy` left by 0.6.0 is deleted on activation |

Upgrades leave debris in that runtime directory: a `relay.log`, and a detached relay
process from 0.5.x that still idles on `127.0.0.1:7788` (installing 0.6.0 does not stop
it), plus an `@google/stitch` dependency folder from 0.4.x. Nothing reads any of it —
delete the files and kill the process (or reboot) to reclaim the port. Never delete
`config.json`: it is the stored setup.

### Why the shape is what it is

1. **The credential is read from a file, not from a service.** Config expressions are
   evaluated before any plugin runs, so `headers` in the YAML cannot await the
   `credentials` service. The row reads `config.json` synchronously via
   `process.getBuiltinModule('fs')` instead, and the Host half maintains that file.
2. **The header expression may only build the headers that exist.** An empty
   `X-Goog-Api-Key` reaches Stitch as a real (wrong) header and shadows the stored key.
3. **A saved key has to re-compose the row.** `pluginManager.reload(['stitch-mcp'])` is
   the same live reconcile the Plugin Manager's own toggle performs; that is what makes
   a save apply without a restart.
4. **`server/discover` decides whether the connection starts at all.** The MCP client
   probes it before `initialize`, and a 5xx answer ends the attempt permanently. Stitch
   answers the probe with a JSON-RPC "method not supported" at HTTP 200, so the client
   falls back to the classic handshake and lists the 16 tools even before a credential
   exists. Do not put anything on that path that can answer 5xx.
5. **The plugin routes exactly one origin, and only when asked.** The harness installs one
   outbound proxy policy per process (`HTTPS_PROXY` / `HTTP_PROXY` / `ALL_PROXY`, exported
   or in `$DSH_HOME/.env`) on undici's global dispatcher, and every `fetch` follows it, this
   transport included. That policy is process-wide by design, so it cannot express "proxy
   this one endpoint". The card's switch therefore wraps the same dispatcher: with an
   address stored, a request whose origin is `stitch.googleapis.com` takes a `ProxyAgent`
   and everything else is dispatched unchanged; with nothing stored, the wrapper is removed
   and the harness policy is back in charge for every origin. Wrapping in-process — rather
   than writing env — is what makes a switch flip apply without a restart.
6. **`undici` is a real dependency.** The wrapper needs `ProxyAgent`, so the profile has to
   resolve the package for the switch to do anything. When it cannot, the switch stays inert
   and `status.json` says so, instead of the bundle failing to activate.
7. **Keep the two rows in `cordis.patch.yml` in order.** The Host half is what writes
   `config.json`, so it must be inserted before the MCP row that reads it.

## 2. Local test loop

There is no automated test suite. Verification means: install → reload → read the status
file → **call a real tool**.

1. **Install into a profile** (the harness profile you actually launch):

   ```bash
   # from the registry — closest to a real user
   dsh plugin --profile <profile> add dsh-stitch-mcp@x.y.z
   # or from a local build, when one line of source changed
   npm pack --pack-destination <dir>     # then point the profile at the .tgz
   ```

   When testing a build you have just published, pin the exact version: the harness holds
   back very fresh releases (`minimumReleaseAge`), so `@latest` can still resolve to the
   previous one. `README.md`, written for users, therefore recommends `@latest`.

2. **Reload without restarting the harness.** Toggle the bundle off and on again
   (`plugin_manager` → `set_bundle` `enabled=false`, then `enabled=true`). An
   `application: "applied"` answer means the new code is active. Do **not** register the
   card through a `settings.section` — that path has taken the harness down before.

   To try a single-file change without reinstalling, overwrite the installed copy. It is
   hard-linked into the package store, so `rm` first, then `cp`:

   ```bash
   for f in index.js proxy.js client.js cordis.patch.yml; do
     rm -f "<profile>/node_modules/dsh-stitch-mcp/$f"
     cp "$f" "<profile>/node_modules/dsh-stitch-mcp/$f"
   done
   ```

3. **Check the evidence** — all of it, in this order:

   ```bash
   cat "$DSH_HOME/dsh-runtimes/stitch-mcp/status.json"
   # {"ok": true, "endpoint": "https://stitch.googleapis.com/mcp",
   #  "credential": "api-key", "proxy": null, "reachable": true,
   #  "tools": 16, "checkedAt": "..."}
   ```

   Then call `mcp__stitch__list_projects` (or `list_screens` with a known project id).
   A healthy `status.json` is never proof on its own: it round-trips `initialize` +
   `tools/list`, not a tool call.

| `status.json` | Meaning |
| :-- | :-- |
| `ok: true, tools: 16` | Healthy |
| `credential: null` | Nothing resolved at all — no card value, no credentials file, no environment variable, no previous `config.json` |
| `reachable: false`, `error: "UND_ERR_CONNECT_TIMEOUT"` / `"fetch failed"` | No route to the endpoint: turn the card's proxy on, or give the process one through `HTTPS_PROXY` and restart |
| `error: "HTTP 4xx/5xx"` | The endpoint answered and rejected the handshake |
| file missing | The Host half never activated (bundle disabled, or the reload failed) |
| `route: "proxy"` / `"direct"` | Which route the probe actually took. `proxyError` explains a switch that could not be honoured (`undici` missing from the profile, address rejected) |

Registered tools can also be inspected from the harness itself
(`cordis_inspect_query(platform="host", provider="Tool", method="listTools")`, then look
for `mcp__stitch__*`) — faster than asking the user what they can see.

## 3. Release

1. Bump `package.json`, add the `[x.y.z]` section in `CHANGELOG.md`, and sync `spec` /
   `version` in `market/listing.json`. **Never** bump the version unprompted.
2. Add any newly shipped file to `files` in `package.json` — npm ships exactly that
   allowlist plus `package.json` itself. `npm pack --dry-run` shows the real contents.
3. Commit, tag, push (`--follow-tags`), then `npm publish`. Expect a minute or two of
   registry lag before an install can resolve the new version.
4. Keep the link definitions at the bottom of `CHANGELOG.md` in step with the new tag.

## 4. Known pitfalls

| Pitfall | Handling |
| :-- | :-- |
| A credential written into `cordis.patch.yml` | Never. The row reads `config.json`; a literal leaks the key into the repository and goes stale |
| An empty credential header | Emit only the headers that exist, otherwise the empty one shadows the real one |
| Assuming `config.json` alone applies a key | It does not: config expressions are evaluated at compose time, so the reload of `stitch-mcp` is part of the flow |
| `reconnect.maxAttempts` | One-way: a row that gave up stays dead. A credential save (or a harness restart) re-arms it |
| `settings.section` for the card | Breaks harness startup — the card belongs in `plugins.bundle.config` |
| Overwriting an installed copy | `rm` before `cp`; `pnpm` hard-links into the store, so a plain `cp` writes through it |
| Proxy switch "does nothing" | It routes only the Stitch origin, in the running process. Read `status.json` → `route` / `proxyError`; an unresolvable `undici` leaves the switch inert instead of breaking the bundle |
| Deleting `config.json` to "reset" | Loses the stored setup; clear the field in the card instead, which unsets the credential properly |
| Reinstalling over a `link:` dependency | Can damage a source checkout; install from a tarball or the registry |

## 5. Conventions

- **English everywhere** in source, comments, `README.md`, `CHANGELOG.md` and this file.
  UI copy lives in the `I18N` table in `client.js` (en/zh), because a client half cannot
  import modules; `locale/*.json` carries only title and description.
- **The UI language comes from the harness `locale` service**, declared in `inject`. The
  card registers the `I18N` table with `locale.register`, resolves copy through
  `locale.bind` and repaints on `locale.subscribe`, so `navigator.language` is only the
  last fallback. Reading the browser language first (or reading the service without
  declaring it) renders the card in the OS language on an English UI.
- **A credential is never printed.** The credentials service is write-only: `describe`
  says whether a reference resolves, never what it holds. Two mask sources exist, in this
  order: the mask of what this browser saved (`localStorage`, `dsh-stitch-mcp:masks:v1`),
  then the Host route `/api/dsh-stitch-mcp/credential-mask`, which masks whatever
  `config.json` currently holds (`index.js` → `maskSecret`, first three and last three
  characters, six characters or fewer fully hidden). A mask is dropped when the reference
  is cleared or its `source` changes. The card puts that mask **in the credential field**
  (plain text, read-only, cleared for input on focus, **Save** idle while it stands there)
  rather than beside the status dot, so the stored value sits where a value belongs. Never
  add a route, a log line or a `status.json` field that returns the value itself.
- UI copy is short and developer-facing — no tutorial sentences. Fonts and theme follow
  the harness; do not introduce custom typography.
- The credential tab is always labelled **API Key**, never abbreviated.
- A network with no proxy must work with **zero configuration**; the proxy is opt-in, and
  both host and port are required when it is on. The switch is the only valve: the plugin
  never exports proxy variables and never touches another origin's route, and with the
  switch off the harness policy alone decides.
- `projectId` has no card field today. It is resolved from `STITCH_PROJECT_ID` through the
  usual chain (credentials service → `$DSH_HOME/.credentials.yaml` → environment →
  previous `config.json`) and sent as `X-Goog-User-Project`.
- Do not rewrite the plugin description or README wording, and do not bump versions,
  unless the maintainer asks.
- Claims need evidence: after a change, call a `mcp__stitch__*` tool instead of pasting
  logs and declaring success.
