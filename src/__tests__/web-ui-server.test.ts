import http from 'node:http';
import { WebUIServer } from '../web-ui-server.js';
import { TerminalManager } from '../terminal-manager.js';

// ---------------------------------------------------------------------------
// Windows PTY compatibility check
// ---------------------------------------------------------------------------

const IS_WINDOWS = process.platform === 'win32';
// On Windows, node-pty conpty has issues in Jest (AttachConsole failed, Signals not supported)
// Skip PTY-dependent tests on Windows — they are validated via real CLI driver tests instead
let ptyAvailable = !IS_WINDOWS;

// ---------------------------------------------------------------------------
// HTTP helpers – no external deps, just node:http
// ---------------------------------------------------------------------------

function httpGet(url: string): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, body }));
    }).on('error', reject);
  });
}

function httpPost(
  url: string,
  data: unknown,
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const payload = JSON.stringify(data);
    const options: http.RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, body }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function httpDelete(
  url: string,
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options: http.RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'DELETE',
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Skip helper for tests requiring PTY on Windows
// ---------------------------------------------------------------------------
function ptyTest(name: string, fn: () => Promise<void>): void {
  test(name, async () => {
    if (!ptyAvailable) return; // skip on Windows when PTY unavailable
    await fn();
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('WebUIServer HTTP Integration', () => {
  let terminalManager: TerminalManager;
  let webUIServer: WebUIServer;
  let baseUrl: string;

  beforeAll(async () => {
    terminalManager = new TerminalManager({
      maxBufferSize: 100,
      sessionTimeout: 30000,
    });

    webUIServer = new WebUIServer(terminalManager);

    // Listen on port 0 so the OS picks a free port
    await webUIServer.start(0);

    // Retrieve the actual assigned port from the underlying httpServer
    const address = (webUIServer as any).httpServer?.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to determine server port');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await webUIServer.stop();
    await terminalManager.shutdown();
  });

  // -----------------------------------------------------------------------
  // GET /api/terminals
  // -----------------------------------------------------------------------
  describe('GET /api/terminals', () => {
    test('returns 200 and an empty terminals list initially', async () => {
      const { statusCode, body } = await httpGet(`${baseUrl}/api/terminals`);
      expect(statusCode).toBe(200);
      const parsed = JSON.parse(body);
      expect(parsed).toHaveProperty('terminals');
      expect(Array.isArray(parsed.terminals)).toBe(true);
    });

    ptyTest('returns a terminal after one is created via TerminalManager', async () => {
      const id = await terminalManager.createTerminal();
      const { statusCode, body } = await httpGet(`${baseUrl}/api/terminals`);
      expect(statusCode).toBe(200);
      const parsed = JSON.parse(body);
      expect(parsed.terminals.length).toBeGreaterThanOrEqual(1);
      const found = parsed.terminals.find((t: any) => t.id === id);
      expect(found).toBeDefined();
      expect(found.id).toBe(id);
      expect(found).toHaveProperty('pid');
      expect(found).toHaveProperty('shell');
      await terminalManager.killTerminal(id);
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/terminals
  // -----------------------------------------------------------------------
  describe('POST /api/terminals', () => {
    ptyTest('creates a terminal and returns 201 with terminalId', async () => {
      const { statusCode, body } = await httpPost(`${baseUrl}/api/terminals`, {});
      expect(statusCode).toBe(201);
      const parsed = JSON.parse(body);
      expect(parsed).toHaveProperty('terminalId');
      expect(typeof parsed.terminalId).toBe('string');
      expect(parsed).toHaveProperty('pid');
      expect(parsed).toHaveProperty('shell');
      await terminalManager.killTerminal(parsed.terminalId);
    });

    ptyTest('creates a terminal with initCommands and returns init info', async () => {
      const { statusCode, body } = await httpPost(`${baseUrl}/api/terminals`, {
        initCommands: ['echo hello'],
      });
      expect(statusCode).toBe(201);
      const parsed = JSON.parse(body);
      expect(parsed).toHaveProperty('terminalId');
      expect(parsed).toHaveProperty('init');
      expect(parsed.init).toHaveProperty('status');
      await terminalManager.killTerminal(parsed.terminalId);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/terminals/:id
  // -----------------------------------------------------------------------
  describe('GET /api/terminals/:id', () => {
    test('returns 404 for a non-existent terminal', async () => {
      const { statusCode, body } = await httpGet(
        `${baseUrl}/api/terminals/nonexistent-id-12345`,
      );
      expect(statusCode).toBe(404);
      const parsed = JSON.parse(body);
      expect(parsed).toHaveProperty('error');
    });

    ptyTest('returns terminal details for a real terminal', async () => {
      const id = await terminalManager.createTerminal();
      const { statusCode, body } = await httpGet(
        `${baseUrl}/api/terminals/${id}`,
      );
      expect(statusCode).toBe(200);
      const parsed = JSON.parse(body);
      expect(parsed.id).toBe(id);
      expect(parsed).toHaveProperty('pid');
      expect(parsed).toHaveProperty('shell');
      expect(parsed).toHaveProperty('status');
      await terminalManager.killTerminal(id);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/terminals/:id/stats
  // -----------------------------------------------------------------------
  describe('GET /api/terminals/:id/stats', () => {
    ptyTest('returns stats for a real terminal', async () => {
      const id = await terminalManager.createTerminal();
      const { statusCode, body } = await httpGet(
        `${baseUrl}/api/terminals/${id}/stats`,
      );
      expect(statusCode).toBe(200);
      const parsed = JSON.parse(body);
      expect(parsed).toHaveProperty('terminalId');
      await terminalManager.killTerminal(id);
    });

    test('returns 400 for a non-existent terminal', async () => {
      const { statusCode } = await httpGet(
        `${baseUrl}/api/terminals/nonexistent-id-99999/stats`,
      );
      expect(statusCode).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/terminals/:id/status
  // -----------------------------------------------------------------------
  describe('GET /api/terminals/:id/status', () => {
    ptyTest('returns structured status for a real terminal', async () => {
      const id = await terminalManager.createTerminal();
      const { statusCode, body } = await httpGet(
        `${baseUrl}/api/terminals/${id}/status`,
      );
      expect(statusCode).toBe(200);
      const parsed = JSON.parse(body);
      expect(parsed).toHaveProperty('terminalId');
      expect(parsed).toHaveProperty('processStatus');
      expect(parsed).toHaveProperty('semanticStatus');
      await terminalManager.killTerminal(id);
    });

    test('returns 400 for a non-existent terminal', async () => {
      const { statusCode } = await httpGet(
        `${baseUrl}/api/terminals/nonexistent-id-99999/status`,
      );
      expect(statusCode).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/terminals/:id/output
  // -----------------------------------------------------------------------
  describe('GET /api/terminals/:id/output', () => {
    ptyTest('returns output for a real terminal', async () => {
      const id = await terminalManager.createTerminal();
      const { statusCode, body } = await httpGet(
        `${baseUrl}/api/terminals/${id}/output`,
      );
      expect(statusCode).toBe(200);
      const parsed = JSON.parse(body);
      expect(parsed).toHaveProperty('output');
      await terminalManager.killTerminal(id);
    });

    test('returns 400 for a non-existent terminal', async () => {
      const { statusCode } = await httpGet(
        `${baseUrl}/api/terminals/nonexistent-id-99999/output`,
      );
      expect(statusCode).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/terminals/:id/input
  // -----------------------------------------------------------------------
  describe('POST /api/terminals/:id/input', () => {
    ptyTest('writes input to a real terminal and returns success', async () => {
      const id = await terminalManager.createTerminal();
      const { statusCode, body } = await httpPost(
        `${baseUrl}/api/terminals/${id}/input`,
        { input: 'echo test\r' },
      );
      expect(statusCode).toBe(200);
      const parsed = JSON.parse(body);
      expect(parsed.success).toBe(true);
      await terminalManager.killTerminal(id);
    });

    test('returns 400 for a non-existent terminal', async () => {
      const { statusCode } = await httpPost(
        `${baseUrl}/api/terminals/nonexistent-id-99999/input`,
        { input: 'echo test\r' },
      );
      expect(statusCode).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // DELETE /api/terminals/:id
  // -----------------------------------------------------------------------
  describe('DELETE /api/terminals/:id', () => {
    ptyTest('kills a real terminal and returns success', async () => {
      const id = await terminalManager.createTerminal();
      const { statusCode, body } = await httpDelete(
        `${baseUrl}/api/terminals/${id}`,
      );
      expect(statusCode).toBe(200);
      const parsed = JSON.parse(body);
      expect(parsed.success).toBe(true);
    });

    test('returns 400 for a non-existent terminal', async () => {
      const { statusCode } = await httpDelete(
        `${baseUrl}/api/terminals/nonexistent-id-99999`,
      );
      expect(statusCode).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/terminals/:id/wait-pattern
  // -----------------------------------------------------------------------
  describe('POST /api/terminals/:id/wait-pattern', () => {
    ptyTest('returns 400 if pattern is missing', async () => {
      const id = await terminalManager.createTerminal();
      const { statusCode, body } = await httpPost(
        `${baseUrl}/api/terminals/${id}/wait-pattern`,
        {},
      );
      expect(statusCode).toBe(400);
      const parsed = JSON.parse(body);
      expect(parsed).toHaveProperty('error');
      await terminalManager.killTerminal(id);
    });

    ptyTest('times out when pattern is not matched', async () => {
      const id = await terminalManager.createTerminal();
      const { statusCode, body } = await httpPost(
        `${baseUrl}/api/terminals/${id}/wait-pattern`,
        { pattern: 'will_never_match_xyz_999', timeoutMs: 500 },
      );
      expect(statusCode).toBe(200);
      const parsed = JSON.parse(body);
      expect(parsed.matched).toBe(false);
      expect(parsed.timedOut).toBe(true);
      await terminalManager.killTerminal(id);
    });

    test('returns 400 for a non-existent terminal', async () => {
      const { statusCode } = await httpPost(
        `${baseUrl}/api/terminals/nonexistent-id-99999/wait-pattern`,
        { pattern: 'test', timeoutMs: 100 },
      );
      expect(statusCode).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/terminals/:id/wait-result
  // -----------------------------------------------------------------------
  describe('POST /api/terminals/:id/wait-result', () => {
    ptyTest('times out when no task_result XML is produced', async () => {
      const id = await terminalManager.createTerminal();
      const { statusCode, body } = await httpPost(
        `${baseUrl}/api/terminals/${id}/wait-result`,
        { timeoutMs: 500 },
      );
      expect(statusCode).toBe(200);
      const parsed = JSON.parse(body);
      expect(parsed).toHaveProperty('wait');
      expect(parsed.wait.matched).toBe(false);
      expect(parsed.wait.timedOut).toBe(true);
      await terminalManager.killTerminal(id);
    });

    test('returns 400 for a non-existent terminal', async () => {
      const { statusCode } = await httpPost(
        `${baseUrl}/api/terminals/nonexistent-id-99999/wait-result`,
        { timeoutMs: 100 },
      );
      expect(statusCode).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/terminals/:id/resume
  // -----------------------------------------------------------------------
  describe('POST /api/terminals/:id/resume', () => {
    test('returns 400 if sessionId is missing', async () => {
      const { statusCode, body } = await httpPost(
        `${baseUrl}/api/terminals/any-id/resume`,
        {},
      );
      expect(statusCode).toBe(400);
      const parsed = JSON.parse(body);
      expect(parsed.error).toContain('sessionId');
    });

    ptyTest('returns 400 for a non-existent sessionId', async () => {
      const { statusCode, body } = await httpPost(
        `${baseUrl}/api/terminals/any-id/resume`,
        { sessionId: 'nonexistent-session-99999' },
      );
      expect(statusCode).toBe(400);
      const parsed = JSON.parse(body);
      expect(parsed).toHaveProperty('error');
    });
  });

  // -----------------------------------------------------------------------
  // End-to-end: create -> list -> write -> read output -> status -> kill
  // -----------------------------------------------------------------------
  describe('End-to-end workflow', () => {
    ptyTest('full lifecycle through the HTTP API', async () => {
      // 1. Create a terminal via POST
      const createRes = await httpPost(`${baseUrl}/api/terminals`, {});
      expect(createRes.statusCode).toBe(201);
      const created = JSON.parse(createRes.body);
      const terminalId = created.terminalId;
      expect(terminalId).toBeTruthy();

      // 2. Verify it shows up in GET /api/terminals
      const listRes = await httpGet(`${baseUrl}/api/terminals`);
      expect(listRes.statusCode).toBe(200);
      const listed = JSON.parse(listRes.body);
      const found = listed.terminals.find((t: any) => t.id === terminalId);
      expect(found).toBeDefined();

      // 3. Get terminal detail
      const detailRes = await httpGet(
        `${baseUrl}/api/terminals/${terminalId}`,
      );
      expect(detailRes.statusCode).toBe(200);
      const detail = JSON.parse(detailRes.body);
      expect(detail.id).toBe(terminalId);
      expect(detail.status).toBe('active');

      // 4. Write input
      const inputRes = await httpPost(
        `${baseUrl}/api/terminals/${terminalId}/input`,
        { input: 'echo integration-test\r' },
      );
      expect(inputRes.statusCode).toBe(200);
      expect(JSON.parse(inputRes.body).success).toBe(true);

      // 5. Read output
      const outputRes = await httpGet(
        `${baseUrl}/api/terminals/${terminalId}/output`,
      );
      expect(outputRes.statusCode).toBe(200);

      // 6. Get status
      const statusRes = await httpGet(
        `${baseUrl}/api/terminals/${terminalId}/status`,
      );
      expect(statusRes.statusCode).toBe(200);
      const status = JSON.parse(statusRes.body);
      expect(status.terminalId).toBe(terminalId);

      // 7. Kill the terminal
      const killRes = await httpDelete(
        `${baseUrl}/api/terminals/${terminalId}`,
      );
      expect(killRes.statusCode).toBe(200);
      expect(JSON.parse(killRes.body).success).toBe(true);

      // 8. Verify it no longer appears as active
      const detailAfter = await httpGet(
        `${baseUrl}/api/terminals/${terminalId}`,
      );
      expect(detailAfter.statusCode).toBe(404);
    });
  });
});
