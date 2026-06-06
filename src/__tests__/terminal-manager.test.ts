import { TerminalManager } from '../terminal-manager.js';
import { OutputBuffer } from '../output-buffer.js';

describe('TerminalManager', () => {
  let terminalManager: TerminalManager;

  beforeEach(() => {
    terminalManager = new TerminalManager({
      maxBufferSize: 100,
      sessionTimeout: 5000 // 5 seconds for testing
    });
  });

  afterEach(async () => {
    await terminalManager.shutdown();
  });

  describe('Terminal Creation', () => {
    test('should create a new terminal session', async () => {
      const terminalId = await terminalManager.createTerminal();
      
      expect(terminalId).toBeDefined();
      expect(typeof terminalId).toBe('string');
      
      const session = terminalManager.getTerminalInfo(terminalId);
      expect(session).toBeDefined();
      expect(session?.status).toBe('active');
      expect(session?.pid).toBeGreaterThan(0);
    });

    test('should create terminal with custom options', async () => {
      const options = {
        cwd: process.cwd(),
        env: { TEST_VAR: 'test_value' }
      };

      const terminalId = await terminalManager.createTerminal(options);
      const session = terminalManager.getTerminalInfo(terminalId);
      
      expect(session?.cwd).toBe(options.cwd);
      expect(session?.env.TEST_VAR).toBe('test_value');
    });
  });

  describe('Terminal Operations', () => {
    let terminalId: string;

    beforeEach(async () => {
      terminalId = await terminalManager.createTerminal();
    });

    test('should write to terminal', async () => {
      await expect(
        terminalManager.writeToTerminal({
          terminalId,
          input: 'echo test\n'
        })
      ).resolves.not.toThrow();
    });

    test('should support raw input without auto newline', async () => {
      const fakeId = 'fake-terminal';
      const fakeWrite = jest.fn();
      const fakeSession = {
        id: fakeId,
        pid: 12345,
        shell: '/bin/bash',
        cwd: process.cwd(),
        env: {} as Record<string, string>,
        created: new Date(),
        lastActivity: new Date(),
        status: 'active' as const
      };

      (terminalManager as any).ptyProcesses.set(fakeId, { write: fakeWrite });
      (terminalManager as any).sessions.set(fakeId, fakeSession);

      await terminalManager.writeToTerminal({
        terminalId: fakeId,
        input: '',
        appendNewline: false
      });

      expect(fakeWrite).toHaveBeenCalledWith('');

      (terminalManager as any).ptyProcesses.delete(fakeId);
      (terminalManager as any).sessions.delete(fakeId);
    });

    test('should avoid auto newline for control characters by default', async () => {
      const fakeId = 'control-terminal';
      const fakeWrite = jest.fn();
      const fakeSession = {
        id: fakeId,
        pid: 12346,
        shell: '/bin/bash',
        cwd: process.cwd(),
        env: {} as Record<string, string>,
        created: new Date(),
        lastActivity: new Date(),
        status: 'active' as const
      };

      (terminalManager as any).ptyProcesses.set(fakeId, { write: fakeWrite });
      (terminalManager as any).sessions.set(fakeId, fakeSession);

      await terminalManager.writeToTerminal({
        terminalId: fakeId,
        input: ''
      });

      expect(fakeWrite).toHaveBeenCalledWith('');

      (terminalManager as any).ptyProcesses.delete(fakeId);
      (terminalManager as any).sessions.delete(fakeId);
    });

    test('should auto append newline for printable text by default', async () => {
      const fakeId = 'printable-terminal';
      const fakeWrite = jest.fn();
      const fakeSession = {
        id: fakeId,
        pid: 12347,
        shell: '/bin/bash',
        cwd: process.cwd(),
        env: {} as Record<string, string>,
        created: new Date(),
        lastActivity: new Date(),
        status: 'active' as const
      };

      (terminalManager as any).ptyProcesses.set(fakeId, { write: fakeWrite });
      (terminalManager as any).sessions.set(fakeId, fakeSession);

      await terminalManager.writeToTerminal({
        terminalId: fakeId,
        input: 'npm --version'
      });

      expect(fakeWrite).toHaveBeenCalledWith('npm --version\r');

      (terminalManager as any).ptyProcesses.delete(fakeId);
      (terminalManager as any).sessions.delete(fakeId);
    });

    test('should send carriage return when only newline requested', async () => {
      const fakeId = 'enter-terminal';
      const fakeWrite = jest.fn();
      const fakeSession = {
        id: fakeId,
        pid: 22347,
        shell: '/bin/bash',
        cwd: process.cwd(),
        env: {} as Record<string, string>,
        created: new Date(),
        lastActivity: new Date(),
        status: 'active' as const
      };

      (terminalManager as any).ptyProcesses.set(fakeId, { write: fakeWrite });
      (terminalManager as any).sessions.set(fakeId, fakeSession);

      await terminalManager.writeToTerminal({
        terminalId: fakeId,
        input: '',
        appendNewline: true
      });

      expect(fakeWrite).toHaveBeenCalledWith('\r');

      (terminalManager as any).ptyProcesses.delete(fakeId);
      (terminalManager as any).sessions.delete(fakeId);
    });

    test('should send carriage return for empty input by default', async () => {
      const fakeId = 'empty-default-enter-terminal';
      const fakeWrite = jest.fn();
      const fakeSession = {
        id: fakeId,
        pid: 22349,
        shell: '/bin/bash',
        cwd: process.cwd(),
        env: {} as Record<string, string>,
        created: new Date(),
        lastActivity: new Date(),
        status: 'active' as const
      };

      (terminalManager as any).ptyProcesses.set(fakeId, { write: fakeWrite });
      (terminalManager as any).sessions.set(fakeId, fakeSession);

      await terminalManager.writeToTerminal({
        terminalId: fakeId,
        input: ''
      });

      expect(fakeWrite).toHaveBeenCalledWith('\r');

      (terminalManager as any).ptyProcesses.delete(fakeId);
      (terminalManager as any).sessions.delete(fakeId);
    });

    test('should allow sendEnter to force carriage return even without appendNewline', async () => {
      const fakeId = 'force-enter-terminal';
      const fakeWrite = jest.fn();
      const fakeSession = {
        id: fakeId,
        pid: 22350,
        shell: '/bin/bash',
        cwd: process.cwd(),
        env: {} as Record<string, string>,
        created: new Date(),
        lastActivity: new Date(),
        status: 'active' as const
      };

      (terminalManager as any).ptyProcesses.set(fakeId, { write: fakeWrite });
      (terminalManager as any).sessions.set(fakeId, fakeSession);

      await terminalManager.writeToTerminal({
        terminalId: fakeId,
        input: '',
        appendNewline: false,
        sendEnter: true
      });

      expect(fakeWrite).toHaveBeenCalledWith('\r');

      (terminalManager as any).ptyProcesses.delete(fakeId);
      (terminalManager as any).sessions.delete(fakeId);
    });

    test('should normalize explicit newline input to carriage return', async () => {
      const fakeId = 'normalize-terminal';
      const fakeWrite = jest.fn();
      const fakeSession = {
        id: fakeId,
        pid: 22348,
        shell: '/bin/bash',
        cwd: process.cwd(),
        env: {} as Record<string, string>,
        created: new Date(),
        lastActivity: new Date(),
        status: 'active' as const
      };

      (terminalManager as any).ptyProcesses.set(fakeId, { write: fakeWrite });
      (terminalManager as any).sessions.set(fakeId, fakeSession);

      await terminalManager.writeToTerminal({
        terminalId: fakeId,
        input: '\n',
        appendNewline: false
      });

      expect(fakeWrite).toHaveBeenCalledWith('\r');

      (terminalManager as any).ptyProcesses.delete(fakeId);
      (terminalManager as any).sessions.delete(fakeId);
    });

    test('should generate cursor position reply for terminal query', () => {
      const manager = terminalManager as any;
      const replies = manager.collectTerminalReplies('query-terminal', `prefix\u001b[6n`);

      expect(replies).toEqual(['\u001b[1;1R']);
      expect(manager.terminalQueryRemainders.has('query-terminal')).toBe(false);
    });

    test('should handle split terminal query chunks across events', () => {
      const manager = terminalManager as any;
      const terminalId = 'split-query-terminal';

      const firstReplies = manager.collectTerminalReplies(terminalId, '\u001b[');
      expect(firstReplies).toEqual([]);
      expect(manager.terminalQueryRemainders.get(terminalId)).toBe('\u001b[');

      const secondReplies = manager.collectTerminalReplies(terminalId, '6n');
      expect(secondReplies).toEqual(['\u001b[1;1R']);
      expect(manager.terminalQueryRemainders.has(terminalId)).toBe(false);
    });

    test('should read from terminal', async () => {
      // Send a command
      await terminalManager.writeToTerminal({
        terminalId,
        input: 'echo "test output"\n'
      });

      // Wait a bit for command to execute
      await new Promise(resolve => setTimeout(resolve, 500));

      const result = await terminalManager.readFromTerminal({ terminalId });
      
      expect(result).toBeDefined();
      expect(typeof result.output).toBe('string');
      expect(typeof result.totalLines).toBe('number');
      expect(typeof result.hasMore).toBe('boolean');
      expect(typeof result.cursor).toBe('number');
      expect(result.status).toBeDefined();
      expect(typeof result.status?.isRunning).toBe('boolean');
    });

    test('should preserve raw terminal chunks for replay', async () => {
      await terminalManager.writeToTerminal({
        terminalId,
        input: "echo 'RAW-REPLAY-TEST'"
      });

      await new Promise(resolve => setTimeout(resolve, 800));

      const parsed = await terminalManager.readFromTerminal({ terminalId, since: 0 });
      const raw = await terminalManager.readFromTerminal({ terminalId, since: 0, raw: true });

      expect(parsed.output).toContain('RAW-REPLAY-TEST');
      expect(raw.output).toContain('echo \'RAW-REPLAY-TEST\'');
      expect(raw.output).toContain('RAW-REPLAY-TEST');
      expect(raw.output.length).toBeGreaterThanOrEqual(parsed.output.length);
    });

    test('should list terminals', async () => {
      const result = await terminalManager.listTerminals();
      
      expect(result.terminals).toBeDefined();
      expect(Array.isArray(result.terminals)).toBe(true);
      expect(result.terminals.length).toBeGreaterThan(0);
      
      const terminal = result.terminals.find(t => t.id === terminalId);
      expect(terminal).toBeDefined();
      expect(terminal?.status).toBe('active');
    });

    test('should kill terminal', async () => {
      await terminalManager.killTerminal(terminalId);
      
      // Wait a bit for termination
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const session = terminalManager.getTerminalInfo(terminalId);
      expect(session).toBeUndefined();
      expect(terminalManager.isTerminalActive(terminalId)).toBe(false);
    });

    test('should handle non-existent terminal', async () => {
      const fakeId = 'non-existent-id';
      
      await expect(
        terminalManager.writeToTerminal({
          terminalId: fakeId,
          input: 'test'
        })
      ).rejects.toThrow();

      await expect(
        terminalManager.readFromTerminal({ terminalId: fakeId })
      ).rejects.toThrow();

      await expect(
        terminalManager.killTerminal(fakeId)
      ).rejects.toThrow();
    });
  });

  describe('Manager Statistics', () => {
    test('should return manager stats', () => {
      const stats = terminalManager.getStats();

      expect(stats).toBeDefined();
      expect(typeof stats.activeSessions).toBe('number');
      expect(typeof stats.totalSessions).toBe('number');
      expect(typeof stats.totalBufferSize).toBe('number');
      expect(stats.config).toBeDefined();
    });
  });

  describe('getTerminalStatus', () => {
    test('UT-006: should return processStatus=active for a running terminal', async () => {
      const terminalId = await terminalManager.createTerminal();

      // Wait briefly for shell to initialize
      await new Promise(resolve => setTimeout(resolve, 500));

      const status = await terminalManager.getTerminalStatus(terminalId);

      expect(status).toBeDefined();
      expect(status.terminalId).toBe(terminalId);
      expect(status.processStatus).toBe('active');
      expect(['unknown', 'running', 'waiting_input']).toContain(status.semanticStatus);
      expect(status.semanticStatusConfidence).toBe('heuristic');
      expect(status.promptVisible).toBeDefined();
      expect(status.cursors).toBeDefined();
      expect(typeof status.cursors.parsed).toBe('number');
      expect(typeof status.cursors.raw).toBe('number');
      expect(status.exit).toBeNull();
      expect(status.pendingCommand).toBeNull();
      expect(status.lastCommand).toBeNull();
      expect(status.lastActivity).toBeDefined();
    });

    test('UT-007: should return processStatus=terminated after terminal exits', async () => {
      const terminalId = await terminalManager.createTerminal();
      const session = terminalManager.getTerminalInfo(terminalId);
      expect(session).toBeDefined();

      // Use internal access to simulate terminated state
      const manager = terminalManager as any;
      const sess = manager.sessions.get(terminalId);

      // Simulate terminated state with exit code
      sess.status = 'terminated';
      sess.exitCode = 0;
      sess.exitSignal = null;

      // Remove from ptyProcesses so processStatus resolves to 'terminated'
      manager.ptyProcesses.delete(terminalId);

      const status = await terminalManager.getTerminalStatus(terminalId);

      expect(status.processStatus).toBe('terminated');
      expect(status.semanticStatus).toBe('completed');
      expect(status.exit).toBeDefined();
      expect(status.exit!.code).toBe(0);
      expect(status.exit!.signal).toBeNull();

      // Clean up
      manager.sessions.delete(terminalId);
      manager.outputBuffers.delete(terminalId);
    });

    test('should return semanticStatus=error when exit code is non-zero', async () => {
      const terminalId = await terminalManager.createTerminal();
      const manager = terminalManager as any;
      const sess = manager.sessions.get(terminalId);

      sess.status = 'terminated';
      sess.exitCode = 1;
      sess.exitSignal = null;
      manager.ptyProcesses.delete(terminalId);

      const status = await terminalManager.getTerminalStatus(terminalId);

      expect(status.processStatus).toBe('terminated');
      expect(status.semanticStatus).toBe('error');
      expect(status.exit!.code).toBe(1);

      // Clean up
      manager.sessions.delete(terminalId);
      manager.outputBuffers.delete(terminalId);
    });

    test('should include output preview when requested', async () => {
      const terminalId = await terminalManager.createTerminal();

      // Send a command to generate some output
      await terminalManager.writeToTerminal({
        terminalId,
        input: 'echo preview-test'
      });
      await new Promise(resolve => setTimeout(resolve, 800));

      const status = await terminalManager.getTerminalStatus(terminalId, { includeOutputPreview: true });

      expect(status.outputPreview).toBeDefined();
      expect(typeof status.outputPreview).toBe('string');
    });

    test('should not include output preview by default', async () => {
      // Use internal session setup to avoid Windows PTY kill issues in afterEach
      const fakeId = 'no-preview-terminal';
      const fakeSession = {
        id: fakeId,
        pid: 99999,
        shell: 'powershell.exe',
        cwd: process.cwd(),
        env: {} as Record<string, string>,
        created: new Date(),
        lastActivity: new Date(),
        status: 'active' as const,
        pendingCommand: null,
        lastCommand: null,
        lastPromptLine: null,
        lastPromptAt: null,
        hasPrompt: false,
        exitCode: null,
        exitSignal: null
      };

      const manager = terminalManager as any;
      manager.sessions.set(fakeId, fakeSession);
      manager.ptyProcesses.set(fakeId, { write: () => true, kill: () => {} });

      const status = await terminalManager.getTerminalStatus(fakeId);

      expect(status.outputPreview).toBeUndefined();

      manager.sessions.delete(fakeId);
      manager.ptyProcesses.delete(fakeId);
    });

    test('should throw for non-existent terminal', async () => {
      await expect(
        terminalManager.getTerminalStatus('non-existent-id')
      ).rejects.toThrow(/not found/);
    });
  });

  describe('waitForPattern', () => {
    test('UT-001: should match pattern and return capture groups', async () => {
      const terminalId = await terminalManager.createTerminal();

      // Write content that will appear in buffer
      await terminalManager.writeToTerminal({
        terminalId,
        input: 'echo RESULT_OK_DONE'
      });
      await new Promise(resolve => setTimeout(resolve, 1000));

      const result = await terminalManager.waitForPattern({
        terminalId,
        pattern: 'RESULT_(\\w+)',
        timeoutMs: 5000,
        pollIntervalMs: 200
      });

      expect(result.matched).toBe(true);
      expect(result.timedOut).toBe(false);
      expect(result.match).toBeDefined();
      expect(result.match!.text).toContain('RESULT_OK');
      expect(result.match!.groups).toBeDefined();
      expect(result.match!.groups![0]).toBe('OK');
      expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
      expect(result.cursor).toBeDefined();
    });

    test('UT-002: should return timedOut=true with snapshot on timeout', async () => {
      const terminalId = await terminalManager.createTerminal();

      const result = await terminalManager.waitForPattern({
        terminalId,
        pattern: 'NEVER_APPEAR_PATTERN_12345',
        timeoutMs: 1000,
        pollIntervalMs: 200,
        snapshotLines: 20
      });

      expect(result.matched).toBe(false);
      expect(result.timedOut).toBe(true);
      expect(result.elapsedMs).toBeGreaterThanOrEqual(900);
      expect(result.snapshot).toBeDefined();
    });

    test('UT-003: should return error for invalid regex', async () => {
      const terminalId = await terminalManager.createTerminal();

      const result = await terminalManager.waitForPattern({
        terminalId,
        pattern: '[invalid(regex',
        timeoutMs: 2000
      });

      expect(result.matched).toBe(false);
      expect(result.timedOut).toBe(false);
    });
  });

  describe('createTerminalWithInit', () => {
    test('UT-004: should execute init commands sequentially', async () => {
      const result = await terminalManager.createTerminalWithInit({
        initCommands: ['echo INIT_STEP_1', 'echo INIT_STEP_2'],
        readyTimeoutMs: 5000
      });

      expect(result.terminalId).toBeDefined();
      expect(result.init).toBeDefined();
      expect(result.init.status).toBe('ready');
      expect(result.init.elapsedMs).toBeGreaterThanOrEqual(0);

      // Verify the terminal is usable
      const session = terminalManager.getTerminalInfo(result.terminalId);
      expect(session).toBeDefined();
      expect(session?.status).toBe('active');
    });

    test('UT-005: should handle ready timeout gracefully', async () => {
      const result = await terminalManager.createTerminalWithInit({
        initCommands: ['echo STARTED'],
        readyPattern: 'NEVER_MATCH_PATTERN_99999',
        readyTimeoutMs: 1000
      });

      expect(result.terminalId).toBeDefined();
      expect(result.init).toBeDefined();
      expect(result.init.status).toBe('timeout');
      expect(result.init.timedOut).toBe(true);
      expect(result.init.outputPreview).toBeDefined();

      // Terminal should still be alive (D-005)
      const session = terminalManager.getTerminalInfo(result.terminalId);
      expect(session).toBeDefined();
      expect(session?.status).toBe('active');
    });

    test('should return not_requested when no init options provided', async () => {
      const result = await terminalManager.createTerminalWithInit({});

      expect(result.terminalId).toBeDefined();
      expect(result.init).toBeDefined();
      expect(result.init.status).toBe('not_requested');
    });
  });
});

