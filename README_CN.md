<div align="center">

# 🚀 Tabby-MCP

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Tabby Plugin](https://img.shields.io/badge/Tabby-Plugin-purple.svg)](https://tabby.sh/)
[![MCP Protocol](https://img.shields.io/badge/MCP-Protocol-orange.svg)](https://modelcontextprotocol.io/)
[![GitHub Release](https://img.shields.io/github/v/release/GentlemanHu/Tabby-MCP?color=green)](https://github.com/GentlemanHu/Tabby-MCP/releases)
[![AI Generated](https://img.shields.io/badge/AI%20生成-95%25-ff69b4.svg)](#-关于本项目)
[![Tested on](https://img.shields.io/badge/已测试-macOS-lightgrey.svg)](#%EF%B8%8F-平台支持)

**Tabby 终端的全功能 MCP 服务器插件**

*将 AI 助手连接到您的终端 — 34 个 MCP 工具，包含 SFTP 支持*

[English](README.md) | [中文](README_CN.md)

</div>

---

> 🚀 **Tabby-MCP** 是专为 [Tabby Terminal](https://github.com/eugeny/tabby) 打造的强力插件，旨在弥合 AI Agent 与终端环境之间的鸿沟。它提供了标准化的 MCP 接口，让 AI 能够安全地执行命令、管理标签页并处理文件操作。
>
> *让你的 AI 拥有操作终端的“双手”。*

<div align="center">
  <img src="assets/tabby-mcp-intro.gif" width="100%" alt="Tabby-MCP Intro">
</div>

---

## ✨ 功能特性

<table width="100%">
  <tr>
    <td width="50%" align="center" valign="top">
      <h3>🖥️ 终端控制</h3>
      <ul align="left">
        <li>执行命令并捕获输出</li>
        <li><b>稳定会话 ID</b> (v1.1+)</li>
        <li>读取终端缓冲区内容</li>
        <li>中止正在运行的命令</li>
        <li>发送交互式输入</li>
      </ul>
    </td>
    <td width="50%" align="center" valign="top">
      <h3>📑 标签页管理</h3>
      <ul align="left">
        <li>创建/关闭/复制标签页</li>
        <li><b>分割窗格</b>（水平/垂直）</li>
        <li>在标签页之间导航</li>
        <li>左右移动标签页</li>
        <li>重新打开已关闭的标签页</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center" valign="top">
      <h3>🔗 配置文件管理</h3>
      <ul align="left">
        <li>列出所有终端配置文件</li>
        <li>使用配置文件打开新标签页</li>
        <li>SSH 快速连接</li>
        <li>配置文件选择对话框</li>
      </ul>
    </td>
    <td width="50%" align="center" valign="top">
      <h3>📁 SFTP 操作 (v1.1+)</h3>
      <ul align="left">
        <li>列出/读取/写入远程文件</li>
        <li>创建/删除目录</li>
        <li>重命名/移动文件</li>
        <li><i>（需要 tabby-ssh）</i></li>
      </ul>
    </td>
  </tr>
</table>

<div align="center">
  <h3>🔒 安全特性</h3>
  <p>结对编程模式（命令确认对话框） • 完善的日志记录 • 安全的命令执行</p>
</div>

---

## 📦 安装

### 方法一：Tabby 插件管理器（最简单）

在 Tabby 内置插件管理器中搜索 `tabby-mcp-server`：

1. 打开 Tabby → **设置** → **插件**
2. 搜索 `tabby-mcp-server`
3. 点击 **安装**
4. 重启 Tabby

---

### 方法二：快速安装脚本

**无需 Node.js！** 从 GitHub 下载预构建版本。

<details open>
<summary><b>🍎 macOS / 🐧 Linux</b></summary>

```bash
curl -fsSL https://raw.githubusercontent.com/GentlemanHu/Tabby-MCP/main/scripts/install.sh | bash
```

或下载后运行：
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

或下载后运行：
```powershell
Invoke-WebRequest -Uri https://raw.githubusercontent.com/GentlemanHu/Tabby-MCP/main/scripts/install.ps1 -OutFile install.ps1
.\install.ps1
```

</details>

---

### 方法三：从源码构建

需要 **Node.js 18+**。

```bash
# 克隆仓库
git clone https://github.com/GentlemanHu/Tabby-MCP.git
cd Tabby-MCP

# 构建并安装
bash scripts/build-and-install.sh
```

或手动操作：
```bash
npm install --legacy-peer-deps
npm run build
# 然后将 dist/ 和 package.json 复制到 Tabby 插件目录
```

---

### 🔄 安装后

1. **重启 Tabby**
2. 进入 **设置 → MCP**
3. 启动 MCP 服务器

---

## 🔌 连接 AI 客户端

### Cursor / Windsurf

添加到 `~/.cursor/mcp.json`：

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

### 其他客户端

| 端点 | URL | 协议版本 |
|------|-----|----------|
| Streamable HTTP | `http://localhost:3001/mcp` | 2025-03-26 (推荐) |
| Legacy SSE | `http://localhost:3001/sse` | 2024-11-05 |
| 健康检查 | `http://localhost:3001/health` | - |
| 服务器信息 | `http://localhost:3001/info` | - |

---

## 🛠️ 可用工具

### 终端控制（7 个）

| 工具 | 说明 |
|------|------|
| `get_session_list` | 列出所有终端会话（**包含稳定 UUID**） |
| `exec_command` | 执行命令（支持多种定位方式） |
| `send_input` | 发送交互式输入 (Ctrl+C 等) |
| `get_terminal_buffer` | 读取终端缓冲区（默认使用活跃会话） |
| `abort_command` | 中止正在运行的命令 |
| `get_command_status` | 监控活动命令状态 |
| `focus_pane` | 聚焦分割视图中的特定窗格 |

> **v1.1 新功能**: 所有终端工具支持灵活定位：
> - `sessionId`（稳定 UUID，推荐）
> - `tabIndex`（传统方式，可能变化）
> - `title`（部分匹配）
> - `profileName`（部分匹配）
> - 无参数 = 使用活跃会话

### 标签页管理（11 个）

| 工具 | 说明 |
|------|------|
| `list_tabs` | 列出所有打开的标签页（**包含稳定 ID**） |
| `select_tab` | 选中指定标签页 |
| `close_tab` | 关闭标签页 |
| `close_all_tabs` | 关闭所有标签页 |
| `duplicate_tab` | 复制标签页 |
| `split_tab` | **分割窗格**（左/右/上/下） |
| `next_tab` / `previous_tab` | 导航标签页 |
| `move_tab_left` / `move_tab_right` | 移动标签页 |
| `reopen_last_tab` | 重新打开已关闭的标签页 |

### 配置文件管理（4 个）

| 工具 | 说明 |
|------|------|
| `list_profiles` | 列出终端配置文件 |
| `open_profile` | 使用配置文件打开标签页 |
| `show_profile_selector` | 显示配置文件对话框 |
| `quick_connect` | SSH 快速连接 |

### SFTP 操作（12 个）🆕

> 需要 `tabby-ssh` 插件。如未安装，SFTP 工具自动禁用。

**基础操作：**

| 工具 | 说明 | 关键参数 |
|------|------|----------|
| `sftp_list_files` | 列出远程目录 | `path` |
| `sftp_read_file` | 读取远程文件（文本） | `path` |
| `sftp_write_file` | 写入文本到远程文件 | `path`, `content` |
| `sftp_mkdir` | 创建远程目录 | `path` |
| `sftp_delete` | 删除远程文件/目录 | `path` |
| `sftp_rename` | 重命名/移动远程文件 | `sourcePath`, `destPath` |
| `sftp_stat` | 获取文件/目录信息 | `path` |

**文件传输（支持同步/异步）：**

| 工具 | 说明 | 关键参数 |
|------|------|----------|
| `sftp_upload` | 上传本地文件 → 远程 | `localPath`, `remotePath`, `sync` |
| `sftp_download` | 下载远程 → 本地文件 | `remotePath`, `localPath`, `sync` |
| `sftp_get_transfer_status` | 查询传输进度 | `transferId` |
| `sftp_list_transfers` | 列出所有传输 | `status`（过滤） |
| `sftp_cancel_transfer` | 取消活跃传输 | `transferId` |

> **传输模式**：`sync=true`（默认）等待完成。`sync=false` 立即返回 `transferId`。
> 
> **大小限制**：可在设置 → MCP → SFTP 中配置。

---

## ⚙️ 配置选项

| 设置 | 说明 | 默认值 |
|------|------|--------|
| 端口 | MCP 服务器端口 | 3001 |
| 启动时运行 | 自动启动服务器 | true |
| 结对编程模式 | 执行前确认 | true |
| 会话跟踪 | 使用稳定 UUID | true |
| 后台执行 | 无需聚焦执行 | false |
| SFTP 启用 | 启用 SFTP 工具 | true |

---

## 🔄 后台执行模式

启用此模式允许 MCP 命令在**不切换焦点**的情况下执行。您可以继续在其他标签页工作，同时 AI 在后台执行命令。

**设置 → MCP → 后台执行**

> ⚠️ **风险提示：**
> - 你将无法实时看到命令执行过程
> - 如果你在目标终端输入时 AI 也在执行命令，输入会混乱
> - 对于分割窗格，命令发送到 `sessionId` 指定的窗格，而非聚焦的窗格
> - 危险命令可能在你不知情的情况下执行

> ✅ **建议：** 保持"结对编程模式"开启并启用确认对话框以确保安全。

---

## ⚠️ 平台支持

| 平台 | 状态 | 说明 |
|------|------|------|
| macOS | ✅ **已测试** | 完全功能 |
| Windows | ⚠️ 未测试 | 应该可用 — 欢迎反馈问题 |
| Linux | ⚠️ 未测试 | 应该可用 — 欢迎反馈问题 |

> **注意**：本插件在 macOS 上开发和测试。Windows 和 Linux 支持应该可用但未经验证。欢迎社区测试和反馈！

---

## 🤖 关于本项目

<div align="center">

### 🎨 95% 以上由 AI 生成

本项目几乎完全由 AI（Claude/Gemini）通过结对编程创建。  
人类的角色主要是提供需求和测试结果。

</div>

### 致谢

本项目在 [@thuanpham582002](https://github.com/thuanpham582002) 的 [tabby-mcp-server](https://github.com/thuanpham582002/tabby-mcp-server) 基础上构建。

**相比原项目的改进：**

| 特性 | 原项目 | 本项目 |
|------|--------|--------|
| MCP 工具 | 4 | **34** |
| 标签页管理 | ❌ | ✅ |
| 配置文件/SSH | ❌ | ✅ |
| SFTP 支持 | ❌ | ✅ |
| 稳定会话 ID | ❌ | ✅ |
| Streamable HTTP | ❌ | ✅ |
| 初始化 Bug | 存在问题 | ✅ 已修复 |
| 安装脚本 | 手动 | ✅ 一行命令 |

---

## 📝 更新日志

### v1.2.0 (2026-01-24)

**🔧 关键问题修复：**
- 🔴 **SFTP Session ID 混乱** - 修复了 SFTP 工具可能在错误的 SSH 服务器上执行的严重 Bug
  - 根因：SFTP 与 Terminal 使用了独立的 Session Registry，导致 ID 不一致
  - 修复：SFTP 现在与 Terminal 共享 Session Registry
  - SFTP 不再在 sessionId 匹配失败时静默回退到第一个 SSH Tab
- 🔴 **本地目录自动创建** - SFTP 下载现在会自动创建缺失的本地目录
- 🔴 **错误信息修正** - 修复了本地目录不存在时误报"远程文件不存在"的问题

**🎨 界面改进：**
- 📋 **连接监控** - 设置页新增"Connections"按钮（始终可见）
- 🛠️ **服务器生命周期** - 改进服务器重启，强制清理活动连接
- 📊 **会话跟踪** - 新增会话元数据和活动历史记录

**🔧 终端改进：**
- 🐚 **Heredoc 支持** - 修复复杂 Shell 命令（如 Python heredoc）执行失败的问题
- 📝 **详细日志** - 添加 `[findSSHSession]` 调试日志便于排查问题

### v1.1.6 (2026-01-22)

**改进优化：**
- 🎨 **设置界面美化** - 重新设计的头部布局，包含紧凑的社交图标链接（GitHub, npm）
- 🔗 **智能链接** - 所有外部链接现在都能正确通过默认浏览器打开
- 🔢 **自动版本号** - 插件版本号现在自动从 `package.json` 读取，无需手动维护
- 🧹 **界面精简** - 优化布局，移除冗余信息

### v1.1.5 (2026-01-22)

**新功能：**
- 🌐 **国际化（i18n）** - 设置界面现支持多语言
  - 英文（`en-US`、`en-GB`）
  - 简体中文（`zh-CN`、`zh-TW`）
  - 自动跟随 Tabby 语言设置
  - 可扩展：添加 JSON 文件即可支持新语言

### v1.1.4 (2026-01-22)

**新功能：**
- 🔄 **后台执行模式** - 无需切换终端焦点即可运行 MCP 命令
  - 设置界面包含详细的风险警告
  - 分割窗格焦点处理，精确定位目标窗格
- 🐚 **多 Shell 兼容** - `exec_command` 现支持 Fish、Bash、Zsh 和 sh
  - 从终端缓冲区自动检测 shell 类型
  - 针对不同 shell 的命令包装器以正确捕获退出码

**问题修复：**
- 🔧 修复 `open_profile` SSH 就绪检测 - 不再在 SSH 连接前提前返回
- 修复非 bash shell 的检测问题（Fish shell 使用 `$status` 而非 `$?`）

### v1.1.3 (2026-01-22)

**问题修复：**
- 🔧 修复 `open_profile` 返回的 sessionId 与 `get_session_list` 不一致的问题
- 修复 SSH 连接状态检测 - `ready` 现在正确反映整体连接状态

**改进：**
- `open_profile` 响应中更清晰的状态字段：
  - `tabReady`：Tab/前端已初始化
  - `sshConnected`：SSH 连接已建立（仅 SSH 配置文件）
  - `ready`：整体就绪状态（对于 SSH：tabReady AND sshConnected）
- 将所有 peerDependencies 标记为可选以防止不必要的包下载
- 添加 `tabby-ssh` 到 devDependencies 以确保开发者构建稳定性

### v1.1.2 (2026-01-22)

**优化：**
- 📦 通过将已打包的依赖移至 devDependencies 减小 npm 包大小
- 所有依赖（express, zod, @modelcontextprotocol/sdk）现在已打包到 dist/index.js
- 从 npm/Tabby 商店安装不再下载不必要的包

### v1.1.1 (2026-01-21)

**问题修复：**
- 🔧 修复 Streamable HTTP 连接泄漏问题 - 客户端断开后连接未被清理
- 添加 `transport.onclose` 处理器以正确清理关闭的会话
- 增强 SSE 流关闭日志以便更好地调试

### v1.1.0 (2026-01-20)

**主要修复：**
- **SFTP 工具完全重写** - 修复了所有 SFTP 工具返回 "No SSH session found" 的问题
- 修复 SSH 标签页检测以正确处理 `SplitTabComponent` 内的标签
- 修复 `get_terminal_buffer` 和 `select_tab` 无参数调用时返回错误的问题
- 修复 `select_tab` 无法通过 tabId 找到标签页的问题
- 修复 `quick_connect` 和 `open_profile` 参数验证问题

**改进：**
- 所有工具现在使用智能默认值：无参数 = 使用活跃会话/标签/第一个 SSH 会话
- 更新文档：工具数量修正为 34（终端 7 + 标签 11 + 配置文件 4 + SFTP 12）
- 添加详细的调试日志和更好的错误消息
- 在文档中添加 `focus_pane` 和 `split_tab` 工具说明
- 添加 Streamable HTTP 传输支持（协议 2025-03-26）
- 设置：SFTP 大小限制现在使用 MB 而不是字节
- 设置：更新 SFTP 说明（移除过时的 base64 警告）
- `open_profile` 现在返回 sessionId，无需额外查询
- 增强 SSH 连接状态检测，等待 SSH 会话真正建立

---

## 🤝 贡献

查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解贡献指南。

---

## 📄 许可证

MIT 许可证 - 见 [LICENSE](LICENSE)

---

<div align="center">

由 AI 和 [GentlemanHu](https://github.com/GentlemanHu) 用 ❤️ 制作

⭐ **如果觉得有用，请给个 Star！**

</div>
