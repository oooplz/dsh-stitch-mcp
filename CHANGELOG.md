# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2026-11-02

The helper process is gone: the MCP row talks to Google itself, and the harness owns
the network. This also fixes the fresh-machine failure of every earlier release.

### Removed

- `relay.js` and the `127.0.0.1:7788` hop. The plugin no longer listens on a port,
  cannot leave a stale process behind, and no longer needs the old `scripts/`
  launchers (also removed).
- The plugin's own proxy routing and proxy discovery. DeepSeek Harness already installs
  one outbound proxy policy per process (`HTTPS_PROXY` / `HTTP_PROXY` / `ALL_PROXY`, or
  `$DSH_HOME/.env`) that covers every `fetch`, including the MCP transport.

### Changed

- The MCP row points at `https://stitch.googleapis.com/mcp` with the documented
  `X-Goog-Api-Key` header. Direct is the default; a network without a proxy needs no
  configuration.
- The card's proxy switch now writes a managed `HTTPS_PROXY` block into
  `$DSH_HOME/.env` (and removes it again when switched off), so the address takes
  effect for the whole harness at the next launch.
- The OAuth tab documents `gcloud auth print-access-token` instead of the removed
  `stitch login` command.
- `status.json` reports the endpoint, the resolved proxy, `reachable` and the error of
  the last round trip, instead of a relay route.

### Fixed

- `mcp-client(stitch): server is disconnected` on a brand-new machine. The MCP client's
  first request is a `server/discover` version probe, and a 5xx answer to it ends the
  connection attempt for good — which is exactly what the old relay returned whenever
  the endpoint (or a proxy, or a credential) was missing. Stitch answers the probe with
  a JSON-RPC "method not supported" at HTTP 200, so the direct row falls back to the
  classic handshake, connects, and lists the 16 tools even before a credential exists.
- A saved credential applies without a restart: the Host half rewrites `config.json`
  and asks the plugin manager to compose the MCP entry again, the same live path the
  Plugin Manager's own toggle uses.
- Versions before 0.6.0 pointed at an `@google/stitch` CLI that nothing installed, so a
  fresh machine had no way to connect at all.

### Upgrading from 0.5.x

The 0.5.x relay is a detached process and is not stopped by installing 0.6.0. Nothing
points at it any more, so it only idles — kill the `DeepSeek Harness.exe relay.js`
process (or reboot) to get the port back. The MCP row is replaced by the upgrade, so the
tools keep working either way.

## [0.5.0] - 2026-11-02

The transport was rebuilt around the documented remote endpoint, and the proxy
became an option instead of a requirement.

### Added

- Route selection per request. With no proxy configured the relay tries the direct
  route first and falls back to a proxy it finds on the machine (`HTTP(S)_PROXY` /
  `ALL_PROXY`, the Windows system proxy when enabled, or the usual local ports of a
  proxy client). A configured proxy is tried first, with the direct route as the
  fallback. The working route is remembered for five minutes.
- `GET /healthz` on the relay and a `route` field in `status.json`, so a failure says
  which route was attempted.
- `reconnect` on the MCP row (200 attempts, 3s cap): a relay that starts a moment
  late is picked up instead of staying disconnected.

### Changed

- One runtime file describes the setup: `~/.dsh/dsh-runtimes/stitch-mcp/config.json`.
  It is re-read on every request, so a new credential or proxy applies immediately.
- The launchers in `scripts/` are no longer needed for Stitch; the proxy lives in
  the plugin card.
- Turning the proxy switch off now really means "no proxy configured": the value
  kept in `config.json` is no longer inherited.

### Fixed

- The relay no longer depends on `NODE_USE_ENV_PROXY`. It opens the proxy tunnel with
  a plain `CONNECT` request and hands the socket to the HTTPS agent, so it works
  under the embedded runtime.
- A plugin that activates before the credentials service is ready no longer wipes the
  stored configuration: the credential is resolved from the credentials service, then
  from the credentials file on disk, then from the environment, then from the previous
  `config.json`, and written as a merge.
- An empty `X-Goog-Api-Key` sent by the MCP row could shadow the stored credential;
  the relay now owns the credential headers.

## [0.4.6]

### Fixed

- Credentials are delivered through the runtime `.env` file instead of a `!!js`
  config expression, which could be evaluated before the host half ran.

## [0.4.3]

### Added

- Bilingual UI copy (English and Chinese), selected from the harness locale with a
  browser-language fallback.

### Changed

- Credential card rewritten for density: one-line hints, inline status badge, and
  the create-key/login-command actions moved next to the field they serve.

## [0.4.2]

### Changed

- English-only source: every UI string and the README were translated.

## [0.4.0]

### Added

- MCP connection to Google Stitch through the official `@google/stitch` CLI (stdio).
- Credential card in `plugins.bundle.config`: API Key and OAuth tabs backed by the
  host `credentials` service.
- Display metadata (locale title/description, icon).

[0.6.0]: https://github.com/oooplz/dsh-stitch-mcp/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/oooplz/dsh-stitch-mcp/compare/v0.4.6...v0.5.0
[0.4.6]: https://github.com/oooplz/dsh-stitch-mcp/compare/v0.4.3...v0.4.6
[0.4.3]: https://github.com/oooplz/dsh-stitch-mcp/compare/v0.4.2...v0.4.3
[0.4.2]: https://github.com/oooplz/dsh-stitch-mcp/compare/v0.4.0...v0.4.2
[0.4.0]: https://github.com/oooplz/dsh-stitch-mcp/releases/tag/v0.4.0
