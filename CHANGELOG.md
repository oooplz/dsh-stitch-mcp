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