describe('OutputBuffer', () => {
  let buffer: OutputBuffer;

  beforeEach(() => {
    buffer = new OutputBuffer('test-terminal', 10); // Small buffer for testing
  });

  test('should append and read content', () => {
    buffer.append('line 1\nline 2\nline 3');
    
    const result = buffer.read();
    expect(result.entries.length).toBe(3);
    expect(result.entries[0].content).toBe('line 1');
    expect(result.entries[1].content).toBe('line 2');
    expect(result.entries[2].content).toBe('line 3');
    expect(result.nextCursor).toBeGreaterThan(0);
  });

  test('should handle buffer overflow', () => {
    // Add more lines than buffer size
    for (let i = 0; i < 15; i++) {
      buffer.append(`line ${i}\n`);
    }
    
    const result = buffer.read();
    expect(result.entries.length).toBeLessThanOrEqual(10);
    
    // Should contain the most recent lines
    const lastEntry = result.entries[result.entries.length - 1];
    expect(lastEntry.content).toBe('line 14');
  });

  test('should support incremental reading', () => {
    buffer.append('line 1\nline 2');
    const result1 = buffer.read();
    
    buffer.append('\nline 3\nline 4\n');
    const result2 = buffer.read({ since: result1.nextCursor });
    
    expect(result2.entries.length).toBe(2);
    expect(result2.entries[0].content).toBe('line 3');
    expect(result2.entries[1].content).toBe('line 4');
  });

  test('should get latest content', () => {
    for (let i = 0; i < 15; i++) {
      buffer.append(`line ${i}\n`);
    }
    
    const latest = buffer.getLatest(3);
    expect(latest.length).toBe(3);
    expect(latest[2].content).toBe('line 14');
  });

  test('should clear buffer', () => {
    buffer.append('test content');
    buffer.clear();
    
    const result = buffer.read();
    expect(result.entries.length).toBe(0);
    expect(result.totalLines).toBe(0);
  });

  test('should provide buffer statistics', () => {
    buffer.append('line 1\nline 2\nline 3');
    
    const stats = buffer.getStats();
    expect(stats.terminalId).toBe('test-terminal');
    expect(stats.totalLines).toBe(3);
    expect(stats.bufferedLines).toBe(3);
    expect(stats.maxSize).toBe(10);
  });

  test('should treat carriage returns as line rewrites', () => {
    buffer.append('⠋ Installing dependencies');
    buffer.append('\r⠙ Installing dependencies');
    buffer.append('\r⠹ Installing dependencies\nDone!\n');

    const result = buffer.read();
    expect(result.entries.map(entry => entry.content)).toEqual([
      '⠹ Installing dependencies',
      'Done!'
    ]);
  });

  test('should collapse consecutive blank lines', () => {
    buffer.append('\n\n\n');

    const result = buffer.read();
    expect(result.entries.length).toBe(1);
    expect(result.entries[0].content).toBe('');
  });

  test('should strip ansi color sequences', () => {
    buffer.append('[33mHello[0m World\n');

    const result = buffer.read();
    expect(result.entries.map(entry => entry.content)).toEqual(['Hello World']);
  });

  test('should handle cursor movement escape sequences', () => {
    buffer.append('[1G[0K⠋ Step 1');
    buffer.append('\r');
    buffer.append('[1G[0K⠙ Step 2\n');

    const result = buffer.read();
    expect(result.entries.map(entry => entry.content)).toEqual(['⠙ Step 2']);
  });

  test('should expose updated lines when using cursor-based reads', () => {
    buffer.append('bash-3.2$ ');
    const first = buffer.read();

    buffer.append('npm install\r\n');
    const second = buffer.read({ since: first.nextCursor });

    const lines = second.entries.map(entry => entry.content);
    expect(lines).toContain('bash-3.2$ npm install');
  });
});
