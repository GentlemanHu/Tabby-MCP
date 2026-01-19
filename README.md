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

*Connect AI assistants to your terminal with full control capabilities — 18 MCP tools included*

[English](README.md) | [中文](README_CN.md)

</div>

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🖥️ Terminal Control
- Execute commands with output capture
- Read terminal buffer content
- Abort running commands
- List all terminal sessions

</td>
<td width="50%">

### 📑 Tab Management
- Create/Close/Duplicate tabs
- Navigate between tabs
- Move tabs left/right
- Reopen closed tabs

</td>
</tr>
<tr>
<td>

### 🔗 Profile Management
- List all terminal profiles
- Open new tabs with profiles
- SSH quick connect
- Profile selector dialog

</td>
<td>

### 🔒 Security Features
- Pair programming mode
- Command confirmation dialogs
- Comprehensive logging
- Safe command execution

</td>
</tr>
</table>

---

## 📦 Installation

### Method 1: Quick Install (Recommended)

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

### Method 2: Build from Source

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

### Cursor / Windsurf

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "Tabby MCP": {
      "type": "sse",
      "url": "http://localhost:3001/sse"
    }
  }
}
```

### Other Clients

| Endpoint | URL |
|----------|-----|
| SSE | `http://localhost:3001/sse` |
| Health | `http://localhost:3001/health` |
| Info | `http://localhost:3001/info` |

---

## 🛠️ Available Tools

### Terminal Control (4)

| Tool | Description |
|------|-------------|
| `get_session_list` | List all terminal sessions |
| `exec_command` | Execute command with output |
| `get_terminal_buffer` | Read terminal buffer |
| `abort_command` | Abort running command |

### Tab Management (10)

| Tool | Description |
|------|-------------|
| `list_tabs` | List all open tabs |
| `select_tab` | Focus a specific tab |
| `close_tab` | Close a tab |
| `close_all_tabs` | Close all tabs |
| `duplicate_tab` | Duplicate a tab |
| `next_tab` / `previous_tab` | Navigate tabs |
| `move_tab_left` / `move_tab_right` | Reorder tabs |
| `reopen_last_tab` | Reopen closed tab |

### Profile Management (4)

| Tool | Description |
|------|-------------|
| `list_profiles` | List terminal profiles |
| `open_profile` | Open tab with profile |
| `show_profile_selector` | Show profile dialog |
| `quick_connect` | SSH quick connect |

---

## ⚙️ Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| Port | MCP server port | 3001 |
| Start on Boot | Auto-start server | true |
| Pair Programming | Confirm commands | true |

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
| MCP Tools | 4 | **18** |
| Tab Management | ❌ | ✅ |
| Profile/SSH | ❌ | ✅ |
| Init Bug | Has issue | ✅ Fixed |
| Install Script | Manual | ✅ One-liner |

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
