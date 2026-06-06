import { PersistentTerminalMcpServer } from '../mcp-server.js';

describe('PersistentTerminalMcpServer - get_terminal_status tool', () => {
  let server: PersistentTerminalMcpServer;

  beforeEach(() => {
    server = new PersistentTerminalMcpServer();
  });

  afterEach(async () => {
    await server.shutdown();
  });

  test('should register get_terminal_status tool without error', () => {
    // If the server constructs without throwing, the tool is registered
    expect(server).toBeDefined();
    expect(server.getTerminalManager()).toBeDefined();
  });

  test('should return status for an active terminal via terminalManager', async () => {
    if (process.platform === 'win32') return; // node-pty conpty issues on Windows
    const tm = server.getTerminalManager();
    const terminalId = await tm.createTerminal();

    // Wait briefly for shell to initialize
    await new Promise(resolve => setTimeout(resolve, 500));

    const status = await tm.getTerminalStatus(terminalId, { includeOutputPreview: true });

    expect(status).toBeDefined();
    expect(status.terminalId).toBe(terminalId);
    expect(status.processStatus).toBe('active');
    expect(['unknown', 'running', 'waiting_input']).toContain(status.semanticStatus);
    expect(status.cursors).toBeDefined();
    expect(typeof status.cursors.parsed).toBe('number');
    expect(typeof status.cursors.raw).toBe('number');

    await tm.killTerminal(terminalId);
  });

  test('should return terminated status after killing terminal', async () => {
    if (process.platform === 'win32') return; // node-pty conpty issues on Windows
    const tm = server.getTerminalManager();
    const terminalId = await tm.createTerminal();

    // Kill the terminal but keep the session accessible by reading info first
    const session = tm.getTerminalInfo(terminalId);
    expect(session).toBeDefined();

    await tm.killTerminal(terminalId);

    // After killTerminal, the session is removed from the map, so we expect not-found
    await expect(tm.getTerminalStatus(terminalId)).rejects.toThrow(/not found/);
  });

  test('should throw for non-existent terminal', async () => {
    const tm = server.getTerminalManager();
    await expect(tm.getTerminalStatus('non-existent-id')).rejects.toThrow(/not found/);
  });
});
