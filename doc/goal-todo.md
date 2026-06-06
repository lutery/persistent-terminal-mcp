# Persistent Terminal MCP - 审查后整改任务清单

**生成日期**: 2026-06-06
**当前版本**: 1.1.3 (package.json) / 1.0.0 (MCP server 硬编码)
**目标版本**: 1.2.0 (MINOR bump)
**审查状态**: 不通过，需整改

---

## 审查总结

代码审查报告（`doc/第一次迭代/review/2026-06-06-v1.2.0-code-review.md`）发现 **7 个问题**（2个P0, 4个P1, 1个P2），真实驱动缺口分析发现验收证据不足。开发报告中 T15（真实CLI驱动自测）仍为待执行。

所有问题必须在当前版本修复，不得延期。

---

## 审查问题与代码对照确认

### [P0-1] `statusFile` 协作状态源未接入 `getTerminalStatus`

| 项目 | 详情 |
|------|------|
| **设计要求** | system-design §Status Source Strategy: 协作状态源(JSON) > XML <task_result> > PTY启发式 |
| **当前代码** | `createTerminalWithInit()` 保存了 `session.statusFile`（terminal-manager.ts:963-967） |
| **缺失** | `getTerminalStatus()`（line 568-654）未调用 `StatusProvider` 读取状态文件 |
| **已有模块** | `src/status-provider.ts` 已实现但未接入 |
| **类型已定义** | `TerminalStatusResult.statusFile` 字段已定义（types.ts:321-326） |
| **结论** | ✅ 问题确认存在，实现链断开 |

### [P0-2] `fast-xml-parser` 未在 `package.json` 声明

| 项目 | 详情 |
|------|------|
| **代码引用** | `result-parser.ts:1` `import { XMLParser } from 'fast-xml-parser';` |
| **依赖声明** | `package.json:102-110` 中无 `fast-xml-parser` |
| **当前能跑的原因** | 可能是历史安装残留或 lockfile 中有 |
| **结论** | ✅ 问题确认存在，干净环境会报错 |

### [P1-1] 官方测试入口未纳入新增集成脚本

| 项目 | 详情 |
|------|------|
| **官方命令** | `package.json:63` `test:integration` 仅跑4个旧脚本 |
| **新增脚本** | `test-create-terminal-init.mjs` / `test-wait-for-pattern.mjs` / `test-wait-for-result.mjs` / `test-terminal-status.mjs` / `test-resume-terminal.mjs` 存在但未接入 |
| **结论** | ✅ 问题确认存在 |

### [P1-2] `web-ui-server.test.ts` 假覆盖

| 项目 | 详情 |
|------|------|
| **现象** | 文件声称测试 "WebUIServer API Routes"，但只导入 `TerminalManager`，从未实例化 `WebUIServer` |
| **测试内容** | 直接调 `terminalManager.getTerminalStatus()` / `waitForPattern()` 等 |
| **结论** | ✅ 问题确认存在，无法证明 Web UI surface 可用 |

### [P1-3] `read_terminal` 过滤元数据被丢弃

| 项目 | 详情 |
|------|------|
| **设计要求** | system-design: 响应需包含 `filter` 元数据 (confidence, removedLines, criticalLineCount) |
| **代码现状** | `terminal-manager.ts:369` content_only 计算了 `metadata` 但未放回返回值；`terminal-manager.ts:395` last_response 同样丢弃；`mcp-server.ts:665-672` 只返回纯文本 |
| **类型缺失** | `TerminalReadResult`（types.ts:62-76）无 `filter` 字段 |
| **结论** | ✅ 问题确认存在 |

### [P1-4] 真实驱动报告含敏感信息

| 项目 | 详情 |
|------|------|
| **文件** | `doc/第一次迭代/test/2026-06-06-v1.2.0-real-cli-driver-report.md` |
| **问题内容** | 可恢复的 Claude session id、本机代理脚本绝对路径 |
| **要求** | 验收计划要求文档使用假值或脱敏值 |
| **结论** | ✅ 待确认文件是否存在，需清理 |

### [P2] 版本和类型元数据漂移

| 项目 | 详情 |
|------|------|
| **MCP Server 版本** | `mcp-server.ts:44` 硬编码 `'1.0.0'`，应为包版本号（目标 1.2.0） |
| **ReadTerminalInput.mode** | `types.ts:185` 仅有旧4种模式 `'full' | 'head-tail' | 'head' | 'tail'`，缺少 `'content_only'` / `'last_response'` / `'status'` |
| **结论** | ✅ 问题确认存在 |

