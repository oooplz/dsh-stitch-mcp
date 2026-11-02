# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/oooplz/dsh-stitch-mcp/compare/v0.4.3...HEAD
[0.4.3]: https://github.com/oooplz/dsh-stitch-mcp/compare/v0.4.2...v0.4.3
[0.4.2]: https://github.com/oooplz/dsh-stitch-mcp/compare/v0.4.0...v0.4.2
[0.4.0]: https://github.com/oooplz/dsh-stitch-mcp/releases/tag/v0.4.0

## Unreleased

### Fixed
- The relay no longer depends on `NODE_USE_ENV_PROXY`: it opens the proxy tunnel
  with a plain `CONNECT` request and hands the socket to the HTTPS agent, so it
  works under the embedded runtime and the proxy can change at runtime.
- A plugin that activates before the credentials service is ready no longer wipes
  the stored configuration: the credential is resolved from the credentials
  service, then the credentials file on disk, then the environment, then the
  previous `config.json`, and written as a merge.
- The credential and the proxy are read from `config.json` on every request, so a
  changed value applies immediately instead of after a restart.
- The MCP row retries the connection (200 attempts, 3s cap) so a relay that starts
  a moment late is picked up instead of staying disconnected.

### Changed
- One runtime file describes the setup: `~/.dsh/dsh-runtimes/stitch-mcp/config.json`.
  The proxy launchers in `scripts/` are no longer needed for Stitch.

### Changed (routing)
- A machine without a proxy no longer needs any configuration: the relay tries the
  direct route first and falls back to a proxy it finds on the machine —
  `HTTP(S)_PROXY` / `ALL_PROXY`, the Windows system proxy when enabled, or the usual
  local ports of a proxy client. A configured proxy is tried first, with the direct
  route as a fallback, and the working route is remembered for five minutes.
- Turning the proxy switch off now really means "no proxy configured": the value
  kept in `config.json` is no longer inherited.
