# Persistent Terminal MCP — 发布前真实验收任务清单

**生成日期**: 2026-06-07 14:04
**当前版本**: 1.2.7（审查者文档维护）
**审查状态**: ✅ 第五轮审查通过
**阶段**: 发布前真实驱动测试验收 — 已完成

---

## 背景

经过 5 轮审查（16 个问题全部闭环），代码已通过审查。当前进入发布前最后阶段：**构建安装 → 真实 CLI 驱动自测 → 验收报告 → 合入主分支**。

---

## 审查问题终态汇总

| 轮次 | 报告 | 问题数 | 结论 |
|------|------|:--:|:--:|
| R1 | v1.2.0-code-review | 7 | 不通过 |
| R2 | v1.2.1-remediation | 6 | 不通过 |
| R3 | v1.2.2-third-round | 2 | 不通过 |
| R4 | v1.2.4-fourth-round | 3 | 不通过 |
| R5 | v1.2.6-fifth-round | 0 | ✅ **通过** |

---

## 本轮任务清单

### T1: 构建项目 + 安装部署 [P0] — ✅ 完成

- npm run build → exit 0
- npm install -g . → 安装 persistent-terminal-mcp@1.2.7
- where persistent-terminal-mcp → E:\Program Files\nodejs\persistent-terminal-mcp

### T2: 环境准备 [P0] — ✅ 完成

- cli-agent-commander skill 已加载
- create_terminal initCommands 执行代理脚本
- MCP 连接正常，版本 1.2.7

### T3: 真实 CLI 驱动测试 — 小游戏开发 [P0] — ✅ 完成

- 子代理完成贪吃蛇游戏开发
- 游戏在 http://localhost:3003 正常运行
- 所有 v1.2.0 新功能验证通过（见测试报告）

### T4: 输出测试报告 [P0] — ✅ 完成

- 报告已输出: `doc/第一次迭代/test/2026-06-07-v1.2.7-real-cli-driver-report.md`
- 全部验收标准 PASS (AC-001~006)

### T5: 问题记录与分析（条件性）[P1] — ✅ 无阻塞问题

- 发现 3 个问题 (1 P2, 2 P3)，均为非阻塞
- 无需代码修复

### T6: 合并主分支 + 推送（条件性）[P0] — 待执行

- 全部测试通过，无阻塞问题
- 准备合并 codex/terminal-improvements-iter1-docs → main