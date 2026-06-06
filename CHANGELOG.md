# Changelog

All notable changes to Tabby-MCP will be documented in this file.

## [1.6.1] - 2026-06-06

### ✨ Added
- **`get_session_environment` tool**: Detects terminal execution context (e.g. bash, Python, Node, MySQL) using buffer heuristics, helping AI agents avoid sending incorrect interactive commands.
- **Fixed NPM publish action**: Fallback to explicit tokens as strict OIDC configuration triggered E404s.

## [1.6.0] - 2026-06-06

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
