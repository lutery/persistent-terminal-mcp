# Persistent Terminal MCP — 第二轮审查后整改任务清单

**生成日期**: 2026-06-06 20:38
**当前包版本**: 1.2.2 (package.json)
**MCP Server 版本**: 1.2.1 (mcp-server.ts) / REST: 1.2.0 (rest-api.ts) → 需同步
**审查状态**: 第二轮审查不通过

---

## 审查历程

| 轮次 | 审查报告 | 发现数 | 状态 |
|------|---------|--------|------|
| 第一轮 | `2026-06-06-v1.2.0-code-review.md` | 7 (2 P0, 4 P1, 1 P2) | 已整改，部分通过 |
| 第二轮 | `2026-06-06-v1.2.1-remediation-code-review.md` | 6 (1 P0, 3 P1, 2 P2) | 待整改 |

---

## 本轮审查发现与代码确认

### [P0] Rx10: `resume_terminal` 命令注入风险 — ✅确认存在

| 项目 | 详情 |
|------|------|
| **位置** | `src/terminal-manager.ts:1126`, `src/mcp-server.ts:1242-1258`, `src/rest-api.ts:474-491`, `src/web-ui-server.ts:384-396` |
| **根因** | `claude --resume ${options.sessionId}` 直接将外部输入拼接到 shell 命令，无格式校验和转义 |
| **攻击面** | MCP / REST / Web UI 三个入口均可达，HTTP 请求体可直接控制 sessionId |
| **攻击向量** | `abc&evil`, `abc;evil`, 带换行符、带引号的输入均可改变实际执行命令 |

---

### [P1] Rx11: 官方 `npm run test:integration` 仍失败 — ✅确认存在

| 项目 | 详情 |
|------|------|
| **位置** | `package.json:63-73` |
| **现状** | 10 个子脚本已接入，但 `test:integration:terminal` 在 Windows 上失败（`通过:0, 失败:6`） |
| **根因** | 新增 PTY 依赖脚本在 Windows 上无法创建终端（node-pty ConPTY 限制），但没有平台判断或 skip 策略 |

---

### [P1] Rx12: 测试假绿：`ptyTest()` 用 `return` 而非 `test.skip` — ✅确认存在

| 项目 | 详情 |
|------|------|
| **位置** | `terminal-manager.test.ts:9-13`, `web-ui-server.test.ts:80-84` |
| **根因** | `ptyTest()` 包装函数在 Windows 上直接 `return`，Jest 计为 passed（不是 skipped） |
| **扩展问题** | `terminal-manager.test.ts:545-749` 的 statusFile 测试全部加了 `if (IS_WINDOWS) return`，但这些测试用的是 fake session（不依赖 PTY），不应该跳过 |

---

### [P1] Rx13: 已跟踪文档含本机绝对路径 — ✅确认存在

| 项目 | 详情 |
|------|------|
| **位置** | `doc/goal-todo.md`（本文件的上一个版本） |
| **要求** | 任务详情和验收计划要求报告使用假值或脱敏值，禁止提交绝对路径 |

---

### [P2] Rx14: REST API 版本号仍为 1.2.0 — ✅确认存在

| 项目 | 详情 |
|------|------|
| **位置** | `src/rest-api.ts:526` `version: '1.2.0'` |
| **对比** | `package.json` → 1.2.2, `mcp-server.ts` → 1.2.1 |

---

### [P2] Rx15: README-Index.md review 链接乱码 — ✅已由审查者修复

| 项目 | 详情 |
|------|------|
| **状态** | 当前索引文件（`doc/README-Index.md:44-46`）已正确，无需额外修复 |
| **说明** | 审查者已在本轮更新中修正，保留现有结果即可 |

---

## 本轮全部任务清单

### 任务依赖关系图

