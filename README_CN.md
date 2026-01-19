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

*将 AI 助手连接到您的终端，实现完整控制 — 包含 18 个 MCP 工具*

[English](README.md) | [中文](README_CN.md)

</div>

---

## ✨ 功能特性

<table>
<tr>
<td width="50%">

### 🖥️ 终端控制
- 执行命令并捕获输出
- 读取终端缓冲区内容
- 中止正在运行的命令
- 列出所有终端会话

</td>
<td width="50%">

### 📑 标签页管理
- 创建/关闭/复制标签页
- 在标签页之间导航
- 左右移动标签页
- 重新打开已关闭的标签页

</td>
</tr>
<tr>
<td>

### 🔗 配置文件管理
- 列出所有终端配置文件
- 使用配置文件打开新标签页
- SSH 快速连接
- 配置文件选择对话框

</td>
<td>

### 🔒 安全特性
- 结对编程模式
- 命令确认对话框
- 完善的日志记录
- 安全的命令执行

</td>
</tr>
</table>

---

## 📦 安装

### 方法一：快速安装（推荐）

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

### 方法二：从源码构建

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
      "url": "http://localhost:3001/sse"
    }
  }
}
```

### 其他客户端

| 端点 | URL |
|------|-----|
| SSE | `http://localhost:3001/sse` |
| 健康检查 | `http://localhost:3001/health` |
| 服务器信息 | `http://localhost:3001/info` |

---

## 🛠️ 可用工具

### 终端控制（4 个）

| 工具 | 说明 |
|------|------|
| `get_session_list` | 列出所有终端会话 |
| `exec_command` | 执行命令并获取输出 |
| `get_terminal_buffer` | 读取终端缓冲区 |
| `abort_command` | 中止正在运行的命令 |

### 标签页管理（10 个）

| 工具 | 说明 |
|------|------|
| `list_tabs` | 列出所有打开的标签页 |
| `select_tab` | 选中指定标签页 |
| `close_tab` | 关闭标签页 |
| `close_all_tabs` | 关闭所有标签页 |
| `duplicate_tab` | 复制标签页 |
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

---

## ⚙️ 配置选项

| 设置 | 说明 | 默认值 |
|------|------|--------|
| 端口 | MCP 服务器端口 | 3001 |
| 启动时运行 | 自动启动服务器 | true |
| 结对编程模式 | 执行前确认 | true |

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
| MCP 工具 | 4 | **18** |
| 标签页管理 | ❌ | ✅ |
| 配置文件/SSH | ❌ | ✅ |
| 初始化 Bug | 存在问题 | ✅ 已修复 |
| 安装脚本 | 手动 | ✅ 一行命令 |

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
