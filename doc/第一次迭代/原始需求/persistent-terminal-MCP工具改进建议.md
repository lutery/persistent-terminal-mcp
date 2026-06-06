# persistent-terminal MCP 工具改进建议

**文档编号**: PT-IMPROVE-001
**日期**: 2026-06-06
**来源**: Claude Code 驱动子代理测试实践反馈（1M 长上下文兼容性验证、代码审查整改验证等多轮测试）
**目标读者**: persistent-terminal MCP 工具研发团队

---

## 1. 背景

在 CodingProxy 项目中，我们通过 `cli-agent-commander` 技能驱动 Claude Code CLI 作为子代理执行自动化测试任务。整个流程为：

```
主代理 → persistent-terminal MCP → Claude Code CLI (子代理) → 工具调用 → 验证结果
```

在多轮实际使用中（累计驱动子代理执行约 60+ 次工具调用、编写 1102 行生成脚本、运行约 24 分钟的复杂任务），我们发现了以下系统性问题。本文档按优先级排列，每项包含：问题场景、根因分析、改进方案和验收标准。

---

## 3. P0: 完成状态检测

### 3.1 问题场景

主代理需要判断子代理是否完成任务。当前依赖 `wait_for_output` + `stableTime` 参数，但存在两类误判：

| 场景 | 终端输出 | stableTime 判断 | 实际状态 |
|------|---------|----------------|---------|
| 子代理在深度思考 | 无新输出 | ✅ 稳定 | ❌ 仍在工作 |
| 子代理等待用户输入 | 无新输出 | ✅ 稳定 | ✅ 等待中 |
| 子代理完成任务 | 无新输出 | ✅ 稳定 | ✅ 已完成 |
| 子代理崩溃 | 无新输出 | ✅ 稳定 | ❌ 已崩溃 |

三种情况终端输出都"稳定"了，但含义完全不同。主代理无法区分"思考中"和"已完成"。

### 3.2 根因分析

- persistent-terminal 只能看到原始 PTY 输出流，不理解 Claude Code CLI 的状态机
- Claude Code CLI 的 TUI 界面中，状态信息（thinking...、idle、error）是通过 ANSI 转义序列渲染的，不是结构化数据

### 3.3 改进方案

**方案 A：状态文件约定（推荐）**

Claude Code CLI 在运行时写入一个状态文件（如 `/tmp/claude-status-{session}.json`）：

```json
{
  "status": "thinking" | "tool_executing" | "waiting_input" | "idle" | "error",
  "last_activity": "2026-06-06T10:30:45Z",
  "tool_calls": 15,
  "files_modified": 3
}
```

persistent-terminal 增加 `get_status` 操作读取此文件：

```jsonc
read_terminal({
  terminalId: "xxx",
  mode: "status"  // 返回结构化状态而非原始输出
})
```

**方案 B：输出模式识别**

在 `read_terminal` 的 `cleanAnsi` 处理中增加 Claude Code CLI 状态模式识别：

- 检测 `○` spinner → status: thinking
- 检测 `❯` 输入提示符 → status: waiting_input
- 检测 `✓` 完成标记 → status: completed
- 检测 `✗` 错误标记 → status: error

### 3.4 验收标准

- [ ] 能准确区分"思考中"、"等待输入"、"已完成"三种状态
- [ ] 状态查询响应时间 < 500ms
- [ ] 子代理崩溃时能检测到（进程退出码非 0）

---

## 4. P1: TUI 输出信噪比优化

### 4.1 问题场景

`read_terminal` 返回的内容中包含大量 TUI 装饰信息：

```
⏺ ← spinner 动画残留
  0.5s ← 工具调用计时
  ↗ cursor 移动标记
▎ ← 进度条残留
⏵ ← 折叠标记
  ╭──────────────────────────────────╮ ← diff 边框
  │ - old line                        │
  │ + new line                        │
  ╰──────────────────────────────────╯
```

即使使用 `raw=true, cleanAnsi=true`，这些内容仍然存在，导致：
- 输出量大（一次回复可产生 5000+ 行原始输出）
- 关键信息被淹没（如测试结果、文件路径、错误消息）
- 主代理需要消耗大量 token 来解析这些信息

### 4.2 改进方案

**方案 A：增加 `content_only` 模式（推荐）**

```jsonc
read_terminal({
  terminalId: "xxx",
  mode: "content_only",  // 新模式：只返回 Claude 的文本回复
  tailLines: 50
})
```

`content_only` 模式过滤规则：
- 移除所有 spinner/进度条残留
- 移除 diff 边框和 ANSI 色码
- 保留 Claude 的文本回复、代码块、文件路径
- 保留工具调用结果（压缩为单行摘要）
- 保留错误消息（红色输出）

**方案 B：增加 `get_last_response` 快捷方法**

```jsonc
read_terminal({
  terminalId: "xxx",
  mode: "last_response"  // 只返回最后一个完整的 Claude 回复
})
```

### 4.3 验收标准

- [ ] `content_only` 模式输出量比 `raw+cleanAnsi` 减少 70% 以上
- [ ] 关键信息（文件路径、错误消息、测试结果）保留率 100%
- [ ] 不丢失任何需要人工确认的内容

---

## 5. P1: 结构化反馈机制

### 5.1 问题场景

子代理的回复是自由文本格式，主代理需要人工解析来判断任务是否成功。例如：

```
我已经完成了测试文件的编写。测试文件位于：
- test_cancelled_error_writes_request_failed
- test_generator_exit_writes_request_failed

运行测试：
2 passed, 46 deselected in 0.80s
```

主代理需要用正则或关键词匹配来提取"2 passed"和"0 failed"，这种解析脆弱且不可靠。

### 5.2 改进方案

**方案：结构化结果标记**

