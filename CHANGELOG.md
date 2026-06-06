# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.1] - 2026-06-06

### Fixed

Review remediation for v1.2.0 code review findings (7 issues: 2 P0, 4 P1, 1 P2).

- **P0-1**: `getTerminalStatus()` now reads cooperative status from `statusFile` via `StatusProvider`. When valid, `semanticStatusConfidence` returns `'cooperative'` instead of `'heuristic'`. Only filename (not full path) is exposed in response.
- **P0-2**: `fast-xml-parser` added to `package.json` dependencies (was imported but undeclared).
- **P1-1**: `test:integration` in `package.json` now includes all 10 sub-scripts (was missing 6 v1.2.0 scripts).
- **P1-2**: `web-ui-server.test.ts` rewritten as real HTTP integration tests (was fake coverage calling TerminalManager directly).
- **P1-3**: `read_terminal` filter metadata (mode, adapter, confidence, removedLines, criticalLineCount) now returned in `TerminalReadResult.filter` field and appended to MCP text output. Previously discarded at terminal-manager.ts content_only/last_response branches.
- **P1-4**: Real CLI driver report sanitized (session IDs and local paths replaced with `[REDACTED]` markers).
- **P2**: MCP server version updated from hardcoded `'1.0.0'` to `'1.2.1'`. `ReadTerminalInput.mode` extended from 4 to 7 types (added `content_only`, `last_response`, `status`). `CreateTerminalInput` extended with `initCommands`, `readyPattern`, `readyTimeoutMs`, `initFailurePattern`, `statusFile`.

### Changed

- Windows PTY tests now gracefully skip via `IS_WINDOWS` flag and `ptyTest()` helper (no false failures).
- `web-ui-server.ts` `_dirname` resolution simplified: `typeof __dirname !== 'undefined' ? __dirname : process.cwd()` (removed `import.meta.url` that caused SyntaxError in ts-jest CJS context).

## [1.2.0] - 2026-06-06

### Added

#### New MCP Tools
- **`wait_for_pattern`**: Wait for a regex pattern to appear in terminal output, with timeout, snapshot, and capture group support
- **`wait_for_result`**: Wait for `<task_result>` XML block in terminal output and parse it with structured result (PASS/FAIL/ERROR)
- **`get_terminal_status`**: Get structured terminal status snapshot with semantic state detection (running/waiting_input/completed/error)
- **`resume_terminal`**: Resume a CLI agent session by creating a new PTY and running `claude --resume <sessionId>`

#### Enhanced MCP Tools
- **`create_terminal`**: Now accepts `initCommands`, `readyPattern`, `readyTimeoutMs`, `initFailurePattern`, `statusFile` for initialization workflows
- **`read_terminal`**: New modes `content_only` (filtered output) and `last_response` (extract last AI response), plus `adapter` parameter (generic/claude/codex)

#### New Modules
- **`OutputFilter`** (`src/output-filter.ts`): Conservative noise removal for TUI output - removes spinners, progress bars, diff borders while preserving critical lines (errors, file paths, test results)
- **`ResultParser`** (`src/result-parser.ts`): XML `<task_result>` block detection and parsing with `fast-xml-parser` (entities/DTD disabled for security)
- **`StatusProvider`** (`src/status-provider.ts`): JSON status file reader with zod validation, non-fatal error handling

#### REST API Extensions
- `GET /terminals/:id/status` - Structured status snapshot
- `POST /terminals/:id/wait-pattern` - Wait for pattern
- `POST /terminals/:id/wait-result` - Wait for XML result
- `POST /terminals/:id/resume` - Resume terminal session
- `POST /terminals` now accepts init options
- `GET /terminals/:id/output` now supports `adapter` parameter

#### Web UI Extensions
- Terminal list shows semantic status badges and relative last activity time
- Terminal detail page: status panel with refresh, output filter toggle (full/content_only/last_response), wait-pattern and wait-result operations, resume operation
- Create terminal modal supports init options
- WebSocket events: `pattern_matched`, `status_changed`

