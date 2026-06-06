# persistent-terminal-mcp Documentation Index

Last updated: 2026-06-06

Latest decision update: Q-001 through Q-005 have been confirmed and applied. Additional confirmations cover real Claude Code CLI plus mock acceptance, Web UI wait actions, JSON status files, XML parser dependency, Claude Code resume convention, and content filtering correctness over compression.

## Current Version: 1.2.1

### v1.2.0 New Features (2026-06-06)
- `wait_for_pattern` MCP tool: regex pattern matching with timeout and capture groups
- `wait_for_result` MCP tool: XML `<task_result>` block detection and parsing
- `get_terminal_status` MCP tool: structured status with semantic state detection
- `resume_terminal` MCP tool: resume CLI agent sessions in new PTY
- `create_terminal` enhanced: init commands, ready pattern, timeout, failure detection
- `read_terminal` enhanced: `content_only` mode (filtered), `last_response` mode (extract AI response)
- `OutputFilter` module: conservative TUI noise removal
- `ResultParser` module: secure XML parsing with `fast-xml-parser`
- `StatusProvider` module: JSON status file reader
- REST API: 4 new endpoints (status, wait-pattern, wait-result, resume)
- Web UI: status panel, filter toggle, wait operations, resume, init support

## Iteration 1: Terminal Automation Improvements

### Source Requirements

- [Original feedback: persistent-terminal MCP improvement suggestions](./第一次迭代/原始需求/persistent-terminal-MCP工具改进建议.md)

### Requirements and Design

- [Requirements analysis](./第一次迭代/doc/2026-06-06-requirements-analysis.md)
- [System design](./第一次迭代/doc/2026-06-06-system-design.md)

### Development Planning

- [Implementation plan](./第一次迭代/dev/2026-06-06-development-plan.md)

### Test and Acceptance

- [Test acceptance plan](./第一次迭代/test/2026-06-06-test-acceptance-plan.md)
- [Real driver acceptance plan](./第一次迭代/test/2026-06-06-real-driven-acceptance-plan.md)

### Review

- [v1.2.0 code review report](./绗竴娆¤凯浠?review/2026-06-06-v1.2.0-code-review.md)
- [v1.2.0 real driver gap analysis](./绗竴娆¤凯浠?review/2026-06-06-v1.2.0-real-driver-gap-analysis.md)

## Directory Guide

| Directory | Purpose |
| --- | --- |
| `doc/第一次迭代/原始需求/` | Raw user or stakeholder requirement materials. |
| `doc/第一次迭代/doc/` | Requirements analysis, system design, decisions, and related planning documents. |
| `doc/第一次迭代/dev/` | Development plans and implementation handoff documents. |
| `doc/第一次迭代/test/` | Test plans, acceptance plans, and real-driver validation records. |
| `doc/第一次迭代/review/` | Review reports, if code review or design review artifacts are produced. |

## Current Planning TODO Review

- [x] Requirement feedback was read and compared with current code.
- [x] Requirements analysis was created.
- [x] System design was created.
- [x] Development plan was created.
- [x] Test acceptance plan was created.
- [x] Real driver acceptance plan was created.
- [x] Documentation index was created and updated.