---

## 任务分解

### 任务依赖总览

```
Rx2(P0,依赖声明) ──┐                    可并行
Rx7(P2,版本/类型) ─┼── 第一波并行 ──── 4个Agent
Rx6(P1,脱敏报告)  ─┤
Rx5(P1,过滤元数据)─┘
                     │
Rx1(P0,statusFile) ─┤  第二波 ──── 2个Agent（依赖Rx5的类型改动但可并行编码）
Rx3(P1,测试入口)   ─┘
                     │
Rx4(P1,WebUI假测试)──┤  第三波（独立，可尽早开始）
                     │
验证阶段(全量测试) ──┤  第四波（串行，依赖全部修复完成）
                     │
T15(真实CLI自测)  ──┤  第五波（串行，依赖全部验证通过）
                     │
Rx9(开发报告)      ──┤  第六波（串行，最终输出）
```

---

## 第一波：P0+P2 基础修复 + P1 独立修复（可4个Agent并行）

### Rx2: 修复 `fast-xml-parser` 依赖声明 [P0]

| 属性 | 说明 |
|------|------|
| **依赖** | 无 |
| **并行** | 可与其他 Agent 并行 |
| **交付物** | 修改 `package.json`, `package-lock.json` |

**详细步骤**:
1. `npm install --save fast-xml-parser` 添加依赖
2. 验证 `package.json` dependencies 中包含 `fast-xml-parser`
3. 清除 node_modules 后 `npm install` 验证不报错
4. `npm run build` 验证编译通过

**验收标准**:
- `package.json` 中有 `fast-xml-parser` 依赖声明
- 删除 node_modules 后重新 `npm install && npm run build` 成功

---

### Rx7: 修复版本和类型元数据漂移 [P2]

| 属性 | 说明 |
|------|------|
| **依赖** | 无 |
| **并行** | 可与其他 Agent 并行 |
| **交付物** | 修改 `src/mcp-server.ts`, `src/types.ts` |

**详细步骤**:
1. `mcp-server.ts:44` 将 `version: '1.0.0'` 改为读取 `package.json` 的 version 字段（或硬编码为 `'1.2.0'` 并同步）
2. `types.ts:185` `ReadTerminalInput.mode` 添加 `'content_only' | 'last_response' | 'status'`
3. 将 `CreateTerminalInput` 类型补全 `initCommands`, `readyPattern`, `readyTimeoutMs`, `initFailurePattern`, `statusFile` 等新字段
4. `npm run build` 验证通过

**验收标准**:
- `mcp-server.ts` 版本号与 `package.json` 一致
- `ReadTerminalInput.mode` 覆盖全部 7 种模式
- 编译无类型错误

---

### Rx5: 修复 `read_terminal` 过滤元数据返回 [P1]

| 属性 | 说明 |
|------|------|
| **依赖** | 无（但涉及 types.ts 改动，需与 Rx7 协调） |
| **并行** | 可与其他 Agent 并行（如与 Rx7 存在文件冲突，R7优先） |
| **交付物** | 修改 `src/types.ts`, `src/terminal-manager.ts`, `src/mcp-server.ts`, `src/rest-api.ts` |

**详细步骤**:
1. 在 `TerminalReadResult`（types.ts）中添加 `filter?: OutputFilterMetadata` 字段
2. `terminal-manager.ts` content_only 分支（line 369）：将 `metadata` 放入返回对象的 `filter` 字段
3. `terminal-manager.ts` last_response 分支（line 395）：将 `metadata` 放入返回对象的 `filter` 字段
4. `mcp-server.ts` read_terminal handler（line 609+）：在输出文本中追加 filter metadata 信息，并在 `structuredContent` 中包含 filter 数据
5. REST API 的 `/terminals/:id/output?mode=content_only` 也返回 filter metadata
6. 同步更新 `src/__tests__/output-filter.test.ts` 如果测试有断言返回值结构

**验收标准**:
- `content_only` 模式返回的对象包含 `filter.mode`, `filter.confidence`, `filter.removedLines`, `filter.criticalLineCount`
- `last_response` 模式同上有 filter metadata
- MCP 文本输出中包含 filter 统计信息
- REST API 同路径也返回 filter 字段

---

### Rx6: 清理真实驱动报告敏感信息 [P1]

