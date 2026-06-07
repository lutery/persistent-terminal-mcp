# Persistent Terminal MCP — 第四轮审查(勘误后)整改任务清单

**生成日期**: 2026-06-07 13:09
**当前版本**: 1.2.6（审查者已同步 package.json + lock + mcp-server + rest-api）
**审查状态**: 第四轮整改完成，待审查

---

## 架构师本轮勘误说明

我上一轮反馈的 3 个问题，架构师已在审查报告和任务详情中修正：

| 反馈项 | 原报告 | 勘误后 | 状态 |
|--------|--------|--------|:--:|
| 行号引用不存在(152/153/157/160) | 引用了不存在的行 | → 138/139/143/146 | ✅ 已修正 |
| 行41绝对路径是审查者自己写的 | 列为开发者问题 | → 明确"属于审查产物自身写入" | ✅ 已修正 |
| rest-api.test.ts 未分类 PTY 测试 | 只列出70行 | → 补充 79/100/112/142/174/200 | ✅ 已补充 |

版本同步：审查者已将全部版本字符串同步到 `1.2.6`（package.json / lock / mcp-server / rest-api）。

---

## 当前剩余问题（逐项代码确认）

### 需要修复 #1: [P1] 3 处 silent return + 6 处 PTY 测试未声明策略

| 来源 | 审查报告（勘误后）§Finding #1, line 26-64 |
|------|------------------------------------------|

**3 处 silent return（假绿）**:
| 文件 | 行号 | 代码 | 类型 | 修复方式 |
|------|------|------|------|---------|
| `src/__tests__/mcp-server.test.ts` | 21 | `if (process.platform === 'win32') return;` | 真实PTY → 需 `test.skip` | ✅ 改为 maybeTest |
| `src/__tests__/mcp-server.test.ts` | 42 | `if (process.platform === 'win32') return;` | 真实PTY → 需 `test.skip` | ✅ 改为 maybeTest |
| `src/__tests__/rest-api.test.ts` | 70 | `if (process.platform === 'win32') return;` | 真实PTY → 需 `test.skip` | ✅ 改为 maybeTest |

**6 处 PTY 依赖无 Windows 策略（rest-api.test.ts）**:
| 行号 | 操作 | 当前状态 | 修复方式 |
|------|------|---------|---------|
| 79 | `POST /terminals` 带 init 选项 | 无守卫 | ✅ 改为 maybeTest |
| 100 | `POST /terminals` → `GET /status` | 无守卫 | ✅ 改为 maybeTest |
| 112 | `POST /terminals` → `GET /status?preview` | 无守卫 | ✅ 改为 maybeTest |
| 142 | `POST /terminals` → `POST /wait-pattern` | 无守卫 | ✅ 改为 maybeTest |
| 174 | `POST /terminals` → `POST /wait-result` | 无守卫 | ✅ 改为 maybeTest |
| 200 | `POST /terminals` → `GET /output` | 无守卫 | ✅ 改为 maybeTest |

---

### 需要修复 #2: [P1] 已跟踪文档绝对路径 + 开发报告脱敏结论不成立

| 来源 | 审查报告（勘误后）§Finding #2, line 66-93 |
|------|------------------------------------------|

**A. `doc/任务详情.md` 中 4 处绝对路径（测试说明部分）**:
| 行号 | 内容 | 性质 | 修复方式 |
|------|------|------|---------|
| 138 | `D:\DevelopmentKit\aiprogram\claude_coding_proxy.ps1` | 用户原始测试指令 | ✅ 替换为 [REDACTED-proxy-script] |
| 139 | `F:\Projects\OpenSrouce\WebApp\persistent-terminal-mcp\tanchishe` | 用户原始测试指令 | ✅ 替换为 [REDACTED-project-root]/tanchishe |
| 143 | `D:\DevelopmentKit\aiprogram\claude_coding_proxy.ps1` | 用户原始测试指令 | ✅ 替换为 [REDACTED-proxy-script] |
| 146 | `F:\Projects\OpenSrouce\WebApp\persistent-terminal-mcp\tanchishe` | 用户原始测试指令 | ✅ 替换为 [REDACTED-project-root]/tanchishe |

**B. 开发报告脱敏结论不成立**:
| 文件 | 行号 | 内容 | 修复方式 |
|------|------|------|---------|
| `doc/第一次迭代/dev/2026-06-06-v1.2.2-dev-report.md` | 73 | 问题描述中引用了路径模式 | ✅ 移除具体数量声明 |
| | 79 | 生成了不准确结论 | ✅ 修正为准确描述 |

---

### 已确认无需处理

| 项目 | 说明 |
|------|------|
| P2 package-lock 版本漂移 | 审查者已同步到 1.2.6 |
| 所有版本字符串不一致 | 审查者已同步到 1.2.6 |
| 行 41 绝对链接 | 审查者已修正为相对路径 |
| 行 45/46/57/58/60 误判 | 审查者已从 Finding #2 证据清单中移除 |

---

## 本轮任务清单

