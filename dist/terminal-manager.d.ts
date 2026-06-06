import { EventEmitter } from 'events';
import { TerminalSession, TerminalCreateOptions, TerminalWriteOptions, TerminalReadOptions, TerminalReadResult, TerminalListResult, TerminalManagerConfig, TerminalStatsResult, TerminalRawReadOptions, TerminalRawReadResult, TerminalStatusResult, TerminalStatusOptions, PatternWaitOptions, PatternWaitResult, InitResult, ResumeTerminalOptions } from './types.js';
/**
 * 终端会话管理器
 * 负责创建、管理和维护持久化的终端会话
 */
export declare class TerminalManager extends EventEmitter {
    private sessions;
    private ptyProcesses;
    private outputBuffers;
    private exitPromises;
    private exitResolvers;
    private terminalQueryRemainders;
    private rawOutputBuffers;
    private rawSequenceCounters;
    private rawBufferMaxChunks;
    private rawBufferMaxBytes;
    private config;
    private cleanupTimer;
    constructor(config?: TerminalManagerConfig);
    /**
     * 创建新的终端会话
     */
    createTerminal(options?: TerminalCreateOptions): Promise<string>;
    /**
     * 向终端写入数据
     */
    writeToTerminal(options: TerminalWriteOptions): Promise<void>;
    private normalizeNewlines;
    private shouldAutoAppendNewline;
    /**
     * 从终端读取输出
     */
    readFromTerminal(options: TerminalReadOptions): Promise<TerminalReadResult>;
    readRawFromTerminal(options: TerminalRawReadOptions): TerminalRawReadResult;
    /**
     * 获取终端统计信息
     */
    getTerminalStats(terminalId: string): Promise<TerminalStatsResult>;
    /**
     * 获取终端结构化状态快照
     */
    getTerminalStatus(terminalId: string, options?: TerminalStatusOptions): Promise<TerminalStatusResult>;
    /**
     * 检查终端是否正在运行命令
     * 通过检查最后一次活动时间来判断
     */
    isTerminalBusy(terminalId: string): boolean;
    /**
     * 等待终端输出稳定
     * 用于确保命令执行完成后再读取输出
     */
    waitForOutputStable(terminalId: string, timeout?: number, stableTime?: number): Promise<void>;
    /**
     * Wait for a regex pattern to appear in terminal output
     */
    waitForPattern(options: PatternWaitOptions): Promise<PatternWaitResult>;
    /**
     * Build a bounded tail snapshot from terminal output
     */
    private buildSnapshot;
    /**
     * Strip ANSI escape sequences from raw terminal output
     */
    private stripAnsiSequences;
    /**
     * Skip an ANSI escape sequence starting at the given index, return the index of the last char
     */
    private skipAnsiInString;
    /**
     * Create a terminal with initialization commands and ready-pattern waiting
     */
    createTerminalWithInit(options: TerminalCreateOptions): Promise<{
        terminalId: string;
        init: InitResult;
    }>;
    /**
     * Resume a CLI agent session in a new terminal (D-009: new PTY + resume command)
     */
    resumeTerminal(options: ResumeTerminalOptions): Promise<{
        terminalId: string;
        init: InitResult;
    }>;
    /**
     * 列出所有终端会话
     */
    listTerminals(): Promise<TerminalListResult>;
    /**
     * 终止终端会话
     */
    killTerminal(terminalId: string, signal?: string): Promise<void>;
    /**
     * 获取终端会话信息
     */
    getTerminalInfo(terminalId: string): TerminalSession | undefined;
    /**
     * 检查终端是否存在且活跃
     */
    isTerminalActive(terminalId: string): boolean;
    /**
     * 调整终端大小
     */
    resizeTerminal(terminalId: string, cols: number, rows: number): Promise<void>;
    /**
     * 清理指定会话
     */
    private cleanupSession;
    private waitForPtyExit;
    /**
     * 清理超时的会话
     */
    private cleanupTimeoutSessions;
    /**
     * 获取管理器统计信息
     */
    getStats(): {
        activeSessions: number;
        totalSessions: number;
        totalBufferSize: number;
        config: Required<TerminalManagerConfig>;
    };
    /**
     * 关闭管理器，清理所有资源
     */
    shutdown(): Promise<void>;
    private processBufferEntries;
    private trackCommand;
    private extractCommandText;
    private isMostlyPrintable;
    private isPromptLine;
    private buildReadStatus;
    /**
     * 解析 shell 名称，处理 Windows 别名
     * 这个方法用于处理用户传入的 shell 参数
     */
    private resolveShellName;
    private resolveDefaultShell;
    private collectTerminalReplies;
    private getTerminalQueryDefinitions;
    private isPartialQuerySequence;
    private extractQueryRemainder;
    private appendRawOutputChunk;
}
//# sourceMappingURL=terminal-manager.d.ts.map