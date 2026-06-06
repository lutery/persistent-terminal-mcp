# Persistent Terminal Improvement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build reliable terminal initialization, pattern/result waiting, structured status, and best-effort TUI output filtering for persistent-terminal MCP.

**Architecture:** Implement core behavior in `TerminalManager` and shared types first, then expose the same iteration-1 capabilities through MCP tools, REST API, and Web UI. REST and Web UI parity are required scope, not deferred follow-up work.

**Tech Stack:** TypeScript, ES Modules, `node-pty`, MCP SDK, zod, XML parser dependency such as `fast-xml-parser`, Jest, Node integration tests.

---

## Planning TODO

- [x] Read requirement feedback and current implementation.
- [x] Split work into safe increments.
- [x] Include test-first tasks.
- [x] Include version/build requirements from `AGENTS.md`.
- [x] Link this plan from `doc/README-Index.md`.

## Milestones

| Milestone | Scope | Exit Criteria |
| --- | --- | --- |
| M1 | Core init and pattern waiting | Unit tests and MCP integration tests pass. |
| M2 | Structured status and status file | Status query works for active, timeout, and terminated sessions. |
| M3 | XML result wrapper and content filtering | XML result parser tests pass; fixture tests prove noise reduction and critical-line retention. |
| M4 | Required REST/Web UI parity and docs | HTTP/UI surfaces updated, real-driver acceptance cases defined and passing, README docs updated, full test suite passes. |

## Critical Path

1. Extend shared types.
2. Add core `TerminalManager` primitives.
3. Expose MCP tools and schemas.
4. Expose REST API endpoints and Web UI controls for the same features.
5. Add integration tests over stdio, HTTP, and browser/UI flows.
6. Add filtering and status adapters.
7. Update documentation, version, and build.

## Task 1: Shared Type Contracts

**Files:**
- Modify: `src/types.ts`
- Test: `src/__tests__/terminal-manager.test.ts`

**Steps:**

1. Add interfaces for terminal init options, init result, status snapshot, pattern wait options/result, and output filter metadata.
2. Extend `TerminalCreateOptions` with optional `initCommands`, `readyPattern`, `readyTimeoutMs`, `initFailurePattern`, and `statusFile`.
3. Extend read mode union with `content_only` and `last_response` only after filter implementation begins.
4. Run: `npm run build`.
5. Expected: TypeScript compile passes or fails only on missing implementation references introduced later.

## Task 2: Core Pattern Waiting

**Files:**
- Modify: `src/terminal-manager.ts`
- Test: `src/__tests__/terminal-manager.test.ts`
- Add: `tests/integration/test-wait-for-pattern.mjs`

**Steps:**

1. Write unit tests for matching a pattern from parsed output.
2. Write unit tests for timeout returning snapshot and cursor.
3. Write unit tests for invalid regex returning a typed error.
4. Implement `waitForPattern(options)` in `TerminalManager`.
5. Ensure polling uses a bounded interval, default 250 ms, with timeout.
6. Run: `npm test -- terminal-manager.test.ts`.
7. Run: `npm run build`.

## Task 3: MCP `wait_for_pattern`

**Files:**
- Modify: `src/mcp-server.ts`
- Add: `tests/integration/test-wait-for-pattern.mjs`

**Steps:**

1. Add zod schema for `wait_for_pattern`.
2. Return both readable text and `structuredContent`.
3. Integration test: create terminal, write a small `<task_result><status>PASS</status></task_result>` XML block, wait for the XML block pattern, assert match.
4. Integration test: wait for unmatched pattern with short timeout, assert `timedOut=true`.
5. Run: `npm run build`.
6. Run: `node tests/integration/test-wait-for-pattern.mjs`.

## Task 4: Create With Init and Ready Pattern

**Files:**
- Modify: `src/terminal-manager.ts`
- Modify: `src/mcp-server.ts`
- Test: `src/__tests__/terminal-manager.test.ts`
- Add: `tests/integration/test-create-terminal-init.mjs`

**Steps:**

1. Add failing tests for `initCommands` executing in order.
2. Add failing tests for `readyPattern` success.
3. Add failing tests for timeout snapshot.
4. Implement orchestration after PTY creation.
5. MCP response must include init metadata in `structuredContent`.
6. Preserve `create_terminal_basic` current behavior.
7. Run unit and integration tests.

## Task 5: Structured Status Snapshot

**Files:**
- Modify: `src/types.ts`
- Modify: `src/terminal-manager.ts`
- Modify: `src/mcp-server.ts`
- Test: `src/__tests__/terminal-manager.test.ts`
- Add: `tests/integration/test-terminal-status.mjs`

**Steps:**

1. Store process exit code/signal in `TerminalSession` or a related session metadata field.
2. Implement `getTerminalStatus(terminalId, options)`.
3. Add MCP tool `get_terminal_status`.
4. Test active status, pending command status, prompt heuristic status, and terminated status.
5. Verify response time with a normal session is under 500 ms in integration test.

## Task 6: Optional Status File Provider

**Files:**
- Add: `src/status-provider.ts`
- Modify: `src/terminal-manager.ts`
- Test: `src/__tests__/terminal-manager.test.ts`

**Steps:**

1. Define accepted JSON schema with zod.
2. Add explicit `statusFile` reading support.
3. Test missing file, invalid JSON, invalid schema, and valid cooperative status.
4. Ensure file read errors are non-fatal status metadata, not tool crashes.

## Task 7: `wait_for_result` Wrapper

**Files:**
- Add dependency if selected: `package.json`, `package-lock.json`
- Add: `src/result-parser.ts`
- Modify: `src/mcp-server.ts`
- Test: `src/__tests__/result-parser.test.ts`
- Test: `tests/integration/test-wait-for-result.mjs`

