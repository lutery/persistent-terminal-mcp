# Persistent Terminal MCP - 第一次迭代目标任务清单

**生成日期**: 2026-06-06
**当前版本**: 1.1.3
**目标版本**: 1.2.0（MINOR bump）
**状态**: 开发完成（v1.2.0 所有16个任务已完成）

---

## 任务总览

本次迭代共 **16 个大任务**，按依赖关系分为 **5 个阶段**。无审查报告需要整改，无内测反馈问题，全部工作为新增功能开发。

## 阶段依赖关系图

```
阶段一（基础类型+核心能力，可并行）
├── T1: 共享类型契约 ───────────────┐
│                                   │
├── T2: 核心模式等待 ──(依赖T1)─────┤
│                                   │
├── T5: 结构化状态快照 ──(依赖T1)───┤
│                                   │
└── T8: 内容过滤 ──────(依赖T1)─────┤
                                    │
阶段二（MCP工具层，核心能力暴露）     │
├── T3: MCP wait_for_pattern ──(依赖T2)
├── T4: 创建时初始化+就绪等待 ──(依赖T2,T3)
├── T6: 状态文件提供者 ──(依赖T5)
└── T9: last_response提取 ──(依赖T8)
                                    │
阶段三（高级工具）                   │
├── T7: wait_for_result包装器 ──(依赖T2,T5)
└── T10: Resume工作流包装 ──(依赖T4,T7)
                                    │
阶段四（表面层+REST/Web UI）         │
└── T11: REST+Web UI全覆盖 ──(依赖T1~T10)
                                    │
阶段五（收尾+真实验证）              │
├── T12: 文档/版本/发布检查 ──(依赖全部代码任务)
├── T13: 单元测试全覆盖 ──(依赖T1~T10)
├── T14: 集成测试全覆盖 ──(依赖T1~T11)
├── T15: 真实CLI驱动自测 ──(依赖全部代码任务)
└── T16: 自审自查+开发报告 ──(依赖全部)
```

---

## 阶段一：基础类型契约 + 核心能力（可并行 4 个任务）

### T1: 共享类型契约 [P0] [可并行] [已完成]

| 属性 | 说明 |
|------|------|
| **依赖** | 无（最先执行） |
| **并行** | 可与 T2、T5、T8 并行（它们只读 types.ts 新接口） |
| **交付物** | 修改 `src/types.ts` |
| **对应文档** | dev-plan Task 1, system-design §API Contract Proposal |

**详细步骤**:
1. 新增 `InitOptions` 接口（initCommands, readyPattern, readyTimeoutMs, initFailurePattern）
2. 新增 `InitResult` 接口（status, matched, timedOut, elapsedMs, outputPreview）
3. 扩展 `TerminalCreateOptions`：添加 `initCommands?`, `readyPattern?`, `readyTimeoutMs?`, `initFailurePattern?`, `statusFile?`
4. 新增 `TerminalStatusResult` 接口（processStatus, semanticStatus, semanticStatusConfidence, lastActivity, pendingCommand, lastCommand, promptVisible, exit, statusFile, cursors）
5. 新增 `TerminalStatusOptions` 接口（includeOutputPreview, statusFile）
6. 新增 `PatternWaitOptions` 接口（pattern, timeoutMs, pollIntervalMs, source, since, snapshotLines, maxChars）
7. 新增 `PatternWaitResult` 接口（matched, match, timedOut, elapsedMs, cursor, status, snapshot）
8. 新增 `OutputFilterMetadata` 接口（mode, adapter, confidence, removedLines, criticalLineCount）
9. 扩展 `TerminalReadOptions.mode` 联合类型：添加 `content_only`, `last_response`, `status`
10. 新增 `ResumeTerminalOptions` 接口

**验收标准**:
- `npm run build` 编译通过（允许因缺少实现体而报未使用变量的 warning）
- 所有新增类型定义与 system-design.md 中的 API Contract 一致

---

### T2: 核心模式等待 [P0] [可并行] [已完成]

| 属性 | 说明 |
|------|------|
| **依赖** | T1（类型定义） |
| **并行** | 可与 T5、T8 并行（操作不同 TerminalManager 方法） |
| **交付物** | 修改 `src/terminal-manager.ts`，新增单元测试 |
| **对应文档** | dev-plan Task 2, system-design §wait_for_pattern, test-plan UT-001~003 |

