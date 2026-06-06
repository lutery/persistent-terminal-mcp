# persistent-terminal MCP Improvement Requirements Analysis

Document ID: PT-ITER1-REQ-001
Date: 2026-06-06
Source: `doc/第一次迭代/原始需求/persistent-terminal-MCP工具改进建议.md`
Status: Updated after stakeholder answers

## Planning TODO

- [x] Read original feedback and current repository structure.
- [x] Verify current implementation against the feedback.
- [x] Separate confirmed requirements from assumptions.
- [x] Identify infeasible or risky proposals.
- [x] Define measurable acceptance criteria.
- [x] Record open questions for user confirmation.
- [x] Link this document from `doc/README-Index.md`.

## Executive Summary

The feedback is reasonable and describes real automation pain points in the current persistent terminal workflow. The current implementation already provides persistent PTY sessions, buffered output, raw replay, ANSI cleanup, head/tail reading, `sendEnter`, and basic command/prompt status. However, it still cannot reliably answer the higher-level question: "has the child agent finished, is it thinking, or is it waiting for input?"

The viable product direction is to split the improvements into two layers:

1. General terminal capabilities that are safe for all clients and exposed through MCP, REST API, and Web UI in the same iteration: initialization commands, ready-pattern waiting, pattern/result waiting, structured terminal status, and output filtering hooks.
2. Claude/Codex TUI-specific adapters that use optional heuristics or external status files, without making the generic MCP server depend on one TUI's visual format.

Any design that promises exact Claude internal state from PTY text alone is not feasible. It must either rely on a cooperative status source, such as a status file or wrapper script, or present the result as best-effort heuristic status.

## Current Implementation Findings

### Confirmed Existing Capabilities

- MCP tools are registered in `src/mcp-server.ts`: `create_terminal`, `create_terminal_basic`, `write_terminal`, `read_terminal`, `list_terminals`, `kill_terminal`, `get_terminal_stats`, `wait_for_output`, `open_terminal_ui`, and `fix_bug_with_codex`.
- `read_terminal.mode` currently supports only `full`, `head`, `tail`, and `head-tail`.
- `read_terminal` supports raw PTY replay through `raw=true`, optional ANSI cleanup through `cleanAnsi`, and response truncation through `maxChars`.
- `TerminalManager` tracks sessions, PTY processes, parsed output buffers, raw output buffers, prompt heuristics, pending command, and last command.
- `wait_for_output` only waits for output inactivity and does not return semantic task completion.
- REST API and Web UI also call `TerminalManager`; core behavior should be implemented there first.

### Confirmed Gaps

- No `init_commands`, `ready_pattern`, or `ready_timeout` support during terminal creation.
- No `wait_for_result` or `wait_for_pattern` tool.
- No explicit structured `get_terminal_status` tool.
- No supported `content_only` or `last_response` output mode.
- No terminal resume operation.
- No persisted mapping from a terminal session to a Claude/Codex conversation session id.

## Goals

- Reduce repeated manual tool calls in child-agent workflows.
- Provide programmatic result detection for long-running TUI-driven tasks.
- Improve output signal-to-noise without losing critical information.
- Keep stdio purity for MCP JSON-RPC.
- Keep the terminal server usable for non-Claude/non-Codex clients.
- Provide a realistic, testable implementation plan.

## Non-Goals

- Do not implement code in this planning phase.
- Do not require upstream Claude Code CLI or Codex CLI changes for the first usable increment.
- Do not promise exact child-agent cognitive state from PTY rendering alone.
- Do not persist passwords, API keys, tokens, or raw secrets in planning documents, logs, status files, or git-tracked artifacts.
- Do not replace the existing `read_terminal` modes; add compatible extensions.

## Personas and Actors

| Actor | Role | Need |
| --- | --- | --- |
| Primary AI agent | MCP client user | Drive long-running CLI child-agent tasks with fewer tool calls. |
| Child CLI agent | TUI process inside PTY | Run tasks, request permission, produce results, and sometimes crash or wait. |
| Developer | Maintainer | Implement changes without breaking existing MCP clients. |
| QA / verification agent | Tester | Validate behavior through automated and real CLI scenarios. |
| REST/Web UI user | Required iteration-1 consumer | Use the same new terminal automation and status features through HTTP and browser UI. |

## Functional Requirements

### FR-001: Terminal creation with initialization commands

The system shall support optional `initCommands` when creating a terminal.

- Trigger: caller creates a terminal with initialization commands.
- Preconditions: shell and cwd are valid.
- Main flow: create PTY, run commands in order, capture output, return terminal id and initialization status.
- Error handling: if a command fails only by output pattern, the server cannot know automatically unless a failure pattern or timeout is configured.
- Acceptance: a terminal can be created and prepared in one tool call for a known shell workflow.

### FR-002: Ready-pattern waiting

The system shall support optional `readyPattern` and `readyTimeoutMs` after initialization.

