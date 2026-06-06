<div align="center">

# 🚀 Tabby-MCP

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Tabby Plugin](https://img.shields.io/badge/Tabby-Plugin-purple.svg)](https://tabby.sh/)
[![MCP Protocol](https://img.shields.io/badge/MCP-Protocol-orange.svg)](https://modelcontextprotocol.io/)
[![GitHub Release](https://img.shields.io/github/v/release/GentlemanHu/Tabby-MCP?color=green)](https://github.com/GentlemanHu/Tabby-MCP/releases)
[![npm version](https://img.shields.io/npm/v/tabby-mcp-server.svg?color=blue)](https://www.npmjs.com/package/tabby-mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/tabby-mcp-server.svg?color=blue)](https://www.npmjs.com/package/tabby-mcp-server)
[![AI Generated](https://img.shields.io/badge/AI%20Generated-95%25-ff69b4.svg)](#-about-this-project)
[![Tested on](https://img.shields.io/badge/Tested%20on-macOS-lightgrey.svg)](#%EF%B8%8F-platform-support)

**A Comprehensive MCP Server Plugin for Tabby Terminal**

*Connect AI assistants to your terminal with full control — 34 MCP tools including SFTP support*

[English](README.md) | [中文](README_CN.md)

</div>

---

> 🚀 **Tabby-MCP** is a powerful plugin for [Tabby Terminal](https://github.com/eugeny/tabby), bridging the gap between AI agents and your terminal environment. It provides a standardized MCP interface for AI to execute commands, manage tabs, and handle file operations securely.
>
> *Give your AI hands to work with.*

<div align="center">
  <img src="assets/tabby-mcp-intro.gif" width="100%" alt="Tabby-MCP Intro">
</div>

---

## ✨ Features

<table width="100%">
  <tr>
    <td width="50%" align="center" valign="top">
      <h3>🖥️ Terminal Control</h3>
      <ul align="left">
        <li>Execute commands with output capture</li>
        <li><b>Stable session IDs</b> (v1.1+)</li>
        <li>Send interactive input (vim, less, top)</li>
        <li>Read terminal buffer content</li>
        <li>Abort/monitor running commands</li>
      </ul>
    </td>
    <td width="50%" align="center" valign="top">
      <h3>📑 Tab Management</h3>
      <ul align="left">
        <li>Create/Close/Duplicate tabs</li>
        <li><b>Split panes</b> (horizontal/vertical)</li>
        <li>Navigate between tabs</li>
        <li>Move tabs left/right</li>
        <li>Reopen closed tabs</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center" valign="top">
      <h3>🔗 Profile & SSH</h3>
      <ul align="left">
        <li>List all terminal profiles</li>
        <li>Open new tabs with profiles</li>
        <li>SSH quick connect</li>
        <li>Profile selector dialog</li>
      </ul>
    </td>
    <td width="50%" align="center" valign="top">
      <h3>📁 SFTP Operations (v1.1+)</h3>
      <ul align="left">
        <li>List/read/write remote files</li>
        <li>Create/delete directories</li>
        <li>Rename/move files</li>
        <li><i>(Requires tabby-ssh)</i></li>
      </ul>
    </td>
  </tr>
</table>

<div align="center">
  <h3>🔒 Security Features</h3>
  <p>Pair programming mode with confirmation dialogs • Comprehensive logging • Safe command execution</p>
</div>

---

## 📦 Installation

### Method 1: Tabby Plugin Manager (Easiest)

Search for `tabby-mcp-server` directly in Tabby's built-in Plugin Manager:

<img width="640" height="262" alt="image" src="https://github.com/user-attachments/assets/0dc65801-1ad5-47fb-a666-779ac6c7d17e" />


1. Open Tabby → **Settings** → **Plugins**
2. Search for `tabby-mcp-server`
3. Click **Install**
4. Restart Tabby

---

### Method 2: Quick Install Script

**No Node.js required!** Downloads pre-built release from GitHub.

<details open>
<summary><b>🍎 macOS / 🐧 Linux</b></summary>

```bash
curl -fsSL https://raw.githubusercontent.com/GentlemanHu/Tabby-MCP/main/scripts/install.sh | bash
```

Or download and run:
```bash
wget https://raw.githubusercontent.com/GentlemanHu/Tabby-MCP/main/scripts/install.sh
bash install.sh
```

</details>

<details>
<summary><b>🪟 Windows (PowerShell)</b></summary>

```powershell
irm https://raw.githubusercontent.com/GentlemanHu/Tabby-MCP/main/scripts/install.ps1 | iex
```

Or download and run:
```powershell
Invoke-WebRequest -Uri https://raw.githubusercontent.com/GentlemanHu/Tabby-MCP/main/scripts/install.ps1 -OutFile install.ps1
.\install.ps1
```

</details>

---

### Method 3: Build from Source

Requires **Node.js 18+**.

```bash
# Clone
git clone https://github.com/GentlemanHu/Tabby-MCP.git
cd Tabby-MCP

# Build & Install
bash scripts/build-and-install.sh
```

Or manually:
```bash
npm install --legacy-peer-deps
npm run build
# Then copy dist/ and package.json to Tabby plugins folder
```

---

### 🔄 After Installation

1. **Restart Tabby**
2. Go to **Settings → MCP**
3. Start the MCP server

---

## 🔌 Connecting AI Clients

### Streamable HTTP Mode (Cursor / Windsurf / Cline)

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "Tabby MCP": {
      "type": "streamable_http",
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

### STDIO Mode (Claude Desktop / VS Code)

For clients that don't support SSE, use the STDIO bridge:

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "tabby-mcp-server": {
      "command": "node",
      "args": ["/path/to/Tabby-MCP/scripts/stdio-bridge.js"]
    }
  }
}
```

**VS Code / Other IDEs:**

```json
{
  "mcp": {
    "servers": {
      "tabby-mcp-server": {
        "type": "stdio",
        "command": "node",
        "args": ["scripts/stdio-bridge.js"],
        "cwd": "/path/to/Tabby-MCP"
      }
    }
  }
}
```

> **Note**: STDIO mode requires Node.js installed. The bridge script connects to the SSE server running in Tabby.

### Endpoints

| Endpoint | URL | Protocol |
|----------|-----|----------|
| Streamable HTTP | `http://localhost:3001/mcp` | 2025-03-26 (recommended) |
| Legacy SSE | `http://localhost:3001/sse` | 2024-11-05 |
| Health | `http://localhost:3001/health` | - |
| Info | `http://localhost:3001/info` | - |

---

## 🛠️ Available Tools

### Terminal Control (7)

| Tool | Description |
|------|-------------|
| `get_session_list` | List all terminal sessions with **stable UUIDs** and metadata |
| `exec_command` | Execute command with flexible session targeting |
| `send_input` | Send interactive input (Ctrl+C, etc) |
| `get_terminal_buffer` | Read terminal buffer (defaults to active session) |
| `abort_command` | Abort running command |
| `get_command_status` | Monitor active commands |
| `focus_pane` | Focus a specific pane in split view |

> **New in v1.1**: All terminal tools now support flexible session targeting:
> - `sessionId` (stable UUID, recommended)
> - `tabIndex` (legacy, may change)
> - `title` (partial match)
> - `profileName` (partial match)
> - No parameters = use active session

### Tab Management (11)

| Tool | Description |
|------|-------------|
| `list_tabs` | List all open tabs with **stable IDs** |
| `select_tab` | Focus a specific tab (defaults to active) |
| `close_tab` | Close a tab |
| `close_all_tabs` | Close all tabs |
| `duplicate_tab` | Duplicate a tab |
| `next_tab` / `previous_tab` | Navigate tabs |
| `move_tab_left` / `move_tab_right` | Reorder tabs |
| `reopen_last_tab` | Reopen closed tab |
| `split_tab` | Split current tab (horizontal/vertical) |

### Profile Management (4)

| Tool | Description |
|------|-------------|
| `list_profiles` | List terminal profiles |
| `open_profile` | Open tab with profile |
| `show_profile_selector` | Show profile dialog |
| `quick_connect` | Smart quick connect (SSH/telnet/socket/serial) |

### SFTP Operations (12) 🆕

> Requires `tabby-ssh` plugin. If not installed, SFTP tools are disabled automatically.

**Basic Operations:**

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `sftp_list_files` | List remote directory | `path` |
| `sftp_read_file` | Read remote file (text) | `path` |
| `sftp_write_file` | Write text to remote file | `path`, `content` |
| `sftp_mkdir` | Create remote directory | `path` |
| `sftp_delete` | Delete remote file/directory | `path` |
| `sftp_rename` | Rename/move remote file | `sourcePath`, `destPath` |
| `sftp_stat` | Get file/directory info | `path` |

**File Transfer (supports sync/async):**

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `sftp_upload` | Upload local file → remote | `localPath`, `remotePath`, `sync` |
| `sftp_download` | Download remote → local file | `remotePath`, `localPath`, `sync` |
| `sftp_get_transfer_status` | Query transfer progress | `transferId` |
| `sftp_list_transfers` | List all transfers | `status` (filter) |
| `sftp_cancel_transfer` | Cancel active transfer | `transferId` |

> **Transfer Modes**: `sync=true` (default) waits for completion. `sync=false` returns immediately with `transferId`.
> 
> **Size Limits**: Configurable in Settings → MCP → SFTP.

---

## ⚙️ Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| Port | MCP server port | 3001 |
| Start on Boot | Auto-start server | true |
| Pair Programming | Confirm commands | true |
| Session Tracking | Use stable UUIDs | true |
| Background Execution | Run without focus | false |
| SFTP Enabled | Enable SFTP tools | true |

---

## 🔄 Background Execution Mode

Enable this mode to allow MCP commands to run **without switching focus** to the terminal. This lets you continue working on other tabs while AI executes commands in the background.

**Settings → MCP → Background Execution**

> ⚠️ **Risks:**
> - You won't see commands executing in real-time
> - If you type in the target terminal while AI is running, input will conflict
> - For split panes, commands go to the `sessionId` target, not the focused pane
> - Dangerous commands could run without you noticing

> ✅ **Recommended:** Keep "Pair Programming Mode" enabled with confirmation dialogs for safety.

---

## ⚠️ Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| macOS | ✅ **Tested** | Fully functional |
| Windows | ⚠️ Untested | Should work — please report issues |
| Linux | ⚠️ Untested | Should work — please report issues |

> **Note**: This plugin has been developed and tested on macOS. Windows and Linux support should work but is unverified. Community testing and feedback welcome!

---

## 🤖 About This Project

<div align="center">

### 🎨 95%+ AI Generated

This project was created almost entirely by AI (Claude/Gemini) through pair programming.  
The human's role was primarily to provide requirements and test the results.

</div>

### Acknowledgments

This project builds upon the work of [tabby-mcp-server](https://github.com/thuanpham582002/tabby-mcp-server) by [@thuanpham582002](https://github.com/thuanpham582002).

**Improvements over the original:**

| Feature | Original | This Project |
|---------|----------|--------------|
| MCP Tools | 4 | **34** |
| Tab Management | ❌ | ✅ |
| Profile/SSH | ❌ | ✅ |
| SFTP Support | ❌ | ✅ |
| Stable Session IDs | ❌ | ✅ |
| Streamable HTTP | ❌ | ✅ |
| Init Bug | Has issue | ✅ Fixed |
| Install Script | Manual | ✅ One-liner |

---

## 📝 Changelog

### v1.6.0 (2026-06-06)

**🐛 Bug Fixes:**
- 🔧 **Fixed `quick_connect` false-success / protocol misrouting behavior** (refs #3, #5, #6)
  - `quick_connect` now shares the same tab/session/ready response chain as `open_profile`
  - Fixed top-level `tabId` / `tabIndex` reporting for newly opened tabs wrapped in `SplitTabComponent`
  - `protocol="auto"` now prefers SSH for `user@host`-style targets instead of depending on provider registration order
  - Added explicit protocol support for `ssh`, `telnet`, `socket`, and `serial` style quick-connect targets
  - Removed stale SSH-only validation that incorrectly rejected non-SSH URI forms such as `telnet://...`
- 🔧 **Improved plugin shutdown cleanup on app/window teardown** (refs #5)
  - Added best-effort server stop on plugin/window unload to reduce port reuse problems after restart

### v1.5.1 (2026-04-03)

**🐛 Bug Fixes:**
- 🔧 **Fixed `/api/tool/{name}` returning 404** (Issue #4) - Tool API endpoints were registered during `configureExpress()` when `toolCategories` was still empty due to Angular DI initialization order
  - Moved `configureToolEndpoints()` to `startServer()` where all tools are guaranteed to be registered
  - Added duplicate registration guard to prevent route duplication on server restart

### v1.4.0 (2026-03-02)

**🐛 Bug Fixes:**
- 🔧 **Fixed log export double-serialization** (Issue #1) - Exported JSON was incorrectly serialized as a string instead of proper JSON
- 🔧 **Fixed MCP config type** (Issue #2) - Config example now correctly shows `streamable_http` instead of `sse`
- 🔧 **Fixed hardcoded version numbers** - `/health` and `/info` endpoints now use `PLUGIN_VERSION` constant

**🏗️ Architecture Improvements:**
- 🔒 **Per-session McpServer isolation** - Each AI client now gets its own McpServer instance
  - Prevents one client's disconnect/reconnect from blocking other clients' requests
  - Fixes MCP SDK Bug #1459 stale callback interference
- 🔄 **SFTP session cache redesign** - Replaced `WeakMap` with `Map + TTL (5min)`
  - Proactive session expiration prevents stale SFTP sessions
  - Health check validation with `stat('/')` before reuse
  - SSH disconnect detection during active transfers
  - Periodic cleanup of closed SSH sessions from cache

**📦 Build & Install:**
- 📝 Fixed install scripts (`install.sh` / `install.ps1`) extraction failure
  - Archive directory name now consistently `tabby-mcp-server`
  - Backward compatible with old `tabby-mcp` directory names
  - Added prerelease support
  - Improved JSON parsing with python3 fallback

### v1.3.0 (2026-02-04)

**Bug Fixes:**
- 🔧 Fixed session disconnect false positives - `exec_command` and `send_input` no longer incorrectly report "Session disconnected"
  - Root cause: `tab.destroyed` is a `Subject<void>` (RxJS Observable), NOT a boolean
  - Now correctly uses `session.open === false` for disconnect detection

**Cleanup:**
- 🗑️ Removed non-functional SFTP "Advanced Tuning" settings (Chunk Size, Concurrency)
  - These had no effect with Tabby's `russh`-based SFTP implementation
- 🗑️ Removed obsolete `fastPut`/`fastGet` detection code

**i18n:**
- ✏️ Fixed SFTP size descriptions: corrected "10 MB" → "10 GB" in all translations

### v1.2.0 (2026-01-24)

**🔧 Critical Bug Fixes:**
- 🔴 **SFTP Session ID Mismatch** - Fixed critical bug where SFTP tools operated on wrong SSH server
  - Root cause: SFTP had separate session registry from Terminal, causing ID mismatch
  - Fix: SFTP now shares session registry with Terminal tools
  - SFTP no longer silently falls back to first SSH tab when sessionId doesn't match
- 🔴 **Local Directory Auto-Creation** - SFTP downloads now automatically create missing local directories
- 🔴 **Error Reporting** - Fixed misleading "Remote file not found" when local directory was missing

**🎨 UI Improvements:**
- 📋 **Connection Monitor** - Added "Connections" button to settings (always visible)
- 🛠️ **Server Lifecycle** - Improved server restart with forced socket cleanup
- 📊 **Session Tracking** - Added session metadata with activity history

**🔧 Terminal Improvements:**
- 🐚 **Heredoc Support** - Fixed complex shell commands (Python heredoc) execution
- 📝 **Detailed Logging** - Added `[findSSHSession]` debug logs for troubleshooting

### v1.1.6 (2026-01-22)

**Improvements:**
- 🎨 **Enhanced Settings UI** - Redesigned header with compact social links (GitHub, npm)
- 🔗 **Smart Links** - All external links now open correctly in default browser
- 🔢 **Auto-versioning** - Plugin version is now automatically read from `package.json`
- 🧹 **Cleaner UI** - Optimized layout and removed redundant sections

### v1.1.5 (2026-01-22)

**New Features:**
- 🌐 **Internationalization (i18n)** - Settings UI now supports multiple languages
  - English (`en-US`, `en-GB`)
  - Chinese Simplified (`zh-CN`, `zh-TW`)
  - Auto-follows Tabby's language setting
  - Extensible: easily add new languages by adding JSON files

### v1.1.4 (2026-01-22)

**New Features:**
- 🔄 **Background Execution Mode** - Run MCP commands without switching terminal focus
  - Settings UI with comprehensive risk warnings
  - Split pane focus handling for proper pane targeting
- 🐚 **Multi-shell Compatibility** - `exec_command` now supports Fish, Bash, Zsh, and sh
  - Auto-detects shell type from terminal buffer patterns
  - Shell-specific command wrappers for exit code capture

**Bug Fixes:**
- 🔧 Fixed `open_profile` SSH readiness detection - no longer returns prematurely before SSH is connected
- Fixed shell detection for non-bash shells (Fish shell `$status` vs `$?`)

### v1.1.3 (2026-01-22)

**Bug Fixes:**
- 🔧 Fixed `open_profile` sessionId inconsistency - now returns same sessionId as `get_session_list`
- Fixed SSH connection state detection - `ready` now correctly reflects overall connection status

**Improvements:**
- Clearer state fields in `open_profile` response:
  - `tabReady`: Tab/frontend initialized
  - `sshConnected`: SSH connection established (SSH profiles only)
  - `ready`: Overall ready state (for SSH: tabReady AND sshConnected)
- Marked all peerDependencies as optional to prevent unnecessary package downloads
- Added `tabby-ssh` to devDependencies for developer build stability

### v1.1.2 (2026-01-22)

**Optimization:**
- 📦 Reduced npm package size by moving bundled dependencies to devDependencies
- All dependencies (express, zod, @modelcontextprotocol/sdk) are now bundled into dist/index.js
- Installing from npm/Tabby store no longer downloads unnecessary packages

### v1.1.1 (2026-01-21)

**Bug Fixes:**
- 🔧 Fixed Streamable HTTP connection leak - connections were not being cleaned up when clients disconnected
- Added `transport.onclose` handler to properly remove closed sessions from tracking
- Enhanced SSE stream close logging for better debugging

### v1.1.0 (2026-01-20)

**Major Fixes:**
- **SFTP tools completely rewritten** - Fixed all SFTP tools that were returning "No SSH session found"
- Fixed SSH tab detection to properly handle tabs inside `SplitTabComponent`
- Fixed `get_terminal_buffer` and `select_tab` returning error when called without parameters
- Fixed `select_tab` tool not finding tabs by tabId (bidirectional lookup)
- Fixed `quick_connect` and `open_profile` parameter validation issues

**Improvements:**
- All tools now use smart defaults: no parameters = use active session/tab/first SSH session
- Updated documentation: tool count corrected to 34 (Terminal 7 + Tab 11 + Profile 4 + SFTP 12)
- Added detailed debug logging and better error messages
- Added `focus_pane` and `split_tab` to documentation
- Added Streamable HTTP transport support (protocol 2025-03-26)
- Settings: SFTP size limits now use MB instead of bytes
- Settings: Updated SFTP notes (removed outdated base64 warning)

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 📄 License

MIT License - see [LICENSE](LICENSE)

---

<div align="center">

Made with ❤️ by AI and [GentlemanHu](https://github.com/GentlemanHu)

⭐ **Star this repo if you find it useful!**

</div>
