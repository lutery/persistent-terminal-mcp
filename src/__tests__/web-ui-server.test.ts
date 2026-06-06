import { TerminalManager } from '../terminal-manager.js';

describe('WebUIServer API Routes', () => {
  let terminalManager: TerminalManager;

  beforeEach(() => {
    terminalManager = new TerminalManager({
      maxBufferSize: 100,
      sessionTimeout: 5000
    });
  });

  afterEach(async () => {
    await terminalManager.shutdown();
  });

  describe('GET /api/terminals/:id/status', () => {
    test('should return structured status for a terminal', async () => {
      const terminalId = await terminalManager.createTerminal();
      const status = await terminalManager.getTerminalStatus(terminalId, { includeOutputPreview: true });

      expect(status).toBeDefined();
      expect(status.terminalId).toBe(terminalId);
      expect(status.processStatus).toBe('active');
      expect(status.semanticStatus).toBeDefined();
      expect(status.lastActivity).toBeDefined();
      expect(status.promptVisible).toBeDefined();
    });
  });

  describe('POST /api/terminals/:id/wait-pattern', () => {
    test('should wait for a pattern and return result', async () => {
      const terminalId = await terminalManager.createTerminal();
      const result = await terminalManager.waitForPattern({
        terminalId,
        pattern: 'nonexistent_pattern_xyz',
        timeoutMs: 1000
      });

      expect(result).toBeDefined();
      expect(result.matched).toBe(false);
      expect(result.timedOut).toBe(true);
    });
  });

  describe('POST /api/terminals with init options', () => {
    test('should create terminal with init commands', async () => {
      const result = await terminalManager.createTerminalWithInit({
        initCommands: ['echo hello']
      });

      expect(result).toBeDefined();
      expect(result.terminalId).toBeDefined();
      expect(result.init).toBeDefined();
      expect(result.init.status).toBeDefined();
    });
  });

  describe('POST /api/terminals/:id/resume', () => {
    test('should resume a terminal session', async () => {
      const result = await terminalManager.resumeTerminal({
        sessionId: 'test-session-123'
      });

      expect(result).toBeDefined();
      expect(result.terminalId).toBeDefined();
      expect(result.init).toBeDefined();
    });
  });
});