- Trigger: terminal creation includes `readyPattern`.
- Main flow: watch output until regex/string pattern matches or timeout expires.
- Timeout behavior: return terminal id, current output snapshot, and `ready=false`; do not hang indefinitely.
- Acceptance: successful match returns within configured timeout and failed match returns a clear timeout response.

### FR-003: Pattern/result waiting

The system shall provide a wait operation that watches terminal output for a caller-provided pattern.

- Recommended generic tool: `wait_for_pattern`.
- Optional convenience wrapper: `wait_for_result` for structured XML result blocks.
- Main flow: repeatedly inspect new output until pattern matches, process exits, or timeout occurs.
- Acceptance: returns matched groups, output snapshot, terminal status, and timeout flag.

### FR-004: Structured status query

The system shall expose a structured terminal status query.

- Must include process/session status, last activity, pending command, prompt heuristic, last command, raw/parsed buffer cursors, and optional exit information.
- May include `semanticStatus` only if sourced from a cooperative status provider or marked as heuristic.
- Acceptance: status query response time under 500 ms for active sessions with normal buffer sizes.

### FR-005: Optional cooperative status file

The system should support an optional status file path per terminal session.

- Main flow: caller provides a `statusFile` path or environment variable. Server reads and validates JSON status on request.
- Security: status file path must be explicit and should not be globbed automatically.
- Acceptance: invalid JSON or missing file returns `statusSource.available=false`, not an unhandled error.

### FR-006: Content-only output filtering

The system should provide a best-effort filtered output mode that removes common TUI decoration and repetitive noise.

- Must be documented as best-effort, not lossless.
- Must preserve error-like lines, file paths, test summaries, code fences, and explicit user prompts where possible.
- Acceptance: filtered output must not remove or distort information needed by the primary agent to make a correct decision. Noise reduction is a secondary metric and must never override correctness.

### FR-007: Last response extraction

The system may provide a `last_response` mode for known child-agent transcript shapes.

- Constraint: this is adapter-specific and must not be treated as generic PTY truth.
- Acceptance: works against recorded Claude/Codex transcript fixtures and returns a fallback snapshot when boundaries are not detected.

### FR-008: Resume workflow wrapper

The system should support a wrapper that creates a fresh terminal and runs configured resume commands.

- It cannot resurrect a dead PTY.
- It can reduce tool calls by combining create, initialization, and resume command execution.
- Acceptance: given a Claude Code CLI session id, create a new terminal, run init, run `claude --resume <session-id>`, and wait for ready pattern.

## Non-Functional Requirements

| Area | Requirement |
| --- | --- |
| Compatibility | Existing MCP tool inputs and outputs must remain backward compatible. |
| Performance | Status query should complete under 500 ms; pattern waiting should avoid busy loops. |
| Reliability | Timeout paths must return snapshots, not hang. |
| Security | Do not log or persist secrets. Initialization commands may contain secrets, so responses should avoid echoing full env values. |
| Stdio purity | MCP stdout must remain JSON-RPC only; logs go to stderr. |
| Cross-platform | Windows PowerShell, cmd, pwsh, macOS/Linux shells must remain supported. |
| Maintainability | TUI-specific heuristics must be isolated from generic terminal logic. |
| Observability | New operations should return structured metadata useful for debugging: elapsed time, matched pattern, timeout, cursor, status. |
| Surface parity | MCP, REST API, and Web UI must all expose or display the implemented iteration-1 capabilities, with real-driver acceptance cases for each surface. |

## Feasibility Assessment

| Proposal | Feasible? | Decision |
| --- | --- | --- |
| Exact completion detection using only `stableTime` | No | Reject as insufficient. |
| Exact Claude/Codex internal state from PTY text only | No | Reject exact claim; allow heuristic. |
| Status file contract | Yes, if wrapper/CLI cooperates | Recommend as robust path. |
| Output pattern detection | Yes | Implement as generic wait primitive. |
| `content_only` filtering | Yes, best-effort | Implement with fixture-based guarantees only. |
| One-click resume | Partially | Implement as create-and-run-resume wrapper, not PTY resurrection. |

## Acceptance Criteria

### AC-001: Initialization

Given a shell and two initialization commands, when a terminal is created with a matching ready pattern, then the response includes `terminalId`, `init.status="ready"`, elapsed time, and a bounded output preview.

### AC-002: Initialization timeout

Given a ready pattern that never appears, when creation reaches `readyTimeoutMs`, then the response returns `ready=false`, `timedOut=true`, and the terminal remains inspectable or is closed according to the configured cleanup policy.

### AC-003: Result waiting

Given terminal output containing a valid `<task_result>` XML block with `<status>PASS</status>`, when `wait_for_result` is called, then the response includes `matched=true`, parsed XML result fields, and terminal status.

### AC-004: Crash detection

Given a terminal process exits with non-zero code, when status or pattern wait observes the exit, then the response includes `processStatus="terminated"` and exit code/signal when available.

