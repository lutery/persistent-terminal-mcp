# Persistent Terminal Improvement Test Acceptance Plan

Document ID: PT-ITER1-TEST-001
Date: 2026-06-06
Status: Updated after stakeholder answers

## Planning TODO

- [x] Identify affected modules and APIs.
- [x] Define unit, integration, compatibility, and safety tests.
- [x] Define measurable acceptance criteria.
- [x] Include commands and expected outcomes.
- [x] Link this document from `doc/README-Index.md`.

## Test Scope

| Area | In Scope |
| --- | --- |
| Core terminal manager | Init commands, ready wait, pattern wait, status snapshot, status file, resume wrapper. |
| MCP tools | New schemas, structuredContent, timeout behavior, stdio purity. |
| REST API | Required parity endpoints for init, status, pattern wait, XML result wait, and filtered output. |
| Web UI | Required browser-visible status, filtered output, wait-pattern, and XML result workflows. |
| Output filtering | Fixture-driven `content_only` and `last_response` behavior. |
| Backward compatibility | Existing tools and tests keep passing. |
| Security | No secrets in tracked files; bounded output snapshots. |
| Cross-platform | Windows PowerShell/cmd and Unix-like shells where available. |

## Out of Scope for Iteration 1

- Guaranteeing exact Claude/Codex internal state from PTY text only.
- Persisting full terminal transcripts to git-tracked files.

## Unit Test Matrix

| Test ID | Target | Scenario | Expected |
| --- | --- | --- | --- |
| UT-001 | `TerminalManager.waitForPattern` | Pattern appears after command output | `matched=true`, groups captured. |
| UT-002 | `TerminalManager.waitForPattern` | Pattern never appears | `timedOut=true`, snapshot returned. |
| UT-003 | `TerminalManager.waitForPattern` | Invalid regex | typed validation error. |
| UT-004 | Create with init | Commands execute in order | ready pattern matched. |
| UT-005 | Create with init | Ready timeout | terminal id returned with timeout status. |
| UT-006 | Status snapshot | Active terminal | process status active, prompt info present when detected. |
| UT-007 | Status snapshot | Terminated terminal | exit code/signal captured where available. |
| UT-008 | Status file | Valid JSON | cooperative semantic status returned. |
| UT-009 | Status file | Missing/invalid file | non-fatal unavailable/invalid metadata. |
| UT-010 | Output filter | Noisy fixture | critical lines retained, decoration reduced. |
| UT-011 | Last response | Known fixture | final response extracted. |
| UT-012 | Last response | Unknown fixture | fallback snapshot returned. |
| UT-013 | XML result parser | Valid PASS/FAIL/ERROR XML | parsed typed result returned. |
| UT-014 | XML result parser | Malformed XML or missing status | typed parse/validation error returned. |
| UT-015 | XML result parser | Entity/DTD-like malicious XML fixture | unsafe entity behavior is disabled or rejected. |
| UT-016 | XML result parser | `duration_ms`, multiple `file`, multiple `error`, multiple `warning` | all optional fields parsed correctly. |
| UT-017 | Output filter | Decision-critical lines mixed with noise | all decision-critical evidence is preserved. |

## MCP Integration Test Matrix

| Test ID | Script | Scenario |
| --- | --- | --- |
| IT-001 | `tests/integration/test-create-terminal-init.mjs` | Create terminal with init and ready pattern. |
| IT-002 | `tests/integration/test-wait-for-pattern.mjs` | Wait for `<task_result>...</task_result>`. |
| IT-003 | `tests/integration/test-wait-for-result.mjs` | Parse XML PASS/FAIL/ERROR result block. |
| IT-004 | `tests/integration/test-terminal-status.mjs` | Query active and terminated statuses. |
| IT-005 | Existing `test-mcp-stdio.mjs` | stdout remains JSON-RPC only. |
| IT-006 | Existing `test-read-terminal-raw-tail.mjs` | raw tail/head-tail compatibility remains. |
| IT-007 | Existing `test-read-terminal-context-guard.mjs` | maxChars guard remains. |