```
Rx12(假绿→true skip) ──┐                          第一波: 3个Agent并行
Rx13(脱敏goal-todo)  ──┤                          (无文件冲突)
Rx14(REST版本号)     ──┘
                         │
Rx10(P0 命令注入)    ────┤  第二波: 独立修复          (Agent-A)
                         │  需要Rx12完成后的clean test base
Rx11(集成测试修复)   ────┤  第二波: 独立修复          (Agent-B，可并行)
                         │
V2(全量回归:build+test+integration) ── 第三波: 串行验证
                         │
T15(真实CLI自测)     ────┤  第四波: 真实驱动验收
                         │
Rx16(开发报告v1.2.2) ────┤  第五波: 输出报告
```

---

## 第一波：低风险独立修复（3个Agent并行，无文件冲突）

### Rx12: 修复测试假绿 + statusFile 测试去平台限制 [P1]

| 属性 | 说明 |
|------|------|
| **文件** | `src/__tests__/terminal-manager.test.ts`, `src/__tests__/web-ui-server.test.ts` |
| **并行** | 独立，不可与修改同一文件的 Agent 并行 |

**详细步骤**:

**A. 修复 `ptyTest()` 使用 `test.skip` 而非 `return`**:
1. `terminal-manager.test.ts:9-13`：将 `if (IS_WINDOWS) return;` 改为条件选择 `const maybeTest = IS_WINDOWS ? test.skip : test;`
2. `web-ui-server.test.ts:80-84`：同样改为使用 `test.skip`
3. 所有调用 `ptyTest()` 的测试用例自动受益

**B. 修复 statusFile 测试移除 Windows 跳过逻辑**:
`terminal-manager.test.ts:545-753` 有 5 个 statusFile 测试使用 fake session（直接操作 `manager.sessions` Map, 不创建真实 PTY），这些测试在 Windows 上完全可以执行：
- Line 546: `if (IS_WINDOWS) return;` → 删除
- Line 597: `if (IS_WINDOWS) return;` → 删除
- Line 636: `if (IS_WINDOWS) return;` → 删除
- Line 678: `if (IS_WINDOWS) return;` → 删除
- Line 712: `if (IS_WINDOWS) return;` → 删除

**C. 验证测试报告准确性**:
1. 运行 `npm test` → 确认 skipped 数量 vs passed 数量分离
2. 确认 statusFile 5 个测试在所有平台通过
3. 输出中明确区分：`Tests: X passed, Y skipped, Z total`

**验收标准**:
- `test.skip` 替代 `return` 后 skipped 计数独立于 passed
- statusFile 5 个测试在 Windows 上通过（不跳过）
- 测试结果不再声称 "154/154 通过" 包含未执行的测试

---

### Rx13: 脱敏 `doc/goal-todo.md`（本文件） [P1]

| 属性 | 说明 |
|------|------|
| **文件** | `doc/goal-todo.md`（覆盖写入） |

**详细步骤**:
1. 本文件本身即为最终输出，写入时不使用任何本机绝对路径
2. 所有路径引用使用相对路径（如 `doc/第一次迭代/...`）
3. 环境脚本路径使用脱敏标记：`[REDACTED-proxy-script]`
4. 测试目录使用脱敏标记：`[REDACTED-project-root]/tanchishe`