```
Rx23（单Agent，文件不冲突，可一次性完成）
├── Rx23A: 3处 silent return → test.skip        ✅
├── Rx23B: 6处 REST PTY 测试 → 添加 test.skip 守卫  ✅
├── Rx23C: 任务详情.md 测试说明路径 → 标记[REDACTED]  ✅
├── Rx23D: dev-report:79 脱敏结论修正             ✅
│
V5: 全量回归 (build + jest + integration)          ✅
│
Rx24: v1.2.6 开发报告                              ✅
```

---

### Rx23: 修复剩余假绿 + 路径脱敏 + 结论修正 [P1] — ✅ 已完成

#### Rx23A: 3 处 silent return → test.skip — ✅ 已完成

| 文件 | 行 | 修改 |
|------|-----|------|
| `src/__tests__/mcp-server.test.ts` | 21 | ✅ 添加 maybeTest，转换测试 |
| `src/__tests__/mcp-server.test.ts` | 42 | ✅ 添加 maybeTest，转换测试 |
| `src/__tests__/rest-api.test.ts` | 70 | ✅ 添加 maybeTest，转换测试 |

#### Rx23B: 6 处 REST PTY 测试添加守卫 — ✅ 已完成

| 文件 | 行 | 修改 |
|------|-----|------|
| `src/__tests__/rest-api.test.ts` | 79 | ✅ 用 `maybeTest` 替换 `test` |
| ~ | 100 | ✅ 同上 |
| ~ | 112 | ✅ 同上 |
| ~ | 142 | ✅ 同上 |
| ~ | 174 | ✅ 同上 |
| ~ | 200 | ✅ 同上 |

#### Rx23C: 脱敏测试说明路径 — ✅ 已完成

`doc/任务详情.md` 第 138/139/143/146 行 → 全部替换为 `[REDACTED-proxy-script]` 或 `[REDACTED-project-root]/tanchishe`。

#### Rx23D: 修正开发报告脱敏结论 — ✅ 已完成

`doc/第一次迭代/dev/2026-06-06-v1.2.2-dev-report.md:79` → 修正为准确描述。

**验收标准**:
- ✅ 全仓 `grep "if (\(IS_WINDOWS\|process\.platform === 'win32'\)) return" src/__tests__/*.ts` = 0
- ✅ `npx jest` skipped 正确分离（40 skipped），无 silent return
- ✅ 任务详情.md 中测试说明路径已替换为 `[REDACTED]`
- ✅ dev-report 脱敏结论与实际一致

---

### V5: 全量回归验证 [P0] — ✅ 已完成

| 命令 | 预期 | 结果 |
|------|------|------|
| `npm run build` | exit 0 | ✅ 通过 |
| `npx jest --runInBand` | exit 0，ptest/skipped 分离，无 silent return | ✅ 40 skipped, 128 passed, 168 total |
| `npm run test:integration` | exit 0 | ✅ 通过 |
| `grep "if (IS_WINDOWS) return\|if (process.platform === 'win32') return" src/__tests__/*.ts` | 0 结果 | ✅ 0 结果 |

---

### Rx24: 输出 v1.2.6 开发报告 [P0] — ✅ 已完成

| 输出 | `doc/第一次迭代/dev/2026-06-07-v1.2.6-dev-report.md` |
|------|------------------------------------------------------|

内容：本轮修复记录 + 测试结果 + 自审清单。

---

## 跨轮次问题追踪

| ID | 内容 | R1 | R2 | R3 | R4 | 最终 |
|----|------|:--:|:--:|:--:|:--:|:--:|
| P0-1~3 | statusFile / 依赖 / 命令注入 | — | — | — | ✅ | 通过 |
| P1-1~7 | 测试入口 / WebUI / filter / 敏感 / 集成 / 16假绿 / 验收报告 | — | — | — | ✅ | 通过 |
| P1-8 | mcp/rest test 3处 silent return | — | — | — | ❌ | ✅ Rx23A 已修 |
| P1-9 | rest test 6处 PTY 未分类 | — | — | — | ❌ | ✅ Rx23B 已修 |
| P1-10 | 任务详情.md 测试说明路径 | — | — | — | ❌ | ✅ Rx23C 已修 |
| P1-11 | dev-report 脱敏结论不成立 | — | — | — | ❌ | ✅ Rx23D 已修 |
| P2-1~4 | 版本漂移 / 锁文件 / README | — | — | — | ✅ | 通过 |

---

## 完成检查清单

- [x] **Rx23A**: 3 处 silent return 改为 maybeTest/test.skip
- [x] **Rx23B**: 6 处 REST PTY 测试改为 maybeTest
- [x] **Rx23C**: 任务详情.md 测试说明路径已替换为 [REDACTED]
- [x] **Rx23D**: dev-report 脱敏结论已修正
- [x] **V5**: `npm run build` 通过
- [x] **V5**: `npx jest --runInBand` 全部通过，skipped 正确分离（40 skipped, 128 passed）
- [x] **V5**: `npm run test:integration` exit 0
- [x] **V5**: 全仓无 `if (IS_WINDOWS) return` 或 `if (process.platform === 'win32') return`
- [x] **Rx24**: v1.2.6 开发报告已输出
- [x] **全量自审**: 无假绿、无敏感信息、版本一致、向后兼容
