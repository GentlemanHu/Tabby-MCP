<div align="center">

# 🚀 Tabby-MCP

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Tabby Plugin](https://img.shields.io/badge/Tabby-Plugin-purple.svg)](https://tabby.sh/)
[![MCP Protocol](https://img.shields.io/badge/MCP-Protocol-orange.svg)](https://modelcontextprotocol.io/)
[![GitHub Release](https://img.shields.io/github/v/release/GentlemanHu/Tabby-MCP?color=green)](https://github.com/GentlemanHu/Tabby-MCP/releases)
[![npm version](https://img.shields.io/npm/v/tabby-mcp-server.svg?color=blue)](https://www.npmjs.com/package/tabby-mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/tabby-mcp-server.svg?color=blue)](https://www.npmjs.com/package/tabby-mcp-server)
[![AI Generated](https://img.shields.io/badge/AI%20生成-95%25-ff69b4.svg)](#-关于本项目)
[![Tested on](https://img.shields.io/badge/已测试-macOS-lightgrey.svg)](#%EF%B8%8F-平台支持)

**Tabby 终端的全功能 MCP 服务器插件**

*将 AI 助手连接到您的终端 — 36 个 MCP 工具，包含 SFTP 支持*

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
  <p>命令、原始输入和敏感 SFTP 操作均使用非阻塞确认对话框 • 服务器仅监听本机回环地址 • 完善的日志记录</p>
</div>


> **v1.6.3 安全模型：** 结对编程模式通过非阻塞确认对话框保护 `exec_command`、`send_input`、键盘交互式认证响应和敏感 SFTP 操作；两分钟无人处理时自动拒绝。认证响应值绝不会显示在确认详情中。对话框关闭后会恢复终端焦点，避免 Electron/xterm 的键盘和输入法问题。只读的传输状态工具和用于紧急中止的 `abort_command` 无需确认。网络仅限本机回环地址（`127.0.0.1`），两种 MCP 传输均验证 Origin，直连工具 API 默认关闭。

---

## 📦 安装

### 方法一：Tabby 插件管理器（最简单）

在 Tabby 内置插件管理器中搜索 `tabby-mcp-server`：
<img width="640" height="262" alt="image" src="https://github.com/user-attachments/assets/d3d410db-35f8-4664-99e2-796bb3f8be03" />

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

### Cursor / Windsurf / Cline (Streamable HTTP)

添加到 `~/.cursor/mcp.json`：

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

### 其他客户端

| 端点 | URL | 协议版本 |
|------|-----|----------|
| Streamable HTTP | `http://127.0.0.1:3001/mcp` | 2025-03-26 (推荐) |
| Legacy SSE | `http://127.0.0.1:3001/sse` | 2024-11-05 |
| 健康检查 | `http://127.0.0.1:3001/health` | - |
| 服务器信息 | `http://127.0.0.1:3001/info` | - |

---

## 🛠️ 可用工具

### 终端控制（9 个）

| 工具 | 说明 |
|------|------|
| `get_session_list` | 列出所有终端会话（**包含稳定 UUID**） |
| `exec_command` | 执行命令（支持多种定位方式） |
| `send_input` | 发送交互式输入 (Ctrl+C 等) |
| `submit_keyboard_interactive_response` | 提交 MFA、密码或其他 SSH 键盘交互式认证响应 |
| `get_terminal_buffer` | 读取终端缓冲区（默认使用活跃会话） |
| `abort_command` | 中止正在运行的命令 |
| `get_command_status` | 监控活动命令状态 |
| `focus_pane` | 聚焦分割视图中的特定窗格 |
| `get_session_environment` | 探测 Shell/REPL 环境（可选，默认关闭） |

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
| `quick_connect` | 智能快速连接（SSH/telnet/socket/serial） |

### SFTP 操作（12 个）🆕

> 需要 `tabby-ssh`。如果未安装，或在设置中关闭了 SFTP，新建 MCP 会话将不会暴露这 12 个工具。启用结对编程确认后，目录列表、元数据读取、文件读写、传输、删除、重命名、创建目录及取消传输均需用户批准。

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
| 结对编程模式 | 确认命令、原始输入和敏感 SFTP 操作 | true |
| SFTP 操作确认 | 将确认对话框应用于敏感 SFTP 操作（`send_input` 始终遵循命令确认设置） | true |
| 会话跟踪 | 使用稳定 UUID | true |
| 后台执行 | 无需聚焦执行 | false |
| SFTP 启用 | 启用 SFTP 工具 | true |
| 环境探测 | 暴露 `get_session_environment` | false |
| 直连工具 API | 启用兼容端点 `/api/tool/:name`（仅支持手动配置） | false |

---

## 🔄 后台执行模式

启用此模式允许 MCP 命令在**不切换焦点**的情况下执行。您可以继续在其他标签页工作，同时 AI 在后台执行命令。

**设置 → MCP → 后台执行**

> ⚠️ **风险提示：**
> - 你将无法实时看到命令执行过程
> - 如果你在目标终端输入时 AI 也在执行命令，输入会混乱
> - 对于分割窗格，命令发送到 `sessionId` 指定的窗格，而非聚焦的窗格
> - 危险命令可能在你不知情的情况下执行

> ✅ **建议：** 保持结对编程模式、确认对话框和文件操作确认开启。服务器仅监听 `127.0.0.1`；直连 `/api/tool/:name` 兼容 API 默认关闭。

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
| MCP 工具 | 4 | **35** |
| 标签页管理 | ❌ | ✅ |
| 配置文件/SSH | ❌ | ✅ |
| SFTP 支持 | ❌ | ✅ |
| 稳定会话 ID | ❌ | ✅ |
| Streamable HTTP | ❌ | ✅ |
| 初始化 Bug | 存在问题 | ✅ 已修复 |
| 安装脚本 | 手动 | ✅ 一行命令 |

---

## 📝 更新日志

### v1.6.3-rc.1 (2026-07-27) — 预发布

> ⚠️ **预发布版本，尚未发布到 npm。** 这些修复已通过静态分析、类型检查、冒烟回归检查和生产构建验证，但**尚未在真实的 Tabby/Electron 环境中手动运行验证**。其中对话框焦点恢复、SFTP 传输的实际取消行为，以及多实例端口交接尤其需要实机测试。可从 [GitHub 预发布页面](https://github.com/GentlemanHu/Tabby-MCP/releases/tag/v1.6.3-rc.1) 安装，如遇异常请在对应 issue 下反馈。

- 修复 [Issue #9](https://github.com/GentlemanHu/Tabby-MCP/issues/9)：结对编程确认现在覆盖 `send_input` 和敏感 SFTP 操作；取消传输会真正终止底层传输。
- 修复 [Issue #7](https://github.com/GentlemanHu/Tabby-MCP/issues/7)：用非阻塞、可恢复焦点的对话框替代浏览器阻塞弹窗，并让命令聚焦行为遵循“自动聚焦终端”设置。
- 修复 [Issue #5](https://github.com/GentlemanHu/Tabby-MCP/issues/5)：仅监听回环地址、启动退避重试、旧实例识别，以及同一安装实例间经过认证的端口交接。
- 修复 SDK 1.25.2 下 Legacy SSE JSON 请求体处理、会话清理、失效 Streamable HTTP 会话、Origin 校验、fish 主动环境探测、SFTP 定位器一致性及 STDIO 重连/消息帧问题。
- 固定 `@modelcontextprotocol/sdk` 为 1.25.2，提交 `package-lock.json`，并新增类型检查、冒烟测试和构建质量门禁。
- 新增 `submit_keyboard_interactive_response`，用于处理 MFA/TOTP 等 SSH 键盘交互式认证；结对编程确认只显示响应数量，不显示认证值。
- 工具数量文档已校正为 36 个（通常可见 35 个；`get_session_environment` 为可选工具且默认关闭）。

完整版本历史请查看 [CHANGELOG.md](CHANGELOG.md)。

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