#### Core Methods
- `TerminalManager.waitForPattern()` - Poll terminal output for regex matches with incremental cursor scanning
- `TerminalManager.getTerminalStatus()` - Structured status with semantic analysis and confidence levels
- `TerminalManager.createTerminalWithInit()` - Sequential init commands + ready pattern wait
- `TerminalManager.resumeTerminal()` - Create new PTY with resume command

### Changed
- `TerminalSession` now stores `exitCode` and `exitSignal` for terminated process inspection
- Version bumped from 1.1.3 to 1.2.0 (MINOR - backward-compatible feature additions)
- Added `fast-xml-parser` dependency for XML result parsing

### Security
- XML parsing disables external entities, DTD, and network resolution
- Status file reading is non-fatal (never crashes on invalid/missing files)

## [1.0.9] - 2026-02-11

### Improved
- 强化 MCP 工具描述：`read_terminal` 明确“最后 N 行”在 Codex/TUI 场景下应优先使用 `tail + raw + cleanAnsi`，不完整时改用 `head-tail` 补读。
- 强化 `write_terminal` 描述：在 Codex 聊天等待提交时，明确建议使用 `input=""` + `sendEnter=true` 补发回车。
- 新增 MCP prompt：`codex-tui-best-practices`，提供可直接照抄的“读最后10行 + 回车补发 + 稳定轮询”工作流。

## [1.0.8] - 2026-02-11

### Fixed
- 修复 `read_terminal` 在 `raw=true` 时忽略 `mode=head/tail/head-tail` 的问题；现在可稳定读取“最后 N 行”与“头尾摘要”。

### Improved
- `read_terminal` 在 raw 模式返回中新增 `Raw Mode Filter` 和 `Raw Lines Omitted` 元数据，便于定位是否真正按 tail/head-tail 读取。
- 新增集成测试覆盖 raw tail/head-tail 行为，防止回归。

## [1.0.7] - 2026-02-11

### Fixed
- 修复交互式会话中“只发送回车”不稳定的问题：`write_terminal` 现在对空输入默认发送 Enter（CR），避免 Codex 聊天卡在等待提交状态。

### Added
- `write_terminal` 新增 `sendEnter` 参数：可显式强制发送回车键，适合“继续/提交”这类 Enter-only 场景。

### Improved
- MCP 工具描述与内置 usage prompt 增强：明确给出 Claude/Codex 场景下的 `read_terminal` 推荐参数组合（`tail + raw + cleanAnsi + maxChars`）。

## [1.0.6] - 2026-02-10

### Changed
- `read_terminal` 新增 `raw`、`cleanAnsi`、`maxChars` 参数，默认返回更适合 LLM 上下文的可读输出。
- `read_terminal` 默认不再自动启用 raw 重放，避免 full 模式下把大量 TUI 控制流直接塞进上下文。

### Improved
- 当 `raw=true` 时，默认执行 ANSI 清洗、控制字符过滤与重复刷屏折叠，显著降低 Codex/TUI 输出噪音。
- 新增单次响应字符保护（context guard），超长输出会自动截断并附带明确提示与增量读取建议。

## [1.0.5] - 2026-02-10

### Fixed
- 修复通过 `npx -y persistent-terminal-mcp` 运行 npm 包时，`create_terminal` 可能报错 `posix_spawnp failed` 的问题。
- 根因是 `node-pty` 使用了宽松版本范围导致安装到 `1.1.0`，在部分 macOS 场景下会触发 PTY 创建失败。

### Changed
- 将 `node-pty` 依赖从 `^1.0.0` 锁定为 `1.0.0`，确保与源码环境一致、避免 npm 安装时漂移。

## [1.0.4] - 2026-02-10

### Fixed
- 修复 Web UI 在反复打开终端详情页时的历史输出缺失问题，尤其是 `codex --yolo` 这类全屏 TUI 会话。
- 修复 `codex --yolo` 在 PTY 中启动时报错 `The cursor position could not be read within a normal duration` 的问题，新增终端查询自动应答（如 `ESC[6n`）。