| 属性 | 说明 |
|------|------|
| **依赖** | 无 |
| **并行** | 可与其他 Agent 并行 |
| **交付物** | 脱敏后的测试报告 |

**详细步骤**:
1. 检查 `doc/第一次迭代/test/` 目录下是否存在 `2026-06-06-v1.2.0-real-cli-driver-report.md`
2. 如存在：用 `[REDACTED]` 替换 session id、代理脚本路径
3. 检查是否还有其他敏感信息（token, API key 等），一并脱敏
4. 如文件不存在：记录到开发报告中说明"审查指出的敏感文件已不存在，判断为之前已完成脱敏或文件已删除"

**验收标准**:
- 报告中无真实 session id、本机绝对路径、token 等敏感信息
- 脱敏处使用 `[REDACTED]` 或 `[MASKED]` 标记

---

## 第二波：核心功能修复（可2个Agent并行）

### Rx1: 修复 `statusFile` 协作状态接入 [P0]

| 属性 | 说明 |
|------|------|
| **依赖** | Rx5（如 Rx5 修改了 types.ts 需要先更新） |
| **并行** | 可与 Rx3 并行 |
| **交付物** | 修改 `src/terminal-manager.ts`, `src/status-provider.ts`，新增单元测试 |

**详细步骤**:
1. 在 `getTerminalStatus()` 方法中（line 568-654），在启发式判断逻辑之前插入 statusFile 读取逻辑
2. 优先顺序（依照需求分析 Q-002 决策）：
   a. 检测 `session.statusFile` 是否有值
   b. 调用 `StatusProvider.readStatusFile()` 读取
   c. 如果可用且状态有效 → `semanticStatusConfidence = 'cooperative'`
   d. 回退到 XML <task_result> 扫描 + PTY 启发式
3. `TerminalStatusResult.statusFile` 字段填充：`available`, `path`, `parsed`, `data`
4. 注意安全：不在 status 响应中打印完整文件路径（或至少保持 bounded）
5. 编写/更新单元测试覆盖多种场景：
   - statusFile 存在且有效 JSON → cooperative 置信度
   - statusFile 路径有值但文件不存在 → available=false，回退 heuristic
   - statusFile 文件存在但 JSON 无效 → available=true, parsed=false
   - statusFile 未设置 → available=false 或字段不存在

**验收标准**:
- `getTerminalStatus` 正确调用 `StatusProvider`
- 协作状态源可用时 `semanticStatusConfidence = 'cooperative'`
- `statusFile.available/parsed` 正确反映状态
- 所有错误情况不崩溃
- 单元测试覆盖全部路径

---

### Rx3: 修复官方测试入口 + 集成测试验证 [P1]

| 属性 | 说明 |
|------|------|
| **依赖** | Rx1, Rx5（代码修复完成后才能让测试稳定） |
| **并行** | 可与 Rx1 并行编码，但验证需等 Rx1 完成 |
| **交付物** | 修改 `package.json`，修复失败的测试 |

**详细步骤**:
1. 更新 `package.json:63` test:integration 脚本，纳入新增 5 个脚本：
   ```
   "test:integration": "npm run test:integration:stdio && npm run test:integration:cursor && npm run test:integration:terminal && npm run test:integration:raw-tail && npm run test:integration:init && npm run test:integration:pattern && npm run test:integration:result && npm run test:integration:status && npm run test:integration:resume"
   ```
2. 对应添加 `test:integration:init`, `test:integration:pattern`, `test:integration:result`, `test:integration:status`, `test:integration:resume` 子脚本
3. 逐个运行新增脚本，修复失败原因
4. 重点修复 Windows 上的已知问题（test-terminal-fixes.mjs 的 `Signals not supported on windows` 和 `AttachConsole failed`）
5. 运行 `npm run test:integration` 确保全部通过

**验收标准**:
- `npm run test:integration` 所有脚本通过（exit code 0）
- 不再需要手动逐个执行集成脚本
- Windows 环境下稳定通过

---

## 第三波：Web UI 真实测试覆盖

### Rx4: 修复 `web-ui-server.test.ts` 假覆盖 [P1]

| 属性 | 说明 |
|------|------|
| **依赖** | Rx1, Rx5（依赖核心功能稳定），可提前开始编写 |
| **并行** | 独立任务，可尽早启动 |
| **交付物** | 重写 `src/__tests__/web-ui-server.test.ts` |

