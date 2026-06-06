# Real Driver Acceptance Plan for Child-Agent Workflows

Document ID: PT-ITER1-REAL-ACCEPT-001
Date: 2026-06-06
Status: Updated after stakeholder answers

## Planning TODO

- [x] Translate user feedback into realistic end-to-end scenarios.
- [x] Avoid requiring sensitive credentials in tracked artifacts.
- [x] Define observable pass/fail criteria.
- [x] Include fallback when Claude/Codex CLI is unavailable.
- [x] Link this document from `doc/README-Index.md`.

## Purpose

This plan validates the improved persistent-terminal workflow using real CLI-driven child-agent sessions, not only unit tests. It focuses on reducing manual tool calls, detecting task results, handling timeouts, and producing useful status snapshots.

## Safety Rules

- Do not commit API keys, tokens, private proxy scripts, or personal session ids.
- If a local proxy/init script is needed, reference it through an environment variable or local ignored file.
- Use disposable test repositories and synthetic tasks.
- Record results as summaries, not raw transcripts containing sensitive content.

## Environment Requirements

- Node.js >= 18.
- Project dependencies installed.
- Built server through `npm run build`.
- One supported shell:
  - Windows: PowerShell, cmd, or pwsh.
  - macOS/Linux: bash or zsh.
- Required real-driver targets:
  - Real Claude Code CLI where available.
  - Deterministic mock child-agent for repeatable CI/local validation.

## Mock Child-Agent Fallback

If real CLI access is unavailable, create a temporary untracked script during testing that simulates:

- delayed thinking output,
- permission prompt,
- noisy spinner/progress output,
- final structured XML result block,
- crash exit.

The mock script must live outside tracked docs or under a gitignored temp path.

## Scenario RD-001: Create Ready Child-Agent Terminal

Goal: prove init and ready-pattern flow reduces startup calls.

Steps:

1. Call `create_terminal` with:
   - project cwd,
   - init command that prints a known ready marker,
   - `readyPattern="READY_FOR_TASK"`,
   - `readyTimeoutMs=30000`.
2. Assert response includes `init.status="ready"`.
3. Query `get_terminal_status`.

Pass criteria:

- Startup completes in one create call.
- Status query completes under 500 ms.
- No raw secrets appear in response.

## Scenario RD-002: Structured Result Detection

Goal: prove the primary agent can stop waiting when an XML result block appears.

Child task instruction should require final marker:

```text
At task completion, print:
<task_result>
  <status>PASS</status>
  <summary>Short result summary.</summary>
  <files>
    <file>path/to/file.ext</file>
  </files>
  <tests>2 passed, 0 failed</tests>
  <duration_ms>1234</duration_ms>
  <warnings>
    <warning>Optional warning detail.</warning>
  </warnings>
</task_result>
```

Steps:

1. Send a small task to the real Claude Code CLI and to the mock script.
2. Call `wait_for_result` with timeout 5 minutes.
3. Read final `content_only` output.

Pass criteria:

- `wait_for_result` returns PASS/FAIL/ERROR without manual transcript parsing.
- Matched result includes test summary, optional duration, files, warnings, and errors when present.
- Tool-call count is lower than the baseline workflow.

## Scenario RD-003: Thinking vs Waiting vs Completed

Goal: validate status limitations and cooperative status behavior.

Steps:

1. Run child agent/mock in three modes:
   - long-running thinking/no output,
   - waiting for user input,
   - completed with XML result block.
2. Query `get_terminal_status` during each mode.
3. If using cooperative status file, validate confidence is `cooperative`.
4. If using heuristics only, validate confidence is `heuristic` and uncertain states are not presented as exact truth.

Pass criteria:

- Status source and confidence are explicit.
- The system does not claim exact semantic state when it only has heuristics.
- Completed state is reliably detected through XML result block or cooperative status.

## Scenario RD-004: Timeout Snapshot

Goal: prove the system returns useful evidence when result never appears.

Steps:

1. Start a child task that prints progress but never prints result marker.
2. Call `wait_for_result` with short timeout.
3. Inspect returned snapshot and status.