### Added
- `read_terminal` 新增 `raw` 参数：可读取原始 PTY 输出流，避免 ANSI 光标控制导致的历史回放丢失。
- Web UI 详情页历史加载默认使用原始输出回放（`raw=true`），提升 Codex 会话历史可见性。
- TerminalManager 新增原始输出缓冲与增量 cursor 读取能力，并补充对应单元测试。

### Changed
- 非 Windows 平台默认 shell 优先使用环境变量 `SHELL`，回退 `/bin/bash`，改善 macOS 下默认 shell 兼容性。

## [1.0.3] - 2025-10-18

### Fixed
- 修复全局安装或通过 `npx` 调用时服务器未启动的问题：现在使用真实路径比较，确保符号链接
  与缓存目录都能正确识别入口脚本（`src/index.ts`）。

## [1.0.2] - 2025-10-18

### Added
- **🌐 Web UI 管理界面**: 基于浏览器的可视化终端管理界面
  - 使用 xterm.js 渲染终端输出，支持完整 ANSI 颜色
  - WebSocket 实时推送，终端输出实时显示
  - 直接在浏览器中发送命令、查看输出
  - 自动端口分配，支持多实例运行
  - VS Code 风格的暗色主题界面
  - 新增 `open_terminal_ui` MCP 工具
  - 新增 `WebUIManager` 和 `WebUIServer` 模块
  - 新增 Web UI 静态文件（public/）
  - 新增 Web UI 使用指南文档
- **📚 文档更新**: 全面更新中文 README，包含所有新功能说明

### Changed
- 更新 README.zh-CN.md，采用更清晰的结构和更详细的功能说明
- 优化文档导航，添加更多 emoji 图标提升可读性
- npm 包装清理：新增二进制入口（`persistent-terminal-mcp`、`persistent-terminal-mcp-rest`），
  导出完整类型定义，限制发布文件为 `dist/` 与核心静态资源，并更新文档以推荐 `npx`
  启动方式

### Fixed

#### 🔴 Critical: Terminal command execution and interaction issues
- **Problem 1: Commands not executing properly**
  - Commands sent to terminal were not being executed
  - No command echo visible in output
  - Terminal line count increased but content was invisible
- **Problem 2: Interactive input handling unstable**
  - Control characters (arrow keys, enter) not working reliably
  - Interface not updating in interactive applications
  - Required multiple key presses for single action
- **Problem 3: Output reading not real-time**
  - Reading stale output instead of latest
  - Required multiple reads to get current state
  - No way to detect if command is still running
- **Solution**:
  - Fixed PTY configuration: Changed from `xterm-color` to `xterm-256color`
  - Added proper environment variables: `TERM`, `LANG`, `PAGER`
  - Improved write logic with drain event handling
  - Added `setImmediate` for immediate data processing
  - Added `waitForOutputStable()` method to detect output completion
  - Added `wait_for_output` MCP tool for waiting until output stabilizes
- **Impact**: Full support for interactive applications (vim, npm create, etc.)
- **Testing**: All 6 tests pass in `test-terminal-fixes.mjs`
- **Documentation**: See [TERMINAL_FIXES.md](TERMINAL_FIXES.md) for detailed analysis

#### 🔴 Critical: Stdio channel pollution causing Cursor compatibility issues
- **Problem**: Console logging was polluting stdout, causing JSON parsing errors in Cursor and other strict MCP clients
  - Error: `Unexpected token 'T', "Terminal c"... is not valid JSON`
  - Cursor would freeze after a few commands
  - MCP protocol requires stdout to contain only JSON-RPC messages
- **Solution**: All logging now uses `process.stderr.write()` instead of `console.log/error`
  - Debug logs controlled by `MCP_DEBUG` environment variable
  - All logs output to stderr, keeping stdout pure for JSON-RPC