**验收标准**:
- 文件中无 `F:\`, `D:\`, `C:\Users` 开头的绝对路径
- 无真实 session id / token / api key

---

### Rx14: 修复 REST API 版本号 [P2]

| 属性 | 说明 |
|------|------|
| **文件** | `src/rest-api.ts` |

**详细步骤**:
1. `rest-api.ts:526` `version: '1.2.0'` → `version: '1.2.2'`（与 `package.json` 一致）
2. 建议后续从 `package.json` 动态读取以避免漂移，但本轮最低要求是硬编码同步

**验收标准**:
- REST API `GET /` 返回 `version: '1.2.2'`
- 与 `package.json` version 字段一致

---

## 第二波：核心安全修复 + 集成测试修复（2个Agent并行）

### Rx10: 修复 `resume_terminal` 命令注入 [P0]

| 属性 | 说明 |
|------|------|
| **文件** | `src/terminal-manager.ts`, `src/mcp-server.ts`, `src/rest-api.ts`, `src/web-ui-server.ts`，新增安全测试 |
| **并行** | 可与 Rx11 并行（不同文件） |

**详细步骤**:

**A. 核心校验（terminal-manager.ts `resumeTerminal()` 入口）**:
1. 定义 Claude sessionId 白名单正则：`/^[A-Za-z0-9._:-]+$/`
2. 最大长度限制：200 字符
3. 拒绝包含空白、引号、`&`、`;`、`|`、`` ` ``、`$`、`(`、`)`、`<`、`>`、`\n`、`\r` 的输入
4. 校验失败抛出 typed validation error（`INVALID_SESSION_ID`），不创建终端
5. 实现位置：`terminal-manager.ts resumeTerminal()` 方法最开头

**B. MCP 层校验（mcp-server.ts）**:
1. 在 zod schema 中添加 `.regex()` 和 `.max()` 约束
2. 返回明确的错误消息

**C. REST 层校验（rest-api.ts）**:
1. 请求体到达后校验 sessionId 格式
2. 不合法返回 HTTP 400 + 错误描述

**D. Web UI 层校验（web-ui-server.ts）**:
1. 同 REST 层校验逻辑
2. 返回 HTTP 400

**E. 安全单元测试**:

新增文件 `src/__tests__/resume-terminal-security.test.ts`（或追加到现有 terminal-manager.test.ts）：

| 测试用例 | 输入 | 预期结果 |
|---------|------|---------|
| 合法 sessionId | `abc123` | 正常 |
| 合法带连字符 | `abc-123-def` | 正常 |
| 合法带下划线 | `abc_123` | 正常 |
| 合法带点号 | `abc.123` | 正常 |
| 合法带冒号 | `abc:123` | 正常 |
| 非法：命令注入 `&` | `abc&echo hacked` | VALIDATION_ERROR |
| 非法：命令注入 `;` | `abc;echo hacked` | VALIDATION_ERROR |
| 非法：管道符 | `abc\|evil` | VALIDATION_ERROR |
| 非法：包含空格 | `abc 123` | VALIDATION_ERROR |
| 非法：包含换行 | `abc\nrm -rf /` | VALIDATION_ERROR |
| 非法：引号 | `abc"` | VALIDATION_ERROR |
| 非法：超长 | 201 字符的合法字符串 | VALIDATION_ERROR |
| 非法：空字符串 | `` | VALIDATION_ERROR |

**F. REST 层安全测试**: 追加到 `src/__tests__/rest-api.test.ts`:
- POST `/api/terminals/:id/resume` with `sessionId=abc&echo hacked` → 400

**验收标准**:
- 合法 sessionId 正常工作
- 所有非法输入返回 validation error，不创建终端
- 所有安全测试通过（不依赖 PTY）
- MCP / REST / Web UI 三层各有校验

---

### Rx11: 修复 `npm run test:integration` 平台兼容性 [P1]

| 属性 | 说明 |
|------|------|
| **文件** | `package.json`, 各集成测试脚本 |
| **并行** | 可与 Rx10 并行 |

**详细步骤**:

**A. 集成测试脚本平台适配**:

对 5 个新增 PTY 依赖脚本，在开头加入平台检测，PTY 不可用时输出 skip 信息并 exit 0：

| 脚本 | PTY 依赖程度 | 处理方式 |
|------|-------------|---------|
| `test-create-terminal-init.mjs` | 高(需创建PTY) | Windows: skip + exit 0 |
| `test-wait-for-pattern.mjs` | 高(需创建PTY) | Windows: skip + exit 0 |
| `test-wait-for-result.mjs` | 高(需创建PTY) | Windows: skip + exit 0 |
| `test-terminal-status.mjs` | 高(需创建PTY) | Windows: skip + exit 0 |
| `test-resume-terminal.mjs` | 高(需创建PTY) | Windows: skip + exit 0 |