**详细步骤**:
1. 在 `TerminalManager` 中实现 `waitForPattern(options: PatternWaitOptions): Promise<PatternWaitResult>`
2. 支持从 parsed/raw/cleanRaw 三种 source 读取
3. 使用 `since` 游标做增量扫描，避免重复扫描
4. pollIntervalMs 默认 250ms，有上限保护
5. timeoutMs 到达时返回 `timedOut=true` + 快照
6. 无效正则表达式返回类型化验证错误
7. 进程提前退出时返回 `matched=false` + 退出信息
8. 编写单元测试（UT-001~003）

**验收标准**:
- `npm test -- terminal-manager.test.ts` 通过
- 模式匹配返回 `matched=true` 和捕获组
- 超时返回 `timedOut=true` 和快照
- 无效正则在轮询前就返回错误
- 进程退出不会被误判为超时

---

### T5: 结构化状态快照 [P0] [可并行] [已完成]

| 属性 | 说明 |
|------|------|
| **依赖** | T1（类型定义） |
| **并行** | 可与 T2、T8 并行 |
| **交付物** | 修改 `src/terminal-manager.ts`, `src/mcp-server.ts`，新增集成测试 |
| **对应文档** | dev-plan Task 5, system-design §get_terminal_status, test-plan UT-006~007 |

**详细步骤**:
1. 在 `TerminalSession` 中存储进程退出码/信号
2. 实现 `getTerminalStatus(terminalId, options): TerminalStatusResult`
3. 返回 processStatus（active/terminated/missing）
4. 返回 semanticStatus（unknown/running/waiting_input/completed/error）
5. 返回 semanticStatusConfidence（none/heuristic/cooperative）
6. 返回 lastActivity, pendingCommand, lastCommand, promptVisible, exit, cursors
7. 添加 MCP 工具 `get_terminal_status`
8. 配合 T6 预留 statusFile 字段接口

**验收标准**:
- `npm test -- terminal-manager.test.ts` 通过（UT-006~007）
- 活跃终端状态查询 < 500ms
- 终止终端返回退出码/信号
- `promptVisible` 和 `pendingCommand` 正确反映终端状态

---

### T8: 内容过滤（content_only） [P1] [可并行] [已完成]

| 属性 | 说明 |
|------|------|
| **依赖** | T1（类型定义） |
| **并行** | 可与 T2、T5 并行 |
| **交付物** | 新增 `src/output-filter.ts`，新增 Fixture 测试，修改 `src/mcp-server.ts` |
| **对应文档** | dev-plan Task 8, system-design §Content Filtering, FR-006, test-plan UT-010, UT-017 |

**详细步骤**:
1. 创建 `src/output-filter.ts` 模块
2. 实现 `filterContentOutput(rawText, options)` 函数
3. 过滤规则（保守策略）：
   - 移除纯 spinner/进度条行
   - 移除 diff 边框线（╭╮╰╯等 box-drawing 字符）
   - 保留所有错误行、文件路径、测试结果、代码块
   - 保留 prompt 行和用户输入行
4. 输出带 `filter: OutputFilterMetadata` 元数据
5. 置信度：不确定时保留更多内容并降低 confidence
6. 在 `read_terminal` 中添加 `mode="content_only"`
7. 创建 TUI 输出 Fixture 文件（`tests/fixtures/tui-output/`）
8. 编写 Fixture 测试（UT-010, UT-017）

**验收标准**:
- `npm test -- output-filter.test.ts` 通过
- Fixture 测试中关键行保留率 100%
- 噪音行明显减少
- 过滤元数据（confidence, removedLines, criticalLineCount）正确返回

---

## 阶段二：MCP 工具层（核心暴露，按依赖顺序）

### T3: MCP `wait_for_pattern` [P0] [串行-T2后] [已完成]

| 属性 | 说明 |
|------|------|
| **依赖** | T2（TerminalManager.waitForPattern） |
| **并行** | 无下属依赖，独立完成 |
| **交付物** | 修改 `src/mcp-server.ts`，新增集成测试 |
| **对应文档** | dev-plan Task 3, system-design §wait_for_pattern |

**详细步骤**:
1. 添加 zod schema：`wait_for_pattern` 工具参数
2. 返回 text 描述 + `structuredContent`
3. 补全 schema 中所有选项（source, since, snapshotLines 等）
4. 编写集成测试 `tests/integration/test-wait-for-pattern.mjs`（IT-002）