- **Impact**: Full compatibility with Cursor and other strict MCP clients
- **Backward Compatible**: Yes - no API changes, only logging behavior
- **Files Modified**:
  - `src/index.ts` - Fixed log function and error handlers
  - `src/mcp-server.ts` - Fixed event handlers and shutdown logging
  - `src/terminal-manager.ts` - Fixed cleanup and shutdown logging
- **Testing**: Added comprehensive stdio purity tests
  - `test-mcp-stdio.mjs` - Validates stdout contains only JSON-RPC
  - `test-cursor-scenario.mjs` - Simulates real Cursor usage scenarios
- **Documentation**: See [STDIO_FIX.md](STDIO_FIX.md) for detailed analysis

### Added
- **Spinner Animation Compaction**: Automatically detects and throttles progress animations
  - Identifies common spinner characters (⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏, ◐◓◑◒, etc.)
  - Reduces noise from `npm install`, `yarn`, `pnpm` and similar commands
  - Configurable via `COMPACT_ANIMATIONS` and `ANIMATION_THROTTLE_MS` environment variables
  - Enabled by default with 100ms throttle
  - Can be toggled per-read via `stripSpinner` parameter
  - See [Spinner Compaction Guide](docs/guides/spinner-compaction.md) for details
- **`wait_for_output` MCP tool**: Wait for terminal output to stabilize before reading
  - Parameters: `terminalId`, `timeout` (default: 5000ms), `stableTime` (default: 500ms)
  - Useful for ensuring complete output capture after running commands
  - Helps with interactive applications and long-running commands
- **`waitForOutputStable()` method**: Programmatic API for waiting for output stability
- **`isTerminalBusy()` method**: Check if terminal is currently processing output
- `create_terminal_basic` MCP tool to support clients that can only send simple
  string arguments
- Open-source collateral: MIT `LICENSE` and `CONTRIBUTING.md`
- Comprehensive test suite for spinner detection (12 new tests)
- Comprehensive test suite for terminal fixes (6 new tests)
- Example script: `npm run example:spinner`
- Test script: `test-terminal-fixes.mjs`
- `MCP_DEBUG` environment variable for controlling debug output

### Changed
- **PTY Configuration**: Changed terminal type from `xterm-color` to `xterm-256color`
- **Environment Variables**: Now sets `TERM`, `LANG`, and `PAGER` for better compatibility
- **Write Logic**: Improved with drain event handling and immediate processing
- **Read Logic**: Added `setImmediate` to ensure latest data is captured
- **Output Capture**: Using `setImmediate` in `onData` handler for immediate processing
- `OutputBuffer` constructor now accepts `compactAnimations` and `animationThrottleMs` options
- `TerminalManagerConfig` extended with animation compaction settings
- `read_terminal` MCP tool now supports optional `stripSpinner` parameter
- Consolidated documentation under [`docs/`](docs/README.md) with clearer
  filenames and an index
- Refreshed `README.md` with quick-start instructions and the expanded tool set
- All logging now uses stderr to comply with MCP stdio protocol requirements

## [1.0.1] - 2025-10-03

### Fixed

#### 🔴 Critical: Commands not executing automatically
- **Problem**: Commands sent to terminal were displayed but not executed
- **Solution**: `write_terminal` now automatically adds newline character if not present
- **Impact**: Users can now send `"pwd"` instead of `"pwd\n"`
- **Backward Compatible**: Yes - existing code with `\n` still works

#### 🟡 Medium: Terminated terminals still in list
- **Problem**: After `kill_terminal`, terminals remained in `list_terminals` with status "terminated"
- **Solution**: Terminals are now completely removed from all internal maps after termination
- **Impact**: Better memory management and cleaner terminal list
- **Backward Compatible**: Yes - no API changes

### Changed

- Updated `write_terminal` tool description to mention automatic newline addition
- Updated parameter descriptions to clarify newline behavior

### Added

- New test script: `npm run test:fixes` to verify bug fixes
- Comprehensive test coverage for command execution and terminal cleanup

### Documentation