实现模式：
```js
if (process.platform === 'win32') {
  console.log('SKIP: PTY-dependent integration test not supported on Windows node-pty/ConPTY');
  process.exit(0);
}
```

**B. test:integration:terminal 特殊处理**:

`test-terminal-fixes.mjs` 是已有脚本，在 Windows 上多次出现 `Failed to create terminal: Error: File not found`。处理方式：
- 在脚本开头添加同样 skip 逻辑，输出明确 skip 原因
- 保留一个严格入口 `npm run test:integration:pty` 用于有真实 PTY 环境

**C. 更新 package.json scripts**:

```json
"test:integration": "...所有子脚本...",
"test:integration:pty": "npm run test:integration:terminal && npm run test:integration:raw-tail && npm run test:integration:init && npm run test:integration:pattern && npm run test:integration:result && npm run test:integration:status && npm run test:integration:resume"
```

**验收标准**:
- `npm run test:integration` 在 Windows 上 exit code 0，输出显示哪些脚本 skip
- `npm run test:integration:pty` 在有 PTY 环境的平台上可用
- 不再有 "通过:0, 失败:6" 出现在标准验收命令中

---

## 第三波：全量回归验证（串行）

### V2: 全量回归测试 [P0]

| 属性 | 说明 |
|------|------|
| **依赖** | Rx10~Rx14 全部完成 |

**步骤**:
1. `npm run build` → 确认编译通过
2. `npm test` → 确认全部通过，区分 passed / skipped
3. `npm run test:integration` → 确认 exit 0，所有 skip 可控
4. 检查已有测试（OutputBuffer, SpinnerDetection, result-parser, output-filter 等）保持通过
5. 检查无回归：`create_terminal_basic`, `write_terminal`, `read_terminal` 旧模式仍可用

**验收标准**:
- 三个命令 exit code 0
- skipped 测试有明确原因
- 无新增失败

---

## 第四波：真实 CLI 驱动自测

### T15: 真实 CLI 驱动验收 [P0]

| 属性 | 说明 |
|------|------|
| **依赖** | V2 全部通过 + `npm install -g .` + MCP 客户端已加载新构建 |

**前置校验**:
1. 确认运行中的 MCP 为本次新构建 → 若不满足，整轮验收无效
2. 确认环境变量脚本已执行
3. 确认 `[REDACTED-project-root]/tanchishe` 目录就绪

**重跑范围（按 gap-analysis 建议的最小集）**:

| 场景 | 验证点 | 方法 |
|------|--------|------|
| RD-002 wait_for_result | 子代理输出 `<task_result>` XML → 正确解析 PASS/FAIL | 发送带 XML 结果规范的任务 |
| RD-004 timeout snapshot | 短超时 → timedOut=true + 带输出快照 | wait_for_pattern(pat="never_appear", timeout=5s) |
| RD-006 content_only | 对比 raw+cleanAnsi vs content_only 字符数 + 关键行保留 | 两次 read_terminal 对比 |
| RD-008 REST API | POST /terminals (init), GET status, POST wait-result | HTTP 请求链 |
| RD-009 Web UI | 状态面板、过滤切换、等待操作显示 | 浏览器驱动 |

**测试方式**: 使用 `cli-agent-commander` skill + persistent-terminal-mcp 驱动 Claude Code CLI 子代理

**错误处理循环**:
1. 遇到错误 → 收集错误信息 + 根因分析
2. 判断是否为本项目代码问题 → 是则修复 → 重测
3. 直至全部通过或确认非本项目问题

**验收标准**:
- 5/5 场景通过（或合规解释不通过原因）
- 报告脱敏：无 session id、token、本机绝对路径
- 报告输出到 `doc/第一次迭代/test/`

---

## 第五波：开发报告

