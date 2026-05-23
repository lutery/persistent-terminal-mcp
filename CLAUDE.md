# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Version Management

**每次变更必须更新版本号码**，遵循语义化版本规范：

- **主版本号 (MAJOR)**：不兼容的 API 变更
- **次版本号 (MINOR)**：向后兼容的功能新增
- **修订号 (PATCH)**：向后兼容的问题修复

版本号位于 `package.json` 的 `version` 字段。变更流程：
1. 更新 `package.json` 版本号
2. 执行 `npm run build`
3. 执行 `npm install -g .`（如需全局安装）
4. 提交代码并注明版本变更

当前版本：**1.1.0**

## Project Overview

Persistent Terminal MCP Server - A Model Context Protocol (MCP) server for managing persistent terminal sessions using `node-pty`. Enables AI assistants (Claude, Cursor, Codex, Cline) to execute long-running commands without blocking.

## Build and Development Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript → dist/
npm start            # Run compiled MCP server (stdio)
npm start:rest       # Run compiled REST server

# Development (run TypeScript directly with tsx)
npm run dev          # MCP server
npm run dev:rest     # REST server

# Testing
npm test                     # Jest unit tests
npm run test:integration     # All integration tests
npm run test:tools           # Exercise all MCP tools end-to-end
npm run test:fixes           # Regression tests for recent fixes
npm run test:all             # Both unit and integration

# Example scripts
npm run example:basic        # Basic terminal operations
npm run example:smart        # Smart read modes (head/tail)
npm run example:spinner      # Spinner compression demo
npm run example:webui        # Web UI demo
```

## Architecture

### Core Components

- **PersistentTerminalMcpServer** (`src/mcp-server.ts`) - MCP protocol server, registers 10 tools for terminal management
- **TerminalManager** (`src/terminal-manager.ts`) - Creates/manages PTY processes via `node-pty`, session tracking with UUIDs
- **OutputBuffer** (`src/output-buffer.ts`) - Circular buffer (default 10,000 lines) with spinner detection and compression
- **WebUIServer** (`src/web-ui-server.ts`) - Express + WebSocket for real-time terminal UI with xterm.js

### MCP Tools Provided

| Tool | Purpose |
|------|---------|
| `create_terminal` / `create_terminal_basic` | Create PTY session |
| `write_terminal` | Send input to terminal |
| `read_terminal` | Read output (modes: full, head, tail, head-tail; raw mode for TUI apps) |
| `wait_for_output` | Wait for stable output |
| `get_terminal_stats` / `list_terminals` | Session inspection |
| `kill_terminal` | Terminate session |
| `open_terminal_ui` | Launch web management UI |
| `fix_bug_with_codex` | Codex CLI integration for automated bug fixing |

### Critical: Stdio Purity

All logs must go to `stderr` to keep `stdout` clean for MCP JSON-RPC communication. Never use `console.log()` - use `console.error()` or the debug logger instead. This is essential for compatibility with strict MCP clients like Cursor.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_BUFFER_SIZE` | 10000 | Output buffer max lines |
| `SESSION_TIMEOUT` | 86400000 | Session timeout (24h ms) |
| `COMPACT_ANIMATIONS` | true | Spinner compression |
| `READ_TERMINAL_MAX_CHARS` | 12000 | Max chars per read |
| `MCP_DEBUG` | false | Debug logging to stderr |

## Coding Guidelines

- TypeScript strict mode, ES Modules
- Validate all external input with `zod` schemas
- Prefer `async`/`await` over raw promise chains
- Keep functions small; add comments only for non-obvious behavior
- Conventional commit style: `feat:`, `fix:`, `docs:`

## Key Technical Details

- **TUI Support**: Use `raw: true` in `read_terminal` for applications like Codex CLI or vim; this reads raw PTY output without buffer processing
- **Cross-platform**: Windows uses `cmd /c` wrappers for shell commands
- **Package exports**: Multiple entry points available (main, rest-server, terminal-manager, types)
- **node-pty version**: Pinned to 1.0.0 to avoid spawn issues on some platforms