- Added `docs/reference/bug-fixes.md` - Detailed technical report of fixes
- Added `docs/reference/test-response.md` - Response to AI testing teams
- Updated `docs/guides/usage.md` - Simplified command sending examples

---

## [1.0.0] - 2025-10-03

### Added

#### Core Features
- **Persistent Terminal Sessions**: Create and manage long-running terminal sessions
- **Output Buffering**: Circular buffer with configurable size (default 10,000 lines)
- **Smart Output Reading**: Multiple modes (full, head, tail, head-tail)
- **Incremental Reading**: Read only new output using `since` parameter
- **Session Management**: Automatic cleanup of timed-out sessions

#### MCP Tools (6 total)
1. `create_terminal` - Create new persistent terminal sessions
2. `write_terminal` - Send input to terminal sessions
3. `read_terminal` - Read output with smart truncation
4. `get_terminal_stats` - Get detailed statistics (lines, bytes, tokens)
5. `list_terminals` - List all active terminal sessions
6. `kill_terminal` - Terminate terminal sessions

#### MCP Resources (3 total)
1. `terminal://list` - List of all terminals
2. `terminal://{id}/output` - Terminal output
3. `terminal://{id}/info` - Terminal information

#### MCP Prompts (2 total)
1. `debug-terminal` - Debug terminal issues
2. `monitor-terminal` - Monitor terminal output

#### REST API
- Alternative HTTP interface for non-MCP clients
- All MCP tools available as REST endpoints
- CORS enabled for web clients

#### Examples
- `basic-usage.ts` - Basic terminal operations
- `rest-api-demo.ts` - REST API usage
- `interactive-demo.ts` - Interactive terminal demo
- `smart-reading-demo.ts` - Smart reading features
- `test-all-tools.ts` - Comprehensive tool testing

#### Documentation
- `README.md` - Project overview and quick start
- `docs/meta/project-status.md` - Project status and roadmap
- `docs/guides/usage.md` - Guide for AI assistants
- `docs/guides/troubleshooting.md` - Troubleshooting guide
- `docs/clients/claude-code-setup.md` - Claude Code configuration
- `docs/guides/mcp-config.md` - MCP configuration guide
- `docs/reference/tools-summary.md` - Quick reference for all tools

#### Configuration
- Environment variables support (`MAX_BUFFER_SIZE`, `SESSION_TIMEOUT`)
- Example configuration files for Claude Desktop and Claude Code
- TOML configuration format support

### Technical Details

#### Architecture
- TypeScript with strict mode
- ES Modules (ESM)
- Event-driven design using EventEmitter
- Zod schema validation
- node-pty for PTY management

#### Testing
- Jest test framework
- Unit tests for core functionality
- Integration tests for MCP tools
- Example scripts for manual testing

#### Build System
- TypeScript compiler (tsc)
- tsx for development
- npm scripts for common tasks

---

## Version History

- **1.0.1** (2025-10-03) - Bug fixes for command execution and terminal cleanup
- **1.0.0** (2025-10-03) - Initial release with full MCP support

---

## Upgrade Guide

### From 1.0.0 to 1.0.1

No breaking changes. Simply update and rebuild:

```bash
git pull
npm run build
```

If using Claude Code or Claude Desktop, restart the application after rebuilding.

### Benefits of Upgrading

1. **Better UX**: No need to manually add `\n` to commands
2. **Memory Efficiency**: Terminated terminals are properly cleaned up
3. **Cleaner API**: Terminal list only shows active terminals

---

## Future Plans

See `docs/meta/project-status.md` for detailed roadmap.

### Planned Features

- [ ] Terminal session persistence across restarts
- [ ] Terminal multiplexing (tmux/screen integration)
- [ ] File upload/download support
- [ ] Terminal recording and playback
- [ ] WebSocket support for real-time updates
- [ ] Terminal sharing between users
- [ ] Custom shell profiles
- [ ] Environment variable management
- [ ] Command history and search

---

## Contributing

Contributions are welcome! Please see `CONTRIBUTING.md` for guidelines.

## License

MIT License - see `LICENSE` file for details.
