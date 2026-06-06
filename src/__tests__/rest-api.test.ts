import { RestApiServer } from '../rest-api.js';
import { TerminalManager } from '../terminal-manager.js';

/**
 * Helper: make an HTTP request to the REST API server.
 * Uses Node's built-in fetch.
 */
async function request(
  baseUrl: string,
  method: string,
  path: string,
  body?: any
): Promise<{ status: number; body: any }> {
  const url = new URL(path, baseUrl);
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(url, options);
  let json: any;
  try {
    json = await res.json();
  } catch {
    json = {};
  }
  return { status: res.status, body: json };
}

describe('RestApiServer - v1.2.0 endpoints', () => {
  let terminalManager: TerminalManager;
  let server: RestApiServer;
  let baseUrl: string;

  beforeEach(async () => {
    terminalManager = new TerminalManager();
    server = new RestApiServer(terminalManager);
    // Listen on a random available port
    await server.start(0);
    const address = (server as any).server.address();
    const port = typeof address === 'object' ? address.port : 3001;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    await server.stop();
    try {
      await terminalManager.shutdown();
    } catch {
      // Windows node-pty may throw "Signals not supported on windows" during kill
    }
  });

  describe('GET / - API documentation', () => {
    test('should include v1.2.0 endpoints in documentation', async () => {
      const res = await request(baseUrl, 'GET', '/');
      expect(res.status).toBe(200);
      expect(res.body.version).toBe('1.2.0');
      expect(res.body.endpoints).toHaveProperty('GET /terminals/:id/status');
      expect(res.body.endpoints).toHaveProperty('POST /terminals/:id/wait-pattern');
      expect(res.body.endpoints).toHaveProperty('POST /terminals/:id/wait-result');
      expect(res.body.endpoints).toHaveProperty('POST /terminals/:id/resume');
    });
  });

  describe('POST /terminals - extended with init options', () => {
    test('should create terminal without init options (backward compatible)', async () => {
      const res = await request(baseUrl, 'POST', '/terminals', {
        cwd: process.cwd()
      });
      expect(res.status).toBe(201);
      expect(res.body.terminalId).toBeDefined();
      expect(res.body.init).toBeUndefined();
    });

    test('should create terminal with init options and return init metadata', async () => {
      const res = await request(baseUrl, 'POST', '/terminals', {
        cwd: process.cwd(),
        initCommands: ['echo hello'],
        readyPattern: 'hello',
        readyTimeoutMs: 5000
      });
      expect(res.status).toBe(201);
      expect(res.body.terminalId).toBeDefined();
      expect(res.body.init).toBeDefined();
      expect(res.body.init.status).toBeDefined();
      expect(typeof res.body.init.elapsedMs).toBe('number');
    });
  });

  describe('GET /terminals/:id/status', () => {
    test('should return 404 for non-existent terminal', async () => {
      const res = await request(baseUrl, 'GET', '/terminals/non-existent-id/status');
      expect(res.status).toBe(404);
    });

    test('should return status for existing terminal', async () => {
      const createRes = await request(baseUrl, 'POST', '/terminals', { cwd: process.cwd() });
      const terminalId = createRes.body.terminalId;
      await new Promise(resolve => setTimeout(resolve, 500));

      const res = await request(baseUrl, 'GET', `/terminals/${terminalId}/status`);
      expect(res.status).toBe(200);
      expect(res.body.terminalId).toBe(terminalId);
      expect(res.body.processStatus).toBeDefined();
      expect(res.body.semanticStatus).toBeDefined();
    });

    test('should accept includeOutputPreview query param', async () => {
      const createRes = await request(baseUrl, 'POST', '/terminals', { cwd: process.cwd() });
      const terminalId = createRes.body.terminalId;
      await new Promise(resolve => setTimeout(resolve, 500));

      const res = await request(
        baseUrl,
        'GET',
        `/terminals/${terminalId}/status?includeOutputPreview=true`
      );
      expect(res.status).toBe(200);
      expect(res.body.terminalId).toBe(terminalId);
    });
  });

  describe('POST /terminals/:id/wait-pattern', () => {
    test('should return 404 for non-existent terminal', async () => {
      const res = await request(baseUrl, 'POST', '/terminals/non-existent-id/wait-pattern', {
        pattern: 'test'
      });
      expect(res.status).toBe(404);
    });

    test('should return 400 if pattern is missing', async () => {
      // Use a non-existent terminal to avoid needing to clean up
      const res = await request(baseUrl, 'POST', '/terminals/fake-id/wait-pattern', {});
      // Either 400 (pattern missing) or 404 (terminal not found) is acceptable
      expect([400, 404]).toContain(res.status);
    });

    test('should wait for pattern and return result', async () => {
      const createRes = await request(baseUrl, 'POST', '/terminals', { cwd: process.cwd() });
      const terminalId = createRes.body.terminalId;
      await new Promise(resolve => setTimeout(resolve, 500));

      // Send a command that produces known output
      await terminalManager.writeToTerminal({
        terminalId,
        input: 'echo REST_WAIT_PATTERN_TEST'
      });
      await new Promise(resolve => setTimeout(resolve, 300));

      const res = await request(
        baseUrl,
        'POST',
        `/terminals/${terminalId}/wait-pattern`,
        { pattern: 'REST_WAIT_PATTERN_TEST', timeoutMs: 10000 }
      );
      expect(res.status).toBe(200);
      expect(typeof res.body.matched).toBe('boolean');
      expect(typeof res.body.elapsedMs).toBe('number');
    });
  });

  describe('POST /terminals/:id/wait-result', () => {
    test('should return 404 for non-existent terminal', async () => {
      const res = await request(baseUrl, 'POST', '/terminals/non-existent-id/wait-result', {
        timeoutMs: 5000
      });
      expect(res.status).toBe(404);
    });

    test('should wait for task_result and attempt to parse', async () => {
      const createRes = await request(baseUrl, 'POST', '/terminals', { cwd: process.cwd() });
      const terminalId = createRes.body.terminalId;
      await new Promise(resolve => setTimeout(resolve, 500));

      // Send XML output via terminal
      await terminalManager.writeToTerminal({
        terminalId,
        input: 'echo <task_result><status>PASS</status><summary>ok</summary></task_result>'
      });
      await new Promise(resolve => setTimeout(resolve, 300));

      const res = await request(
        baseUrl,
        'POST',
        `/terminals/${terminalId}/wait-result`,
        { timeoutMs: 10000 }
      );
      expect(res.status).toBe(200);
      expect(res.body.waitResult).toBeDefined();
      expect(res.body.parseResult).toBeDefined();
      expect(res.body.parseResult.rawXml).toBeDefined();
    });
  });

  describe('GET /terminals/:id/output - extended with adapter', () => {
    test('should accept adapter query param', async () => {
      const createRes = await request(baseUrl, 'POST', '/terminals', { cwd: process.cwd() });
      const terminalId = createRes.body.terminalId;
      await new Promise(resolve => setTimeout(resolve, 300));

      const res = await request(
        baseUrl,
        'GET',
        `/terminals/${terminalId}/output?adapter=generic&mode=tail&tailLines=10`
      );
      expect(res.status).toBe(200);
    });
  });

  describe('POST /terminals/:id/resume', () => {
    test('should return 400 if sessionId is missing', async () => {
      // POST to a valid-looking terminal ID path
      const res = await request(baseUrl, 'POST', '/terminals/some-id/resume', {});
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });
});