### AC-005: Output filtering

Given recorded noisy TUI fixture output, when `content_only` filtering is applied, then fixture-labeled critical lines remain and output size is reduced by the accepted threshold.

### AC-006: Backward compatibility

Given existing calls using `read_terminal` with `full/head/tail/head-tail`, when tests run, then all current unit and integration tests continue to pass.

## Resolved Questions and Decisions

### Q-001: Should iteration 1 expose new features through REST/Web UI or MCP only?

Why it matters: REST/Web UI share `TerminalManager`, but exposing every feature in every interface increases testing scope.

Decision: implement everything in this iteration across MCP, REST API, and Web UI. Each implemented part must have a real-driver acceptance scenario, not only unit tests.

Impact: the development plan must treat REST and Web UI parity as required scope, and the test plan must include interface-level acceptance for MCP, REST, and Web UI.

### Q-002: What child-agent status source is acceptable?

Why it matters: exact state needs cooperative data.

Detailed explanation:

- A PTY stream only exposes bytes rendered by the terminal. It does not expose the child agent's internal state machine.
- `wait_for_output` can detect "no new bytes for N milliseconds", but that does not distinguish thinking, waiting for input, completed, or crashed states.
- ANSI/TUI output can show visual hints such as spinners, prompts, or checkmarks. These are useful but unstable because UI versions, themes, localization, terminal width, and redraw behavior can change them.
- A cooperative status source means the child-agent wrapper writes a machine-readable status file while the process runs. The terminal server reads that file and marks status confidence as `cooperative`.
- Heuristic fallback means the terminal server still inspects process state, prompt heuristics, recent output, result XML blocks, and exit code. This must be labeled as `heuristic`, not exact truth.
- Priority order should be: process exit information and explicit XML result block, then cooperative status file, then prompt/output heuristics. The response must always expose `semanticStatusConfidence`.

Decision: confirmed. Use optional cooperative JSON status file first, explicit XML `<task_result>` evidence second, and PTY-output heuristics last. If no cooperative source or explicit result exists, never present semantic status as exact.

### Q-003: Should failed initialization leave the terminal alive?

Why it matters: alive terminals help debugging but may leak processes.

Decision: use the default proposal. Failed or timed-out initialization leaves the terminal alive and returns `init.status="timeout"` or `"failed"` with bounded snapshot; caller decides cleanup.

### Q-005: What exact result marker convention should be documented?

Why it matters: `wait_for_result` needs stable patterns.

Decision: use XML result blocks.

Default XML contract:

```xml
<task_result>
  <status>PASS</status>
  <summary>Short human-readable result summary.</summary>
  <files>
    <file>relative/or/absolute/path.ext</file>
  </files>
  <tests>2 passed, 0 failed</tests>
  <duration_ms>1234</duration_ms>
  <errors>
    <error>Optional error detail.</error>
  </errors>
  <warnings>
    <warning>Optional warning detail.</warning>
  </warnings>
  <notes>Optional follow-up notes.</notes>
</task_result>
```

Parsing rule: `wait_for_result` should locate a bounded `<task_result>...</task_result>` block, parse it with an XML parser, validate allowed status values (`PASS`, `FAIL`, `ERROR`), allow multiple `<file>`, `<error>`, and `<warning>` elements, and return both parsed fields and a bounded terminal snapshot.

Security rule: XML external entity expansion and network/entity resolution must be disabled if the selected parser supports such features.

## Assumptions

| Confidence | Assumption |
| --- | --- |
| High | Existing tool names and parameters must remain compatible. |
| High | MCP stdio purity remains mandatory. |
| High | Pattern waiting and initialization wrappers can be implemented without upstream CLI changes. |
| High | REST API and Web UI must be included in the same iteration, not deferred. |
| High | Status file support is confirmed as optional JSON cooperative status input. |
| Low | `last_response` can be reliable across all Claude/Codex versions. |

## Decision Log

| ID | Decision | Status |
| --- | --- | --- |
| D-001 | Treat exact semantic status from PTY text alone as infeasible. | Proposed |
| D-002 | Prioritize `initCommands` and `wait_for_pattern` before TUI-specific filtering. | Proposed |
| D-003 | Keep TUI-specific parsing isolated from generic terminal core. | Proposed |
| D-004 | Implement MCP, REST API, and Web UI surfaces in the same iteration. | Confirmed |
| D-005 | Failed initialization leaves the terminal alive with bounded diagnostic snapshot. | Confirmed |
| D-006 | Use XML `<task_result>` blocks for structured child-agent result reporting. | Confirmed |
| D-007 | `content_only` must prioritize decision correctness over compression ratio. | Confirmed |
| D-008 | Real-driver acceptance must test both real Claude Code CLI and mock child-agent fallback. | Confirmed |
| D-009 | Resume wrapper should include Claude Code CLI `claude --resume <session-id>` convention. | Confirmed |