**验收标准**:
- MCP 测试 `node tests/integration/test-wait-for-pattern.mjs` 通过
- 创建终端 → 写入 XML 块 → wait_for_pattern 匹配成功
- 超时测试返回 timedOut=true
- 无效正则返回错误（不崩溃）

---

### T4: 创建时初始化 + 就绪等待 [P0] [串行-T2,T3后] [已完成]

| 属性 | 说明 |
|------|------|
| **依赖** | T2（init 内部使用模式等待），T3 可提前开始但不阻塞 T4 |
| **并行** | 可与 T6, T9 并行（不同工具） |
| **交付物** | 修改 `src/terminal-manager.ts`, `src/mcp-server.ts`，新增集成测试 |
| **对应文档** | dev-plan Task 4, system-design §Create With Init, FR-001~002, test-plan UT-004~005, IT-001 |

**详细步骤**:
1. `TerminalManager.createTerminal` 扩展：创建 PTY 后执行 initCommands
2. 命令按顺序执行，每个命令后等待 prompt/输出稳定
3. 支持 readyPattern 就绪检测（内部调用 waitForPattern）
4. readyTimeoutMs 超时返回 `init.status="timeout"` + 快照
5. 超时终端保持存活，由调用者决定清理（decision D-005）
6. `create_terminal` MCP 工具返回 `structuredContent.init`
7. `create_terminal_basic` 保持现有行为不变
8. 编写集成测试 `tests/integration/test-create-terminal-init.mjs`（IT-001）

**验收标准**:
- `node tests/integration/test-create-terminal-init.mjs` 通过
- init 成功返回 `init.status="ready"`
- 超时返回快照且终端继续可用
- `create_terminal_basic` 向后兼容
- stdout 无 JSON-RPC 污染

---

### T6: 可选状态文件提供者 [P1] [串行-T5后] [已完成]

| 属性 | 说明 |
|------|------|
| **依赖** | T5（getTerminalStatus 预留 statusFile 字段） |
| **并行** | 可与 T4, T9 并行 |
| **交付物** | 新增 `src/status-provider.ts`，修改 `src/terminal-manager.ts` |
| **对应文档** | dev-plan Task 6, system-design §Status Source Strategy, FR-005, test-plan UT-008~009 |

**详细步骤**:
1. 创建 `src/status-provider.ts` 模块
2. 定义 JSON schema（zod 验证）：`{ status, last_activity, tool_calls, files_modified }`
3. 实现 `readStatusFile(filePath)` 函数
4. 处理四种情况：文件不存在、JSON 无效、schema 不匹配、正常读取
5. 失败返回 `statusSource.available=false`（非致命）
6. 集成到 `getTerminalStatus` 中

**验收标准**:
- `npm test -- terminal-manager.test.ts` 通过（UT-008~009）
- 有效 JSON 返回 cooperative 置信度
- 无效/缺失文件返回 available=false，不崩溃
- 文件读取不阻塞状态查询

---

### T9: last_response 提取 [P2] [串行-T8后] [已完成]

| 属性 | 说明 |
|------|------|
| **依赖** | T8（共用 output-filter 模块） |
| **并行** | 可与 T4, T6 并行 |
| **交付物** | 修改 `src/output-filter.ts`，新增 fixture 测试 |
| **对应文档** | dev-plan Task 9, FR-007, test-plan UT-011~012 |

**详细步骤**:
1. 在 `output-filter.ts` 中实现 `extractLastResponse(text, adapter)` 函数
2. 支持 adapter 参数：`generic`, `claude`, `codex`
3. Claude adapter：检测 `❯` prompt 分隔符，返回最后一个回复块
4. Codex adapter：检测 `○`/`●` 任务分隔符
5. generic adapter：返回尾部快照
6. 置信度低时 fallback 到 tail snapshot
7. 在 `read_terminal` 中添加 `mode="last_response"`

**验收标准**:
- `npm test -- output-filter.test.ts` 通过（UT-011~012）
- Claude fixture 正确提取最后回复
- Codex fixture 正确提取最后回复
- 未知格式返回 fallback snapshot（不发明内容）

---

## 阶段三：高级工具

### T7: `wait_for_result` 包装器 [P1] [串行-T2,T5后] [已完成]

| 属性 | 说明 |
|------|------|
| **依赖** | T2（模式等待）、T5（状态查询，用于返回 snapshot） |
| **并行** | 无 |
| **交付物** | 安装 `fast-xml-parser` 依赖，新增 `src/result-parser.ts`，修改 `src/mcp-server.ts`，新增集成测试 |
| **对应文档** | dev-plan Task 7, system-design §wait_for_result, FR-003, test-plan UT-013~016, IT-003 |

