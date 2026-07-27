# Contributing to Tabby-MCP

Thank you for your interest in contributing to Tabby-MCP! 🎉

## 🚀 Quick Start

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Tabby-MCP.git
   cd Tabby-MCP
   ```
3. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```
4. Create a branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## 🔧 Development

### Quality Checks

```bash
npm run check
```

`npm run check` runs TypeScript validation, smoke regression checks, and the production bundle. Run it before opening a pull request.

### Building

```bash
npm run build
```

### Watch Mode

```bash
npm run watch
```

### Testing the Plugin

1. Build the plugin
2. Run `bash scripts/install.sh`
3. Restart Tabby
4. Go to Settings → MCP to test

## 📝 Code Style

- Use TypeScript
- Follow existing code patterns
- Add comments for complex logic
- Use meaningful variable names

## 🧪 Adding New Tools

To add a new MCP tool, create it in the appropriate tool category:

1. **Terminal tools**: `src/tools/terminal.ts`
2. **Tab management**: `src/tools/tabManagement.ts`
3. **New category**: Create a new file in `src/tools/`

Example tool structure:

```typescript
private createMyNewTool(): McpTool {
  return {
    name: 'my_new_tool',
    description: 'Description of what this tool does',
    schema: {
      param1: z.string().describe('Parameter description')
    },
    handler: async (params: { param1: string }) => {
      // Tool implementation
      return { 
        content: [{ type: 'text', text: JSON.stringify({ success: true }) }] 
      };
    }
  };
}
```

## 📋 Pull Request Process

1. Update `README.md`, `README_CN.md`, and `CHANGELOG.md` if you add new features or change behavior
2. Keep `src/i18n/en-US.json` and `src/i18n/zh-CN.json` key sets identical
3. Run `npm run check`
4. Add yourself to the contributors list
5. Create a Pull Request with a clear description

## 🐛 Reporting Issues

When reporting issues, please include:

- Operating system
- Tabby version
- Error messages (if any)
- Steps to reproduce

## ⚠️ Platform Testing

Currently only macOS is fully tested. If you test on Windows or Linux:

- Please report your results!
- Include platform-specific fixes in PRs
- Update documentation for other platforms

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing! 🙏