Pass criteria:

- Tool returns timeout, not hang.
- Snapshot contains recent output.
- Terminal remains available for follow-up read or kill.

## Scenario RD-005: Crash Detection

Goal: prove process exit is distinguishable from output stability.

Steps:

1. Run mock child-agent that exits with non-zero code.
2. Call `wait_for_pattern` for a pattern that will not appear.
3. Query status.

Pass criteria:

- Result reports process termination.
- Exit code is included when available.
- The outcome is not mislabeled as successful completion.

## Scenario RD-006: Content-Only Filtering

Goal: verify token savings against real noisy TUI output.

Steps:

1. Run real or mock child-agent producing spinner/progress/diff-like output.
2. Read with `raw=true, cleanAnsi=true`.
3. Read with `mode="content_only"`.
4. Compare character counts and inspect critical lines.

Pass criteria:

- XML result block, error lines, file paths, test summaries, warnings, and ambiguity cues remain present.
- If preserving decision correctness requires retaining more content, lower compression is acceptable.
- Filter metadata reports confidence and removed line count.

## Scenario RD-007: Resume Wrapper

Goal: validate one-call recovery wrapper without claiming PTY resurrection.

Steps:

1. Start child-agent/mock and record a synthetic session id.
2. Kill the terminal.
3. Call resume wrapper with init commands and Claude Code `sessionId`.
4. Wait for ready pattern.

Pass criteria:

- New terminal is created.
- Init commands run and resume command follows `claude --resume <session-id>` unless explicitly overridden.
- Ready pattern appears.
- Documentation clearly states this is a new PTY plus resume command, not recovery of the dead PTY.

## Scenario RD-008: REST API Full Surface Acceptance

Goal: prove REST API exposes the same implemented capabilities.

Steps:

1. Start the REST server from the built package.
2. `POST /terminals` with init commands and ready pattern.
3. `GET /terminals/:id/status`.
4. Send output containing `<task_result>...</task_result>`.
5. `POST /terminals/:id/wait-result`.
6. `GET /terminals/:id/output?mode=content_only`.

Pass criteria:

- All REST calls return expected structured JSON.
- XML result is parsed into status, files, tests, and summary.
- Status query completes under 500 ms in the test environment.
- Timeout/error cases return bounded snapshots.

## Scenario RD-009: Web UI Full Surface Acceptance

Goal: prove browser users can operate the new workflow.

Steps:

1. Start Web UI from the built package.
2. Use a browser driver to create a terminal with init fields.
3. Open terminal detail page.
4. Verify structured status display.
5. Trigger wait-result flow against a terminal that prints XML result.
6. Switch output view to `content_only`.

Pass criteria:

- UI shows ready/timeout state from initialization.
- UI shows parsed XML result status.
- UI shows structured status and filtered output metadata.
- Browser test captures evidence screenshots or DOM assertions without storing secrets.

## Metrics to Record

| Metric | Baseline | Target |
| --- | --- | --- |
| Startup tool calls | 4-5 | 1 |
| Result detection calls | repeated read/wait loop | 1 wait call |
| Timeout behavior | manual inspection | structured timeout snapshot |
| Noisy output size | raw+cleanAnsi chars | report reduction, but pass/fail is based on preserved decision-critical evidence |
| Status query latency | not available | under 500 ms |
| REST parity | not available | all REST scenarios pass |
| Web UI parity | not available | all browser-driven scenarios pass |

## Result Report Template

Save real-driver results under `doc/第一次迭代/test/` with a date suffix:

```markdown
# Real Driver Acceptance Run - YYYY-MM-DD

## Environment

- OS:
- Shell:
- Child agent:
- persistent-terminal-mcp version:

## Scenario Results

| Scenario | Result | Evidence Summary |
| --- | --- | --- |
| RD-001 | PASS/FAIL | ... |

## Issues Found

- ...

## Sensitive Data Review

- [ ] No secrets copied into this report.
- [ ] Local-only paths are acceptable or redacted.
```