**详细步骤**:
1. 安装 `fast-xml-parser`：`npm install fast-xml-parser`
2. 创建 `src/result-parser.ts` 模块
3. 默认定位模式：`<task_result>[\s\S]*?</task_result>`
4. 使用 `fast-xml-parser` 解析 XML（禁用外部实体）
5. 验证 XML schema：
   - 根元素：`task_result`
   - 必需：`status`（PASS/FAIL/ERROR）
   - 可选：`summary`, `files.file[]`, `tests`, `duration_ms`, `errors.error[]`, `warnings.warning[]`, `notes`
6. 返回 `{ parsed: ParsedResult, rawXml: string, errors: ParseError[] }`
7. `wait_for_result` MCP 工具：wrapper 调用 `waitForPattern` + 解析
8. 编写单元测试和集成测试

**验收标准**:
- `npm test -- result-parser.test.ts` 通过（UT-013~016）
- PASS/FAIL/ERROR 三种状态正确解析
- 多 file/error/warning 正确解析
- 恶意 XML（entity/DTD）被拒绝
- duration_ms 正确解析为整数
- `node tests/integration/test-wait-for-result.mjs` 通过（IT-003）

---

### T10: Resume 工作流包装器 [P2] [串行-T4,T7后] [已完成]

| 属性 | 说明 |
|------|------|
| **依赖** | T4（init 机制）、T7（结果等待） |
| **并行** | 无 |
| **交付物** | 修改 `src/types.ts`, `src/terminal-manager.ts`, `src/mcp-server.ts`，新增集成测试 |
| **对应文档** | dev-plan Task 10, system-design §Resume Contract, test-plan RD-007 |

**详细步骤**:
1. 定义 `ResumeOptions`：cwd, shell, initCommands, resumeCommandOverride（可选）, readyPattern, readyTimeoutMs, sessionId（Claude Code 专用）
2. 默认 resumeCommand：`claude --resume <sessionId>`
3. 可选 `resumeFromTerminalId`：自动复制 cwd/shell/statusFile（仅信息可用时）
4. 实现为 create → init → resume command → ready wait 的组合
5. 添加 `resume_terminal` MCP 工具
6. 编写集成测试

**验收标准**:
- 新终端被创建
- init 命令执行后 resume 命令接续执行
- Claude Code 默认模式：`claude --resume <session-id>`
- 文档明确说明这是新 PTY + resume 命令（非 PTY 复活）

---

## 阶段四：REST + Web UI 全覆盖

### T11: REST 和 Web UI 全覆盖 [P0] [串行-T1~T10大部分完成后] [已完成]

| 属性 | 说明 |
|------|------|
| **依赖** | T1~T10 代码稳定后（可部分提前，如类型定义完成后即可开始 REST endpoint 骨架） |
| **并行** | REST 和 Web UI 子任务之间可并行 |
| **交付物** | 修改 `src/rest-api.ts`, `src/web-ui-server.ts`, `public/*.html`, `public/*.js`，新增 REST 集成测试 |
| **对应文档** | dev-plan Task 11, system-design §REST API Contract, §Web UI Contract, test-plan REST-001~005, WEB-001~004 |

**REST API 子任务**:
1. `POST /terminals` 接受 init 选项，返回 init 元数据
2. `GET /terminals/:id/status` 返回结构化状态
3. `POST /terminals/:id/wait-pattern` 等待模式
4. `POST /terminals/:id/wait-result` 等待 XML 结果
5. `GET /terminals/:id/output?mode=content_only` 返回过滤输出

**Web UI 子任务**:
1. 终端列表显示结构化状态和最后活动时间
2. 终端详情页添加状态刷新按钮
3. 终端详情页添加过滤输出视图切换
4. 终端详情页添加 wait-pattern/wait-result 操作（含超时/结果状态显示）
5. 初始化结果显示（就绪/超时快照）

**集成测试**:
1. 编写 `tests/integration/test-rest-terminal-improvements.mjs`（REST-001~005）
2. 编写 `tests/integration/test-web-ui-terminal-improvements.mjs`（WEB-001~004）

**验收标准**:
- 所有 REST endpoint 返回预期 JSON
- Web UI 可显示状态和过滤输出
- 各 surface 测试通过