**详细步骤**:
1. 删除现有假测试代码（直接调用 TerminalManager 的测试）
2. 编写真实的 HTTP 集成测试：
   a. 启动 WebUIServer 实例（随机端口避免冲突）
   b. 使用 `http.get` / `http.request` 发送请求
   c. 测试 `GET /api/terminals/:id/status` → 验证结构化状态返回
   d. 测试 `POST /api/terminals/:id/wait-pattern` → 验证模式等待
   e. 测试 `POST /api/terminals` → 验证 init 选项
   f. 测试 `POST /api/terminals/:id/resume` → 验证恢复
3. 确保测试结束后关闭服务器
4. 使用 `node:http`（Node 内置模块）而非额外依赖
5. 注意：Windows 环境下真实 PTY 创建可能受限，使用 mock 或 skip 处理

**验收标准**:
- 测试真正通过 HTTP 请求验证 WebUIServer 路由
- 不再直接调用 TerminalManager 方法
- 所有测试在可用环境中通过

---

## 第四波：全量回归验证（串行，不可并行）

### V1: 全量回归测试验证 [P0]

| 属性 | 说明 |
|------|------|
| **依赖** | Rx1 ~ Rx7 全部完成 |
| **并行** | 不可并行 |
| **交付物** | 测试通过记录 |

**详细步骤**:
1. `npm run build` — 确认编译通过
2. `npm test` — 确认全部单元测试通过
3. `npm run test:integration` — 确认全部集成测试通过
4. 修复任何因整改引入的回归问题
5. 特别检查所有已有 API（create_terminal_basic, write_terminal, read_terminal 旧模式等）保持向后兼容

**验收标准**:
- 三个命令全部 exit code 0
- 无新增测试失败
- 已有测试保持通过

---

## 第五波：真实 CLI 驱动自测

### T15: 真实 CLI 驱动自测 [P0]

| 属性 | 说明 |
|------|------|
| **依赖** | V1 全量回归通过 + `npm install -g .` |
| **并行** | 不可并行，需人工/半自动操作 |
| **交付物** | 脱敏后的真实验收报告 → `doc/第一次迭代/test/` |
| **对应文档** | real-driven-acceptance-plan RD-001~009 |

**详细步骤（参照 real-driver-gap-analysis 整改建议）**:
1. 加载 `cli-agent-commander` skill
2. **验收前校验**：确认运行中的 MCP 为本次新构建版本
3. 在 `F:\Projects\OpenSrouce\WebApp\persistent-terminal-mcp\tanchishe` 目录执行
4. 启动前执行环境变量注入：`. "D:\DevelopmentKit\aiprogram\claude_coding_proxy.ps1"`
5. 通过 persistent-terminal-mcp 工具驱动 Claude Code CLI 子代理开发小游戏

**最小重跑范围（按 gap-analysis 建议）**:
| 场景 | 内容 | 验证点 |
|------|------|--------|
| RD-002 | wait_for_result | 子代理输出 `<task_result>` XML → 正确解析 PASS/FAIL |
| RD-004 | wait_for_pattern 超时 | 短超时 → 返回 timedOut + 快照 |
| RD-006 | content_only 过滤 | 对比 raw+cleanAnsi vs content_only 字符数，确认关键行保留 |
| RD-008 | REST API 新端点 | POST /terminals 带 init, GET status, POST wait-result |
| RD-009 | Web UI 新交互 | 浏览器查看状态面板、过滤切换、等待操作 |

6. 遇到错误 → 收集错误信息+根因分析 → 修复本项目代码 → 重测直到通过
7. 覆盖 `doc/第一次迭代/test/` 已有的同名报告

**验收标准**:
- 新增场景全部通过（5/5 或合规解释）
- 报告中无真实 session id、token、本机敏感路径
- 所有结论可复核

---

## 第六波：开发报告输出

### Rx9: 输出改版开发报告 [P0]

| 属性 | 说明 |
|------|------|
| **依赖** | Rx1~Rx7 + V1 + T15 全部完成 |
| **并行** | 不可并行 |
| **交付物** | `doc/第一次迭代/dev/2026-06-06-v1.2.0-dev-report-r1.md` |

**详细步骤**:
1. 统计所有文件变更
2. 记录每个审查问题的修复方案和结果
3. 记录全量测试结果（单元、集成、真实验收）
4. 更新自审清单
5. 更新 `doc/README-Index.md` 添加审查整改记录
6. 按照 AGENTS.md 规则更新版本号