**Steps:**

1. Implement as wrapper over `wait_for_pattern`.
2. Default locator pattern: `<task_result>[\\s\\S]*?</task_result>`.
3. Parse matched XML with a real XML parser, not ad hoc line splitting.
4. Validate XML schema:
   - root: `task_result`
   - required: `status`
   - allowed status: `PASS`, `FAIL`, `ERROR`
   - optional: `summary`, `files.file[]`, `tests`, `duration_ms`, `errors.error[]`, `warnings.warning[]`, `notes`
5. Disable XML external entity expansion and network/entity resolution if supported by the selected parser.
6. Integration test PASS, FAIL, ERROR, malformed XML, missing status, timeout.

## Task 8: Content-Only Filtering

**Files:**
- Add: `src/output-filter.ts`
- Modify: `src/terminal-manager.ts`
- Modify: `src/mcp-server.ts`
- Add: `src/__tests__/output-filter.test.ts`
- Add: `tests/fixtures/tui-output/*.txt`

**Steps:**

1. Add fixtures for spinner noise, progress lines, diff boxes, tool summaries, file paths, errors, and test summaries.
2. Write tests that mark required critical lines.
3. Implement conservative filtering.
4. Add `read_terminal` mode `content_only`.
5. Ensure filter metadata is returned.
6. Do not claim lossless behavior; include confidence field.
7. Add tests proving filtered output does not remove evidence needed for success/failure/pending/crash/ambiguous decisions.
8. Do not use compression percentage as the primary release gate.

## Task 9: Last Response Extraction

**Files:**
- Modify: `src/output-filter.ts`
- Test: `src/__tests__/output-filter.test.ts`

**Steps:**

1. Implement adapter-based extraction for known transcript fixtures only.
2. Return fallback tail snapshot when confidence is low.
3. Add `read_terminal` mode `last_response`.
4. Test Claude/Codex-like fixtures and unknown format fallback.

## Task 10: Resume Workflow Wrapper

**Files:**
- Modify: `src/types.ts`
- Modify: `src/terminal-manager.ts`
- Modify: `src/mcp-server.ts`
- Add: `tests/integration/test-resume-terminal.mjs`

**Steps:**

1. Define explicit inputs: cwd, shell, initCommands, resumeCommand, readyPattern, timeout, and optional Claude Code `sessionId`.
2. Do not attempt to resurrect old PTY.
3. Implement built-in Claude Code convention: `claude --resume <session-id>`.
4. Optional `resumeFromTerminalId` may copy cwd/shell/statusFile only if still known.
5. Integration test with a harmless command or mock Claude executable; real-driver test uses actual Claude Code CLI where available.

## Task 11: REST and Web UI Parity

**Files:**
- Modify: `src/rest-api.ts`
- Modify: `src/web-ui-server.ts`
- Modify: `public/app.js`
- Modify: `public/terminal.js`
- Modify: `public/index.html`
- Modify: `public/terminal.html`
- Add: `tests/integration/test-rest-terminal-improvements.mjs`
- Add: `tests/integration/test-web-ui-terminal-improvements.mjs` or Playwright-based equivalent

**Steps:**

1. Add REST endpoints after core contracts compile:
   - `POST /terminals` accepts init options and returns init metadata.
   - `POST /terminals/:id/wait-pattern`
   - `POST /terminals/:id/wait-result`
   - `GET /terminals/:id/status`
   - `GET /terminals/:id/output?mode=content_only`
2. Add REST integration tests for each endpoint using a real server process.
3. Add Web UI status display, filtered output control, wait-for-pattern action, and wait-for-result action.
4. Add a browser-driven test that creates a terminal, waits for readiness, reads status, and validates XML result display.
5. Keep REST logs off MCP stdio path; verify server mode behavior separately.

## Task 12: Documentation, Version, and Release Checks

**Files:**
- Modify: `README.md`
- Modify: `README.en.md`
- Modify: `docs/guides/usage.md`
- Modify: `CHANGELOG.md`
- Modify: `package.json`
- Modify: `package-lock.json`

**Steps:**

1. Document new tools, examples, and safety limits.
2. Update package version according to semantic versioning. This feature set should be a MINOR bump unless only docs are changed.
3. Run: `npm run build`.
4. Run: `npm test`.
5. Run: `npm run test:integration`.
6. Run any new real-driver validation script manually and record results under `doc/第一次迭代/test`.

## Risks

| Risk | Mitigation |
| --- | --- |
| TUI visual format changes | Keep adapter best-effort and fixture-based. |
| Regex waits consume CPU | Poll at bounded interval; scan incrementally by cursor. |
| Init commands contain secrets | Redact env values and avoid persisted raw logs. |
| Breaking MCP clients | Keep existing schemas compatible and add optional tools. |
| Windows shell quoting | Add Windows-specific integration cases. |
| XML parser security | Disable unsafe entity behavior and test malicious XML fixtures. |
| Filter removes decision-critical output | Prefer retention over compression; use decision-oriented fixtures and real-driver checks. |
| Real Claude Code CLI availability varies | Require both real Claude Code CLI acceptance when available and deterministic mock child-agent acceptance. |

## Recommended Commit Sequence

1. `feat: add terminal pattern wait core`
2. `feat: expose wait_for_pattern mcp tool`
3. `feat: add terminal init readiness workflow`
4. `feat: add structured terminal status`
5. `feat: add xml result wait helper`
6. `feat: add tui content filtering`
7. `feat: expose terminal improvements in rest and web ui`
8. `docs: document terminal automation workflows`
