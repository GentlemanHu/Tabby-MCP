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

*Connect AI assistants to your terminal with full control — 35 MCP tools including SFTP support*

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
  <p>Non-blocking confirmation dialogs for commands, raw input, and sensitive SFTP operations • Loopback-only server • Comprehensive logging</p>
</div>


> **Safety model (v1.6.3):** Pair Programming Mode gates `exec_command`, `send_input`, and sensitive SFTP operations with a non-blocking approval dialog that automatically rejects after two minutes. The dialog restores terminal focus to avoid Electron/xterm keyboard and IME issues. Read-only transfer-status tools and emergency `abort_command` remain available without approval. Network access is restricted to loopback (`127.0.0.1`), Origin validation is applied to both MCP transports, and the direct tool API is disabled by default.

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
      "url": "http://127.0.0.1:3001/mcp"
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
| Streamable HTTP | `http://127.0.0.1:3001/mcp` | 2025-03-26 (recommended) |
| Legacy SSE | `http://127.0.0.1:3001/sse` | 2024-11-05 |
| Health | `http://127.0.0.1:3001/health` | - |
| Info | `http://127.0.0.1:3001/info` | - |

---

## 🛠️ Available Tools

### Terminal Control (8)

| Tool | Description |
|------|-------------|
| `get_session_list` | List all terminal sessions with **stable UUIDs** and metadata |
| `exec_command` | Execute command with flexible session targeting |
| `send_input` | Send interactive input (Ctrl+C, etc) |
| `get_terminal_buffer` | Read terminal buffer (defaults to active session) |
| `abort_command` | Abort running command |
| `get_command_status` | Monitor active commands |
| `focus_pane` | Focus a specific pane in split view |
| `get_session_environment` | Detect shell/REPL context (optional; disabled by default) |

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

> Requires `tabby-ssh`. If it is not installed—or SFTP is disabled in Settings—all 12 SFTP tools are omitted for new MCP sessions. With Pair Programming confirmation enabled, directory listing, metadata reads, file reads/writes, transfers, deletes, renames, directory creation, and transfer cancellation require approval.

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
| Pair Programming | Confirm commands, raw input, and sensitive SFTP operations | true |
| Confirm SFTP Operations | Apply the approval dialog to sensitive SFTP operations (`send_input` always follows command confirmation) | true |
| Session Tracking | Use stable UUIDs | true |
| Background Execution | Run without focus | false |
| SFTP Enabled | Enable SFTP tools | true |
| Environment Detection | Expose `get_session_environment` | false |
| Direct Tool API | Enable compatibility endpoint `/api/tool/:name` (manual config only) | false |

---

## 🔄 Background Execution Mode

Enable this mode to allow MCP commands to run **without switching focus** to the terminal. This lets you continue working on other tabs while AI executes commands in the background.

**Settings → MCP → Background Execution**

> ⚠️ **Risks:**
> - You won't see commands executing in real-time
> - If you type in the target terminal while AI is running, input will conflict
> - For split panes, commands go to the `sessionId` target, not the focused pane
> - Dangerous commands could run without you noticing

> ✅ **Recommended:** Keep Pair Programming Mode, confirmation dialogs, and file-operation confirmation enabled. The server binds only to `127.0.0.1`; the direct `/api/tool/:name` compatibility API is disabled by default.

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
| MCP Tools | 4 | **35** |
| Tab Management | ❌ | ✅ |
| Profile/SSH | ❌ | ✅ |
| SFTP Support | ❌ | ✅ |
| Stable Session IDs | ❌ | ✅ |
| Streamable HTTP | ❌ | ✅ |
| Init Bug | Has issue | ✅ Fixed |
| Install Script | Manual | ✅ One-liner |

---

## 📝 Changelog

### v1.6.3 (2026-07-27)

- Fixed [Issue #9](https://github.com/GentlemanHu/Tabby-MCP/issues/9): Pair Programming approval now covers `send_input` and sensitive SFTP operations; transfer cancellation now stops the underlying transfer.
- Fixed [Issue #7](https://github.com/GentlemanHu/Tabby-MCP/issues/7): replaced blocking browser dialogs with a non-blocking focus-restoring dialog and made command focus honor the Auto-focus setting.
- Fixed [Issue #5](https://github.com/GentlemanHu/Tabby-MCP/issues/5): loopback-only bind, startup retry, stale-instance detection, and authenticated same-install port handover.
- Fixed Legacy SSE JSON body handling for SDK 1.25.2, session cleanup, stale Streamable HTTP session handling, Origin validation, fish active environment probes, SFTP locator consistency, and STDIO reconnect/framing behavior.
- Pinned `@modelcontextprotocol/sdk` to 1.25.2, committed `package-lock.json`, and added typecheck/smoke/build quality gates.
- Tool count is now documented accurately: 35 total (34 normally visible; `get_session_environment` is optional and disabled by default).

See [CHANGELOG.md](CHANGELOG.md) for the complete version history.

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
