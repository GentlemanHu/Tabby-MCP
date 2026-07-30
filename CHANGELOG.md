# Changelog

All notable changes to Tabby-MCP will be documented in this file.

## [1.6.3-rc.1] - 2026-07-27

> ⚠️ **Prerelease.** Published to GitHub only, not to npm. Everything here passes typecheck, smoke regression checks, and a production build.
>
> **Exercised in a real Tabby session:** keyboard-interactive authentication end to end — MFA submission through to the Jumpserver asset menu, on Tabby 1.0.229 and 1.0.235 for macOS.
>
> **Not yet exercised in a real Tabby session:** dialog focus restoration, live SFTP transfer cancellation, and multi-instance port handover. These still need hands-on testing before a stable 1.6.3.

### ✨ Added
- **SSH keyboard-interactive authentication**: added `submit_keyboard_interactive_response` for MFA/TOTP and password prompts rendered by Tabby's authentication panel rather than the terminal PTY. Prompt metadata supports both current string prompts and object-shaped prompts from older Tabby releases.
- **Authentication state in `get_session_list`**: sessions now report `sshConnected`, `keyboardInteractivePending`, and non-secret prompt metadata so a client can tell that a session is waiting on MFA.

### 🔒 Security
- **Pair Programming approval coverage** (Issue #9): `send_input` now always follows command-confirmation settings after escape decoding; sensitive SFTP operations are independently controlled by the SFTP confirmation setting.
- **Authentication response approval**: keyboard-interactive responses follow Pair Programming confirmation, while credential values remain excluded from confirmation details and logs.
- **Complete approval payloads**: confirmation dialogs show the complete decoded terminal input or SFTP write content rather than a truncated preview.
- **Loopback hardening**: the service binds and publishes only `127.0.0.1`; Host and Origin validation now reject non-loopback and wrong-port requests across MCP endpoints.
- **Direct tool API disabled by default**: the compatibility-only `/api/tool/:name` endpoint requires explicit configuration.

### 🐛 Fixed
- **Tabby 1.0.235 startup compatibility**: tolerate `ConfigService.store` being unavailable during early Angular service construction instead of forcing Tabby into third-party-plugin safe mode.
- **Issue #5 — restart after an unclean shutdown**: added single-flight server startup, stop-aware startup cancellation, retry/backoff, stale-instance detection, and authenticated same-install port handover.
- **Issue #7 — terminal focus and IME disruption**: replaced blocking browser dialogs with queued non-blocking dialogs that restore the previous focus after resolving.
- **Streamable HTTP conformance**: delegated GET and DELETE handling to the MCP SDK so session, protocol, Accept-header, standalone SSE, and one-stream validation are enforced consistently.
- **Legacy SSE compatibility**: pass the JSON body already consumed by Express to SDK message handling; clear per-session servers for all transport close paths.
- **SFTP cancellation**: cancellation persists through session setup, cancels only the transfer stream instead of the shared SFTP session, preserves `cancelled` state, and stops stale progress updates.
- **SFTP session targeting**: added `profileName` matching consistent with terminal tools.
- **Environment probing**: corrected the fish active-probe control-flow syntax.
- **Logging**: error-level entries are retained even when ordinary logging is disabled.

### 🧰 Changed
- Pinned `@modelcontextprotocol/sdk` to `1.25.2` and committed `package-lock.json` for reproducible installs.
- Added `typecheck`, smoke-test, full-check, declaration-generation, and prepack quality gates.
- Included the STDIO bridge in published package files.
- Updated English and Simplified Chinese documentation, translations, contribution workflow, and project file guide.

## [1.6.2] - 2026-06-06

### ✨ Added
- **`get_session_environment` tool**: Added robust environment detection tool to intelligently probe if a session is currently running a shell, python, mysql, sqlite, etc. 
  - Dual modes included: `heuristic` (passive ANSI-cleaned buffer scan) and `active` (low-risk active probing).
  - Defaults to **disabled** and is fully configurable via Tabby Settings. When disabled, the tool is strictly omitted from registration to prevent AI hallucination.
- **Environment Detection Config UI**: Full settings tab integration with i18n support (zh-CN, en-US) and risk warnings.

### 🔧 Fixed
- **NPM Publish Workflow**: Stabilized GitHub Action publish workflow using pure Node 24 and NPM token mode, bypassing persistent OIDC trusted publisher 404 blockages.
- **Config-Ready Lifecycle Crash**: Fixed a critical crash on boot (`TypeError: Cannot read properties of undefined (reading 'mcp')`) caused by eager configuration evaluation during early tool registration.

## [1.6.1] - 2026-06-06

### 🔧 Fixed
- **`quick_connect` false success / wrong protocol selection** (refs #3, #5, #6)
  - `quick_connect` now reuses the same tab/session/ready response chain as `open_profile`
  - Fixed top-level `tabId` / `tabIndex` reporting for tabs wrapped by `SplitTabComponent`
  - `protocol="auto"` now prefers SSH for `user@host` targets instead of depending on provider registration order
  - Added explicit protocol selection support for `ssh`, `telnet`, `socket`, and `serial`
  - Removed stale SSH-only validation that incorrectly rejected non-SSH URI forms
- **Plugin shutdown cleanup** (refs #5)
  - Added best-effort MCP server stop during plugin/window unload to reduce restart-time port conflicts

## [1.3.0] - 2026-02-04

### 🔧 Fixed
- **Session disconnect detection**: Fixed false positive disconnection errors caused by incorrect type checking
  - `tab.destroyed` is a `Subject<void>` (RxJS Observable), NOT a boolean
  - Now correctly detecting disconnection via `session.open === false` only
  - Affects `exec_command`, `send_input`, and stream capture modes

### 🗑️ Removed
- **SFTP Advanced Tuning**: Removed non-functional "Chunk Size" and "Concurrency" settings
  - These settings had no effect with Tabby's `russh`-based SFTP implementation
  - Cleaned up UI, type definitions, and translations (zh-CN, en-US)
- **fastPut/fastGet detection code**: Removed obsolete detection logic for non-existent methods
  - Tabby's SFTP uses `russh` which doesn't support these optimizations

### ✏️ Changed
- **SFTP size descriptions**: Corrected default values in translations
  - Changed from "default: 10 MB" to "default: 10 GB" to match actual configuration
- **SFTP cancellation**: Added `cancelCallback` binding for proper transfer cancellation

### 🌐 i18n
- Updated both `zh-CN.json` and `en-US.json` with correct SFTP descriptions
- Removed 6 obsolete translation entries for Advanced Tuning section

---

## [1.2.0] - 2026-01-22

### Added
- i18n support (Chinese and English)
- `open_profile` now returns `sessionId` directly
- Enhanced SSH connection readiness detection

### Fixed
- SFTP upload/download schema validation
- MCP tool parameter passing issues

---

## [1.1.5] - 2026-01-20

### Added
- Comprehensive logging for all MCP operations
- SFTP file transfer tools (upload, download, list, read, write, etc.)

### Fixed
- Command output truncation issues
- Session tracking improvements

---

## [1.1.0] - Initial SFTP Release

### Added
- SFTP tool category (13 tools)
- Stable session IDs (UUID-based)
- Stream capture mode for long outputs
