import { TerminalManager } from '../terminal-manager.js';

const IS_WINDOWS = process.platform === 'win32';

describe('resume_terminal sessionId validation', () => {
  let manager: TerminalManager;

  beforeEach(() => {
    manager = new TerminalManager();
  });

  afterEach(async () => {
    try { await manager.shutdown(); } catch {}
  });

  // Valid sessionIds
  test('valid: alphanumeric sessionId abc123', async () => {
    // Should NOT throw validation error (but will fail to create PTY on Windows)
    if (IS_WINDOWS) {
      // On Windows, test validation doesn't throw by catching the error
      try { await manager.resumeTerminal({ sessionId: 'abc123' }); } catch (e: any) {
        expect(e.message).not.toContain('INVALID_SESSION_ID');
      }
    }
  });

  test('valid: sessionId with hyphens abc-123-def', async () => {
    try { await manager.resumeTerminal({ sessionId: 'abc-123-def' }); } catch (e: any) {
      expect(e.message).not.toContain('INVALID_SESSION_ID');
    }
  });

  test('valid: sessionId with underscores abc_123', async () => {
    try { await manager.resumeTerminal({ sessionId: 'abc_123' }); } catch (e: any) {
      expect(e.message).not.toContain('INVALID_SESSION_ID');
    }
  });

  test('valid: sessionId with dots abc.123', async () => {
    try { await manager.resumeTerminal({ sessionId: 'abc.123' }); } catch (e: any) {
      expect(e.message).not.toContain('INVALID_SESSION_ID');
    }
  });

  test('valid: sessionId with colons abc:123', async () => {
    try { await manager.resumeTerminal({ sessionId: 'abc:123' }); } catch (e: any) {
      expect(e.message).not.toContain('INVALID_SESSION_ID');
    }
  });

  // Invalid sessionIds - command injection vectors
  test('invalid: command injection with ampersand abc&echo hacked', async () => {
    await expect(manager.resumeTerminal({ sessionId: 'abc&echo hacked' })).rejects.toThrow('INVALID_SESSION_ID');
  });

  test('invalid: command injection with semicolon abc;echo hacked', async () => {
    await expect(manager.resumeTerminal({ sessionId: 'abc;echo hacked' })).rejects.toThrow('INVALID_SESSION_ID');
  });

  test('invalid: pipe operator abc|evil', async () => {
    await expect(manager.resumeTerminal({ sessionId: 'abc|evil' })).rejects.toThrow('INVALID_SESSION_ID');
  });

  test('invalid: contains spaces abc 123', async () => {
    await expect(manager.resumeTerminal({ sessionId: 'abc 123' })).rejects.toThrow('INVALID_SESSION_ID');
  });

  test('invalid: contains newline', async () => {
    await expect(manager.resumeTerminal({ sessionId: 'abc\nrm -rf /' })).rejects.toThrow('INVALID_SESSION_ID');
  });

  test('invalid: contains quotes abc"', async () => {
    await expect(manager.resumeTerminal({ sessionId: 'abc"' })).rejects.toThrow('INVALID_SESSION_ID');
  });

  test('invalid: exceeds max length (201 chars)', async () => {
    const longId = 'a'.repeat(201);
    await expect(manager.resumeTerminal({ sessionId: longId })).rejects.toThrow('INVALID_SESSION_ID');
  });

  test('invalid: empty string', async () => {
    await expect(manager.resumeTerminal({ sessionId: '' })).rejects.toThrow('INVALID_SESSION_ID');
  });
});