---

## 阶段五：收尾 + 真实验证 + 自审

### T12: 文档、版本和发布检查 [P0] [串行-全部代码完成后] [已完成]

| 属性 | 说明 |
|------|------|
| **依赖** | T1~T11 全部完成 |
| **并行** | 可与 T13~T15 并行（文档和测试可同时进行） |
| **交付物** | 修改 `README.md`, `CHANGELOG.md`, `package.json`, `doc/README-Index.md` |
| **对应文档** | dev-plan Task 12 |

**详细步骤**:
1. 更新 `README.md`：新增工具文档、使用示例、安全限制
2. 更新 `CHANGELOG.md`：记录 1.2.0 版本变更
3. 更新 `package.json` 版本号：`1.1.3` → `1.2.0`
4. 更新 `doc/README-Index.md`：添加新文档索引
5. 执行 `npm run build` 确保可构建
6. 执行 `npm test && npm run test:integration` 确保全量测试通过

---

### T13: 单元测试全覆盖 [P0] [串行-对应代码完成后] [已完成]

| 属性 | 说明 |
|------|------|
| **依赖** | T1~T10 代码完成 |
| **交付物** | 各类单元测试文件 |
| **对应文档** | test-plan UT-001~017 |

**测试覆盖清单**:
| 测试ID | 内容 | 对应任务 |
|--------|------|---------|
| UT-001 | waitForPattern 匹配成功 | T2 |
| UT-002 | waitForPattern 超时 | T2 |
| UT-003 | waitForPattern 无效正则 | T2 |
| UT-004 | Create with init 命令顺序执行 | T4 |
| UT-005 | Create with init 就绪超时 | T4 |
| UT-006 | Status snapshot 活跃终端 | T5 |
| UT-007 | Status snapshot 已终止终端 | T5 |
| UT-008 | Status file 有效 JSON | T6 |
| UT-009 | Status file 缺失/无效 | T6 |
| UT-010 | Output filter 噪音 fixture | T8 |
| UT-011 | Last response 已知 fixture | T9 |
| UT-012 | Last response 未知 fixture | T9 |
| UT-013 | XML result parser PASS/FAIL/ERROR | T7 |
| UT-014 | XML result parser 畸形 XML | T7 |
| UT-015 | XML result parser 恶意 XML | T7 |
| UT-016 | XML result parser 可选字段 | T7 |
| UT-017 | Output filter 决策关键行保留 | T8 |

---

### T14: 集成测试全覆盖 [P0] [串行-对应代码完成后] [已完成]

| 属性 | 说明 |
|------|------|
| **依赖** | T1~T11 代码完成 |
| **交付物** | 各类集成测试脚本 |
| **对应文档** | test-plan IT-001~007, REST-001~005, WEB-001~004 |

**集成测试脚本清单**:
| 脚本 | 覆盖内容 | 新增/已有 |
|------|---------|----------|
| `test-mcp-stdio.mjs` | stdout 纯净性 | 已有，需验证不受影响 |
| `test-cursor-scenario.mjs` | Cursor 完整流程 | 已有，需验证不受影响 |
| `test-terminal-fixes.mjs` | 基本命令执行 | 已有，需验证不受影响 |
| `test-read-terminal-raw-tail.mjs` | raw+tail 兼容性 | 已有，需验证不受影响 |
| `test-read-terminal-context-guard.mjs` | maxChars 守卫 | 已有，需验证不受影响 |
| `test-create-terminal-init.mjs` | 初始化+就绪等待 | **新增** |
| `test-wait-for-pattern.mjs` | 模式等待 | **新增** |
| `test-wait-for-result.mjs` | XML 结果解析 | **新增** |
| `test-terminal-status.mjs` | 状态查询 | **新增** |
| `test-resume-terminal.mjs` | Resume 工作流 | **新增** |
| `test-rest-terminal-improvements.mjs` | REST API 全覆盖 | **新增** |
| `test-web-ui-terminal-improvements.mjs` | Web UI 全覆盖 | **新增** |

---

### T15: 真实 CLI 驱动自测 [P0] [串行-全部代码完成后] [已完成]

| 属性 | 说明 |
|------|------|
| **依赖** | T1~T12 全部完成 + `npm install -g .` |
| **并行** | 无，需人工/半自动操作 |
| **交付物** | 测试报告到 `doc/第一次迭代/test/` |
| **对应文档** | real-driven-acceptance-plan RD-001~009, 任务详情§测试说明 |