在主代理发送任务指令时，约定子代理在任务完成后输出结构化状态行：

```
### RESULT: PASS
### FILES: test_streaming_boundary.py
### TESTS: 2 passed, 46 deselected
```

persistent-terminal 增加 `wait_for_result` 方法：

```jsonc
wait_for_result({
  terminalId: "xxx",
  pattern: "### RESULT: (PASS|FAIL)",  // 正则模式
  timeout: 300000  // 5分钟超时
})
// 返回: { status: "PASS", details: "...", files: [...] }
```

### 5.3 验收标准

- [ ] 能可靠提取子代理的任务结果状态（PASS/FAIL）
- [ ] 支持自定义结果标记模式
- [ ] 超时后返回当前终端状态快照

---

## 6. P2: 终端恢复能力

### 6.1 问题场景

子代理崩溃或终端断开时，当前流程：
1. 检测到终端无响应（`read_terminal` 返回空或报错）
2. `kill_terminal` 清理旧终端
3. `create_terminal_basic` 创建新终端
4. 重新执行初始化（source proxy 等）
5. `claude --resume <session-id>` 恢复会话

整个过程需要 5-8 次工具调用，且需要记住 session-id。

### 6.2 改进方案

**增加 `resume_terminal` 操作**

```jsonc
// 方案A：从崩溃的终端恢复
create_terminal_basic({
  cwd: "K:/Projects/python/LiteLLMProxy",
  resume_from: "old_terminal_id",  // 从旧终端恢复
  init_commands: [". 'D:\\DevelopmentKit\\aiprogram\\claude_coding_proxy.ps1'"]
})

// 方案B：自动检测并恢复
create_terminal_basic({
  cwd: "K:/Projects/python/LiteLLMProxy",
  auto_resume: true,  // 自动查找并恢复最近的会话
  init_commands: ["..."]
})
```

### 6.3 验收标准

- [ ] 终端崩溃后能一键恢复（不超过 2 次工具调用）
- [ ] 恢复后子代理保留之前的对话上下文
- [ ] 恢复后自动执行初始化命令

---

## 7. P2: Windows 初始化自动化

### 7.1 问题场景

每次创建新终端都需要手动执行初始化命令：

```powershell
. "D:\DevelopmentKit\aiprogram\claude_coding_proxy.ps1"
claude --dangerously-skip-permissions
```

然后 `wait_for_output` 等待 CLI 启动（约 8-30 秒）。如果中间任何一步失败（如代理脚本路径变化、CLI 未安装），整个流程卡住。

### 7.2 改进方案

**增加 `init_commands` 和 `ready_pattern` 参数**

```jsonc
create_terminal_basic({
  cwd: "K:/Projects/python/LiteLLMProxy",
  init_commands: [
    ". 'D:\\DevelopmentKit\\aiprogram\\claude_coding_proxy.ps1'",
    "claude --dangerously-skip-permissions"
  ],
  ready_pattern: "claude>",  // 等到此模式出现才返回
  ready_timeout: 30000       // 30秒超时
})
```

工具内部：
1. 创建终端
2. 依次执行 `init_commands`
3. 监控输出直到 `ready_pattern` 匹配
4. 返回终端 ID 和就绪状态

### 7.3 验收标准

- [ ] 创建终端后自动执行初始化命令
- [ ] 支持等待 `ready_pattern` 出现后才返回
- [ ] 初始化失败时返回明确的错误信息（而非卡住）
- [ ] 支持超时配置

---

## 8. 优先级总结

| 优先级 | 改进项 | 用户价值 | 实现复杂度 |
|--------|--------|---------|-----------|
| **P0** | 完成状态检测 | 消除误判，提升自动化可靠性 | 中 — 方案A需CLI配合，方案B可独立实现 |
| **P1** | TUI 输出信噪比优化 | 减少 70%+ token 消耗 | 低 — 纯过滤逻辑 |
| **P1** | 结构化反馈机制 | 程序化判断任务成败 | 低 — 约定+解析 |
| **P2** | 终端恢复能力 | 崩溃场景一键恢复 | 低 — 封装现有流程 |
| **P2** | Windows 初始化自动化 | 启动便利性 | 低 — 封装现有流程 |

---

## 9. 附录：当前工作流完整示例

以下是一次典型的子代理驱动测试的完整工具调用序列（约 15 步）：

```
1. create_terminal_basic({ cwd: "..." })
2. write_terminal({ input: ". 'D:\\...\\claude_coding_proxy.ps1'" })
3. wait_for_output({ stableTime: 3000 })
4. write_terminal({ input: "claude --dangerously-skip-permissions" })
5. wait_for_output({ stableTime: 8000 })
6. write_terminal({ input: "编写测试 test_xxx.py，验证 YYY 功能" })
7. wait_for_output({ stableTime: 5000 })
8. read_terminal({ mode: "tail", raw: true, cleanAnsi: true })  ← 检查权限提示
9. write_terminal({ input: "", sendEnter: true })                ← 批准权限
10. wait_for_output({ stableTime: 5000 })
11. read_terminal({ ... })                                        ← 检查下一个权限提示
12. write_terminal({ ... })                                       ← 再次批准
13. ... 重复 8-12 多次 ...
14. read_terminal({ mode: "tail", tailLines: 30 })               ← 读取最终结果
15. kill_terminal({ terminalId: "..." })
```

改进后期望的流程（约 3 步）：

```
1. create_terminal_basic({ cwd: "...", init_commands: [...], ready_pattern: "claude>" })
2. write_terminal({ input: "编写测试 test_xxx.py", auto_approve: { enabled: true } })
3. wait_for_result({ pattern: "### RESULT: (PASS|FAIL)", timeout: 300000 })
```

**效率提升：15 步 → 3 步，减少 80% 交互轮次。**