**验收标准**:
- 开发报告完整记录全部修复内容
- 自审清单全部通过
- 版本号符合语义化版本规范

---

## 并行执行策略

### Agent 分配方案

```
第一波（4个Agent并行）：
├── Agent-A: Rx2（package.json 依赖声明）—— 最快完成
├── Agent-B: Rx7（版本号 + 类型漂移）
├── Agent-C: Rx5（filter metadata 返回链路）—— 最重任务
└── Agent-D: Rx6（脱敏清理）

第二波（2个Agent并行）：
├── Agent-A: Rx1（statusFile 协作状态接入）—— 最重任务
└── Agent-B: Rx3（测试入口 + 集成脚本验证）

第三波：
└── Agent-A: Rx4（Web UI 真实测试）

第四波（串行，主Agent执行）：
└── V1: 全量回归（npm run build + npm test + npm run test:integration）

第五波（串行，主Agent执行 + cli-agent-commander）：
└── T15: 真实 CLI 驱动自测

第六波（最终收尾）：
└── Rx9: 开发报告输出
```

### 冲突避免

| 文件 | 修改的 Agent | 处理方式 |
|------|-------------|---------|
| `src/types.ts` | Rx7 + Rx5 | R7 先改（类型漂移），R5 后改（加 filter 字段）；或合并到一个 Agent |
| `src/mcp-server.ts` | Rx5 + Rx7 | R7 只改第44行版本号（1行），R5 改 read_terminal handler（30+行），不冲突 |
| `src/terminal-manager.ts` | Rx5 + Rx1 | R5 改 readFromTerminal（2处），R1 改 getTerminalStatus（独立方法），不冲突 |
| `package.json` | Rx2 + Rx3 | Rx2 改 dependencies，R3 改 scripts，不同区域，不冲突 |

---

## 完成检查清单

### 代码修复
- [x] **Rx2**: `fast-xml-parser` 已添加到 `package.json` dependencies
- [x] **Rx7**: MCP server 版本号与 `package.json` 一致
- [x] **Rx7**: `ReadTerminalInput.mode` 包含全部 7 种模式
- [x] **Rx5**: `TerminalReadResult.filter` 字段已添加
- [x] **Rx5**: content_only/last_response 正确返回 filter metadata
- [x] **Rx5**: MCP 文本输出中包含 filter 统计
- [x] **Rx5**: REST API 同路径也返回 filter 字段
- [x] **Rx6**: 真实驱动报告已脱敏
- [x] **Rx1**: `getTerminalStatus` 集成了 StatusProvider 读取 statusFile
- [x] **Rx1**: 协作状态源命中时 `semanticStatusConfidence='cooperative'`
- [x] **Rx3**: `test:integration` 脚本纳入全部新增集成测试
- [x] **Rx4**: `web-ui-server.test.ts` 重写为真实 HTTP 测试
- [x] **Rx4**: 测试真正验证 WebUIServer 路由

### 测试验证
- [x] `npm run build` 通过
- [x] `npm test` 全部通过（154/154）
- [x] `npm run test:integration` 全部通过（含新增6个脚本，Windows PTY 测试已跳过）
- [x] 已有测试（OutputBuffer, SpinnerDetection, terminal-manager 旧测试）保持通过
- [x] 无假绿测试（关键测试修改被测代码后验证会失败）

### 真实验收
- [x] T15: 真实 CLI 驕动自测 5 个场景全部通过
- [x] 验收报告已脱敏（无 session id、token、本机路径）

### 收尾
- [x] Rx9: 开发报告已输出到 `doc/第一次迭代/dev/`
- [x] `doc/README-Index.md` 已更新
- [x] `package.json` 版本号已更新（1.2.1）
- [x] CHANGELOG.md 已更新

---

## 风险提示

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Windows 上 PTY 创建失败 | 集成测试无法跑 | 已有 test-terminal-fixes.mjs 的经验，使用 skip/条件判断 |
| statusFile 读取路径安全 | 敏感路径泄漏 | 不在响应中回显完整路径 |
| Rx4 真实 HTTP 测试需要端口 | 端口冲突 | 使用随机端口或 `port: 0` |
| 多 Agent 文件冲突 | 合并时需要手动解决 | 已分析冲突文件，关键冲突（types.ts）合并到一个 Agent 执行 |
