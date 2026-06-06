/**
 * 终端会话相关的类型定义
 */
export interface TerminalSession {
    id: string;
    pid: number;
    shell: string;
    cwd: string;
    env: Record<string, string>;
    created: Date;
    lastActivity: Date;
    status: 'active' | 'inactive' | 'terminated';
    pendingCommand?: CommandRuntimeInfo | null;
    lastCommand?: CommandRuntimeInfo | null;
    lastPromptLine?: string | null;
    lastPromptAt?: Date | null;
    hasPrompt?: boolean;
    exitCode?: number | null;
    exitSignal?: string | null;
    statusFile?: string | null;
}
export interface CommandRuntimeInfo {
    command: string;
    startedAt: Date;
    completedAt?: Date | null;
}
export interface TerminalCreateOptions {
    shell?: string | undefined;
    cwd?: string | undefined;
    env?: Record<string, string> | undefined;
    cols?: number | undefined;
    rows?: number | undefined;
    initCommands?: string[] | undefined;
    readyPattern?: string | undefined;
    readyTimeoutMs?: number | undefined;
    initFailurePattern?: string | undefined;
    statusFile?: string | undefined;
}
export interface TerminalWriteOptions {
    terminalId: string;
    input: string;
    appendNewline?: boolean;
    sendEnter?: boolean;
}
export interface TerminalReadOptions {
    terminalId: string;
    since?: number | undefined;
    maxLines?: number | undefined;
    mode?: 'full' | 'head-tail' | 'head' | 'tail' | 'content_only' | 'last_response' | 'status' | undefined;
    headLines?: number | undefined;
    tailLines?: number | undefined;
    stripSpinner?: boolean | undefined;
    raw?: boolean | undefined;
    adapter?: 'generic' | 'claude' | 'codex' | undefined;
}
export interface TerminalReadResult {
    output: string;
    totalLines: number;
    hasMore: boolean;
    since: number;
    cursor?: number;
    truncated?: boolean;
    stats?: {
        totalBytes: number;
        estimatedTokens: number;
        linesShown: number;
        linesOmitted: number;
    };
    status?: TerminalReadStatus;
    filter?: OutputFilterMetadata;
}
export interface TerminalRawReadOptions {
    terminalId: string;
    since?: number | undefined;
    maxChunks?: number | undefined;
    maxBytes?: number | undefined;
}
export interface TerminalRawReadResult {
    output: string;
    hasMore: boolean;
    cursor: number;
    chunkCount: number;
    truncated: boolean;
}
export interface TerminalReadStatus {
    isRunning: boolean;
    hasPrompt: boolean;
    pendingCommand: CommandSummary | null;
    lastCommand: CommandSummary | null;
    promptLine: string | null;
    lastActivity: string;
}
export interface CommandSummary {
    command: string;
    startedAt: string;
    completedAt?: string | null;
}
export interface TerminalListResult {
    terminals: Array<{
        id: string;
        pid: number;
        shell: string;
        cwd: string;
        created: string;
        lastActivity: string;
        status: string;
    }>;
}
export interface OutputBufferEntry {
    timestamp: Date;
    content: string;
    lineNumber: number;
    sequence: number;
}
export interface BufferReadOptions {
    since?: number | undefined;
    maxLines?: number | undefined;
}
export interface BufferReadResult {
    entries: OutputBufferEntry[];
    totalLines: number;
    hasMore: boolean;
    nextCursor: number;
}
export interface TerminalManagerConfig {
    maxBufferSize?: number;
    sessionTimeout?: number;
    defaultShell?: string;
    defaultCols?: number;
    defaultRows?: number;
    compactAnimations?: boolean;
    animationThrottleMs?: number;
}
export interface TerminalError extends Error {
    code: string;
    terminalId?: string;
}
export interface CreateTerminalInput {
    shell?: string | undefined;
    cwd?: string | undefined;
    env?: Record<string, string> | undefined;
    initCommands?: string[] | undefined;
    readyPattern?: string | undefined;
    readyTimeoutMs?: number | undefined;
    initFailurePattern?: string | undefined;
    statusFile?: string | undefined;
}
export interface CreateTerminalResult {
    terminalId: string;
    status: string;
    pid: number;
    shell: string;
    cwd: string;
}
export interface WriteTerminalInput {
    terminalId: string;
    input: string;
    appendNewline?: boolean;
    sendEnter?: boolean;
}
export interface WriteTerminalResult {
    success: boolean;
    message?: string;
}
export interface ReadTerminalInput {
    terminalId: string;
    since?: number;
    maxLines?: number;
    mode?: 'full' | 'head-tail' | 'head' | 'tail' | 'content_only' | 'last_response' | 'status';
    headLines?: number;
    tailLines?: number;
    stripSpinner?: boolean;
    raw?: boolean;
    cleanAnsi?: boolean;
    maxChars?: number;
}
export interface TerminalStatsInput {
    terminalId: string;
}
export interface TerminalStatsResult {
    terminalId: string;
    totalLines: number;
    totalBytes: number;
    estimatedTokens: number;
    bufferSize: number;
    oldestLine: number;
    newestLine: number;
    isActive: boolean;
}
export interface ListTerminalsResult {
    terminals: Array<{
        id: string;
        pid: number;
        shell: string;
        cwd: string;
        created: string;
        lastActivity: string;
        status: string;
    }>;
}
export interface KillTerminalInput {
    terminalId: string;
    signal?: string;
}
export interface KillTerminalResult {
    success: boolean;
    message?: string;
}
export interface WebUIStartOptions {
    port?: number;
    autoOpen?: boolean;
    terminalManager: any;
}
export interface WebUIStartResult {
    url: string;
    port: number;
    mode: 'new' | 'existing';
    autoOpened: boolean;
}
export interface FixBugWithCodexInput {
    description: string;
    cwd?: string;
    timeout?: number;
}
export interface FixBugWithCodexResult {
    terminalId: string;
    reportPath: string | null;
    reportExists: boolean;
    workingDir: string;
    executionTime: number;
    timedOut: boolean;
    output: string;
    reportPreview: string | null;
}
export interface InitOptions {
    initCommands?: string[];
    readyPattern?: string;
    readyTimeoutMs?: number;
    initFailurePattern?: string;
}
export interface InitResult {
    status: 'not_requested' | 'ready' | 'timeout' | 'failed';
    matched?: string | undefined;
    timedOut?: boolean | undefined;
    elapsedMs: number;
    outputPreview: string;
}
export interface PatternWaitOptions {
    terminalId: string;
    pattern: string;
    timeoutMs?: number;
    pollIntervalMs?: number;
    source?: 'parsed' | 'raw' | 'cleanRaw';
    since?: number;
    snapshotLines?: number;
    maxChars?: number;
}
export interface PatternWaitResult {
    matched: boolean;
    match?: {
        text: string;
        groups?: string[] | undefined;
        namedGroups?: Record<string, string> | undefined;
    };
    timedOut: boolean;
    elapsedMs: number;
    cursor?: number;
    status?: TerminalStatusResult;
    snapshot?: string;
}
export interface TerminalStatusResult {
    terminalId: string;
    processStatus: 'active' | 'terminated' | 'missing';
    semanticStatus: 'unknown' | 'running' | 'waiting_input' | 'completed' | 'error';
    semanticStatusConfidence: 'none' | 'heuristic' | 'cooperative';
    lastActivity: string;
    pendingCommand: CommandSummary | null;
    lastCommand: CommandSummary | null;
    promptVisible: boolean;
    exit?: {
        code: number | null;
        signal: string | null;
    } | null;
    statusFile?: {
        available: boolean;
        path?: string;
        parsed?: boolean;
        data?: StatusFileData;
    } | null;
    cursors?: {
        parsed: number;
        raw: number;
    };
    outputPreview?: string | undefined;
}
export interface TerminalStatusOptions {
    includeOutputPreview?: boolean | undefined;
    statusFile?: string | undefined;
}
export interface StatusFileData {
    status: string;
    last_activity: string;
    tool_calls?: number;
    files_modified?: string[];
}
export interface OutputFilterMetadata {
    mode: 'content_only' | 'last_response';
    adapter: 'generic' | 'claude' | 'codex';
    confidence: 'low' | 'medium' | 'high';
    removedLines: number;
    criticalLineCount: number;
}
export interface ResumeTerminalOptions {
    sessionId: string;
    cwd?: string | undefined;
    shell?: string | undefined;
    initCommands?: string[] | undefined;
    readyPattern?: string | undefined;
    readyTimeoutMs?: number | undefined;
    resumeFromTerminalId?: string | undefined;
}
export interface ParsedTaskResult {
    status: 'PASS' | 'FAIL' | 'ERROR';
    summary?: string;
    files?: string[];
    tests?: string;
    durationMs?: number;
    errors?: string[];
    warnings?: string[];
    notes?: string;
}
export interface ParseError {
    type: 'xml_parse' | 'schema_validation' | 'security';
    message: string;
}
export interface ResultParseOutput {
    parsed: ParsedTaskResult | null;
    rawXml: string;
    errors: ParseError[];
}
//# sourceMappingURL=types.d.ts.map