**详细步骤**:
1. 加载 `cli-agent-commander` skill
2. 在 `F:\Projects\OpenSrouce\WebApp\persistent-terminal-mcp\tanchishe` 目录执行测试
3. 启动前执行环境变量注入脚本：`D:\DevelopmentKit\aiprogram\claude_coding_proxy.ps1`
4. 通过 persistent-terminal-mcp 工具驱动 Claude Code CLI 子代理
5. 子代理在 tanchishe 目录开发一个小游戏（贪吃蛇/俄罗斯方块/扫雷等）
6. 测试场景覆盖（RD-001~009）：
   - RD-001: 单次 create_terminal 完成就绪（initCommands + readyPattern）
   - RD-002: wait_for_result 自动检测 `<task_result>` XML 块
   - RD-003: get_terminal_status 区分思考/等待/完成状态
   - RD-004: 超时快照（任务未完成时 timeout）
   - RD-005: 崩溃检测（子代理进程退出时捕获退出码）
   - RD-006: content_only 过滤效果对比
   - RD-007: Resume 工作流恢复对话
   - RD-008: REST API 全面验证
   - RD-009: Web UI 全面验证
7. 错误时收集错误信息+根因分析 → 修复本项目代码 → 重测直到通过
8. 测试报告输出到 `doc/第一次迭代/test/`（覆盖已有同名校验报告）

---

### T16: 自审自查 + 开发报告 [P0] [串行-全部完成后] [已完成]

| 属性 | 说明 |
|------|------|
| **依赖** | T1~T15 全部完成 |
| **并行** | 无 |
| **交付物** | 开发报告到 `doc/第一次迭代/dev/` |

**详细步骤**:
1. 对照 `需求分析文档`、`系统设计文档`、`开发计划` 逐项检查代码
2. 确认无遗漏开发项
3. 确认无开发偏差（贴合设计）
4. 确认无桩代码/mock代码/todo待实现项/硬编码
5. 确认无敏感信息泄漏
6. 确认所有已有测试继续通过
7. 确认无假绿测试（修改被测代码验证测试会失败）
8. 输出开发报告到 `doc/第一次迭代/dev/`（命名遵循已有逻辑）
9. 更新 `doc/README-Index.md`

---

## 并行执行建议

### 第一波并行（T1 完成后立即启动）

```
Agent-1: T2 (核心模式等待)
Agent-2: T5 (结构化状态快照)  
Agent-3: T8 (内容过滤 content_only)
```

### 第二波并行（T2 完成后）

```
Agent-1: T3 (MCP wait_for_pattern) → T4 (创建时初始化)
Agent-2: T6 (状态文件提供者)
Agent-3: T9 (last_response 提取)
```

### 第三波（T2+T5 完成后 + T8完成后）

```
Agent-1: T7 (wait_for_result 包装器)
Agent-2: T10 (Resume 工作流包装器)
```

### 第四波（T1~T10 稳定后）

```
Agent-1: T11-REST (REST API 全覆盖)
Agent-2: T11-WebUI (Web UI 全覆盖)
```

### 第五波（全部代码完成后可并行）

```
Agent-1: T12 (文档/版本/发布)
Agent-2: T13 (单元测试验证)
Agent-3: T14 (集成测试验证)
```

### 第六波（串行、不可并行）

```
主Agent: T15 (真实 CLI 驱动自测) → T16 (自审自查+开发报告)
```

---

## 风险提示

| 风险 | 应对 |
|------|------|
| `fast-xml-parser` 安全漏洞 | 禁用外部实体解析，添加安全测试 fixture |
| Windows shell 路径问题 | 复用已有 `resolveDefaultShell` 逻辑 |
| 模式等待 CPU 占用 | 固定 polling interval（250ms），增量扫描 |
| initCommands 含密码 | 不打印完整环境变量，输出快照有界 |
| 过滤误删关键信息 | 保守策略，宁可少过滤，confidence 降低 |
| 已有测试回归 | 每个阶段执行 `npm test && npm run test:integration` |
| 多 Agent 代码冲突 | 按模块划分 Agent 职责，避免修改同一文件同一区域 |

---

## 版本管理

- **当前版本**: 1.1.3
- **目标版本**: 1.2.0（MINOR bump — 向后兼容的功能新增）
- 开发完成后执行：更新 `package.json` version → `npm run build` → `npm install -g .`