## REST API Integration Test Matrix

| Test ID | Script | Scenario |
| --- | --- | --- |
| REST-001 | `tests/integration/test-rest-terminal-improvements.mjs` | `POST /terminals` with init and ready pattern. |
| REST-002 | same script | `GET /terminals/:id/status` returns structured status under 500 ms. |
| REST-003 | same script | `POST /terminals/:id/wait-pattern` matches XML block. |
| REST-004 | same script | `POST /terminals/:id/wait-result` parses XML result. |
| REST-005 | same script | `GET /terminals/:id/output?mode=content_only` returns filter metadata. |

## Web UI Acceptance Test Matrix

| Test ID | Driver | Scenario |
| --- | --- | --- |
| WEB-001 | Playwright or equivalent browser driver | Create terminal with init fields and observe ready state. |
| WEB-002 | Browser driver | Terminal detail page displays structured status. |
| WEB-003 | Browser driver | Filtered output view shows reduced content and metadata. |
| WEB-004 | Browser driver | Wait-result action parses XML result and displays PASS/FAIL/ERROR. |

## Commands

Run after implementation:

```powershell
npm run build
npm test
npm run test:integration
node tests/integration/test-create-terminal-init.mjs
node tests/integration/test-wait-for-pattern.mjs
node tests/integration/test-wait-for-result.mjs
node tests/integration/test-terminal-status.mjs
node tests/integration/test-rest-terminal-improvements.mjs
node tests/integration/test-web-ui-terminal-improvements.mjs
```

Expected:

- All commands exit with code 0.
- No JSON-RPC stdout pollution in MCP stdio tests.
- New timeout tests finish within configured timeout plus a small test margin.

## Acceptance Gates

### Gate A: Backward Compatibility

- Existing public tool parameters continue to work.
- Existing tests pass without requiring clients to change calls.
- `create_terminal_basic` remains usable with only `shell` and `cwd`.

### Gate B: Reliability

- `wait_for_pattern` and `wait_for_result` always return match, timeout, process exit, or validation error.
- `wait_for_result` parses XML result blocks through an XML parser and rejects malformed or unsafe XML.
- No wait operation can hang indefinitely.
- Timeout responses include bounded snapshots.

### Gate C: Status Quality

- Process/session status is deterministic.
- Semantic status is labeled with confidence and source.
- Cooperative status file beats heuristics when available.

### Gate D: Filtering Quality

- Fixture critical lines are retained at 100 percent for the approved fixture suite.
- Correct primary-agent judgment is the release gate; compression percentage is only an observed metric.
- Low-confidence extraction falls back instead of inventing a response.
- When unsure, `content_only` must retain more context and lower confidence.

### Gate E: Surface Parity

- MCP, REST API, and Web UI all expose the implemented iteration-1 capabilities.
- Each surface has a real-driver or integration acceptance test.
- REST/Web UI behavior is not considered optional for release.

### Gate F: Security and Hygiene

- No secrets are committed in test fixtures or docs.
- Test fixtures use synthetic paths, fake tokens, or redacted values.
- Logs in MCP mode remain on stderr only.
- XML parser rejects or disables unsafe external entity behavior.

## Negative Tests

- Invalid terminal id.
- Inactive terminal.
- Invalid regex.
- Ready pattern timeout.
- Pattern wait timeout.
- Process exits before match.
- Malformed XML result.
- XML result missing required `status`.
- XML result with invalid `duration_ms`.
- Missing status file.
- Status file with invalid JSON.
- Huge output with `maxChars`.
- TUI output that contains prompt-like symbols inside normal text.

## Manual QA Checklist

- Create a terminal in PowerShell and verify init command execution.
- Create a terminal in cmd and verify ready pattern.
- On Unix-like shell if available, verify `/bin/bash` flow.
- Verify `read_terminal` old modes still behave as documented.
- Verify new status output is readable and structured.
- Verify docs do not include local secrets or credentials.
