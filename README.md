<div align="center">

# 🚀 Tabby-MCP

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Tabby Plugin](https://img.shields.io/badge/Tabby-Plugin-purple.svg)](https://tabby.sh/)
[![MCP Protocol](https://img.shields.io/badge/MCP-Protocol-orange.svg)](https://modelcontextprotocol.io/)
[![GitHub Release](https://img.shields.io/github/v/release/GentlemanHu/Tabby-MCP?color=green)](https://github.com/GentlemanHu/Tabby-MCP/releases)
[![AI Generated](https://img.shields.io/badge/AI%20Generated-95%25-ff69b4.svg)](#-about-this-project)
[![Tested on](https://img.shields.io/badge/Tested%20on-macOS-lightgrey.svg)](#%EF%B8%8F-platform-support)

**A Comprehensive MCP Server Plugin for Tabby Terminal**

*Connect AI assistants to your terminal with full control — 34 MCP tools including SFTP support*

[English](README.md) | [中文](README_CN.md)

</div>

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🖥️ Terminal Control
- Execute commands with output capture
- **Stable session IDs** (v1.1+)
- Send interactive input (vim, less, top)
- Read terminal buffer content
- Abort/monitor running commands

</td>
<td width="50%">

### 📑 Tab Management
- Create/Close/Duplicate tabs
- **Split panes** (horizontal/vertical)
- Navigate between tabs
- Move tabs left/right
- Reopen closed tabs

</td>
</tr>
<tr>
<td>

### 🔗 Profile & SSH
- List all terminal profiles
- Open new tabs with profiles
- SSH quick connect
- Profile selector dialog

</td>
<td>

### 📁 SFTP Operations (v1.1+)
- List/read/write remote files
- Create/delete directories
- Rename/move files
- *(Requires tabby-ssh)*

</td>
</tr>
<tr>
<td colspan="2">

### 🔒 Security Features
- Pair programming mode with confirmation dialogs
- Comprehensive logging
- Safe command execution

</td>
</tr>
</table>

---

## 📦 Installation

### Method 1: Tabby Plugin Manager (Easiest)

Search for `tabby-mcp-server` directly in Tabby's built-in Plugin Manager:

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

### SSE Mode (Cursor / Windsurf)

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "Tabby MCP": {
      "type": "sse",
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
    "tabby-mcp": {
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
      "tabby-mcp": {
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
| `quick_connect` | SSH quick connect |

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
| SFTP Enabled | Enable SFTP tools | true |

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