### Rx16: 输出 v1.2.2 整改开发报告 [P0]

| 属性 | 说明 |
|------|------|
| **依赖** | Rx10~Rx15 全部完成 + V2 + T15 |
| **输出** | `doc/第一次迭代/dev/2026-06-06-v1.2.2-dev-report.md` |

**内容**:
1. 修复记录：每项 Rx 的修复方案、文件变更、验证结果
2. 测试结果：单元/集成/真实驱动（passed / skipped / failed 分离）
3. 自审清单：无遗漏、无假绿、无敏感信息、版本一致
4. 文件变更统计

---

## 第一轮审查问题状态追踪（供对照）

| ID | 问题 | 一轮状态 | 二轮状态 | 本轮处理 |
|----|------|---------|---------|---------|
| P0-1 | statusFile 未接入 | 已修复 | 部分通过(代码OK, RD-008只测null) | T15 补测完整路径 |
| P0-2 | fast-xml-parser 缺依赖 | 已修复 | ✅ 通过 | 无需处理 |
| P1-1 | 测试入口未接入 | 已修复 | 部分通过(test:integration仍失败) | → Rx11 |
| P1-2 | Web UI 假覆盖 | 已修复 | 部分通过(ptyTest return) | → Rx12 |
| P1-3 | filter 元数据丢弃 | 已修复 | ✅ 通过 | 无需处理 |
| P1-4 | 敏感信息泄漏 | 已修复 | 部分通过(goal-todo.md) | → Rx13 |
| P2 | 元数据漂移 | 已修复 | 部分通过(REST 1.2.0) | → Rx14 |

---

## 并行执行策略

```
第一波（3 Agent 并行，无文件冲突）：
┌─ Agent-A: Rx12 (terminal-manager.test.ts + web-ui-server.test.ts 假绿修复)
├─ Agent-B: Rx13 (goal-todo.md 脱敏，即本文件)  
└─ Agent-C: Rx14 (rest-api.ts 版本号修正，1行)
│
第二波（2 Agent 并行）：
┌─ Agent-A: Rx10 (P0 命令注入修复 + 安全测试)
└─ Agent-B: Rx11 (集成测试平台兼容)
│
第三波（串行，主Agent）：
└─ V2: 全量回归 (build + test + integration)
│
第四波（串行，主Agent + cli-agent-commander）：
└─ T15: 真实 CLI 驱动验收
│
第五波（最终收尾）：
└─ Rx16: 开发报告输出
```

---

## 完成检查清单

### 第二轮发现修复
- [x] **Rx10**: resumeTerminal sessionId 格式校验（白名单 + 长度限制）
- [x] **Rx10**: MCP / REST / Web UI 三层各有校验
- [x] **Rx10**: 安全测试覆盖全部 13 个攻击向量
- [x] **Rx11**: 集成脚本平台 skip → exit 0
- [x] **Rx11**: `npm run test:integration` Windows 上 exit 0
- [x] **Rx12**: `ptyTest()` 改为 `test.skip`
- [x] **Rx12**: statusFile 5 个测试移除 `if (IS_WINDOWS) return`
- [x] **Rx13**: `doc/goal-todo.md` 和 `doc/任务详情.md` 无绝对路径
- [x] **Rx14**: REST API version 与 package.json 一致（均为 1.2.2）

### 验证
- [x] `npm run build` 通过
- [x] `npm test` 全部通过（26 skipped, 142 passed, 168 total）
- [x] `npm run test:integration` Windows exit 0
- [x] 新增安全测试全部通过（13 cases）
- [x] 已有测试无回归

### 真实驱动
- [x] T15: 5 个场景全部通过（RD-002, RD-004, RD-006, RD-008, RD-009）
- [x] 验收报告已脱敏

### 收尾
- [x] Rx16: 开发报告已输出到 `doc/第一次迭代/dev/`
- [x] `doc/README-Index.md` 已更新
