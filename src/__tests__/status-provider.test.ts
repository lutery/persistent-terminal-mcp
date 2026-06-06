import { StatusProvider } from '../status-provider.js';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('StatusProvider', () => {
  let provider: StatusProvider;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'status-provider-test-'));
    provider = new StatusProvider(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('writeStatus + readStatus', () => {
    it('should write and read valid status data', async () => {
      const data = {
        status: 'running',
        last_activity: new Date().toISOString(),
        tool_calls: 5,
        files_modified: ['src/index.ts', 'src/types.ts']
      };

      await provider.writeStatus('test-terminal-1', data);
      const result = await provider.readStatus('test-terminal-1');

      expect(result.available).toBe(true);
      expect(result.parsed).toBe(true);
      expect(result.data?.status).toBe('running');
      expect(result.data?.tool_calls).toBe(5);
      expect(result.data?.files_modified).toEqual(['src/index.ts', 'src/types.ts']);
    });
  });

  describe('readStatus - file not found', () => {
    it('should return available=false for non-existent file', async () => {
      const result = await provider.readStatus('non-existent-terminal');

      expect(result.available).toBe(false);
      expect(result.parsed).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('readStatus - invalid JSON', () => {
    it('should return parsed=false for invalid JSON', async () => {
      await provider.ensureDir();
      const filePath = provider.getStatusFilePath('bad-json-terminal');
      await fs.writeFile(filePath, 'not valid json {{{', 'utf-8');

      const result = await provider.readStatus('bad-json-terminal');

      expect(result.available).toBe(true);
      expect(result.parsed).toBe(false);
      expect(result.error).toContain('Invalid JSON');
    });
  });

  describe('readStatus - schema mismatch', () => {
    it('should return parsed=false for valid JSON that does not match schema', async () => {
      await provider.ensureDir();
      const filePath = provider.getStatusFilePath('bad-schema-terminal');
      await fs.writeFile(filePath, JSON.stringify({ wrong_field: true }), 'utf-8');

      const result = await provider.readStatus('bad-schema-terminal');

      expect(result.available).toBe(true);
      expect(result.parsed).toBe(false);
      expect(result.error).toContain('Schema validation');
    });
  });

  describe('readStatusFile', () => {
    it('should read from explicit file path', async () => {
      const data = {
        status: 'completed',
        last_activity: new Date().toISOString()
      };
      await provider.writeStatus('explicit-path-test', data);
      const filePath = provider.getStatusFilePath('explicit-path-test');

      const result = await provider.readStatusFile(filePath);

      expect(result.available).toBe(true);
      expect(result.parsed).toBe(true);
      expect(result.data?.status).toBe('completed');
    });
  });

  describe('deleteStatus', () => {
    it('should delete status file', async () => {
      const data = { status: 'running', last_activity: new Date().toISOString() };
      await provider.writeStatus('delete-test', data);

      let result = await provider.readStatus('delete-test');
      expect(result.available).toBe(true);

      await provider.deleteStatus('delete-test');

      result = await provider.readStatus('delete-test');
      expect(result.available).toBe(false);
    });

    it('should not throw when deleting non-existent file', async () => {
      await expect(provider.deleteStatus('non-existent')).resolves.not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should remove status files for terminals not in keep set', async () => {
      const data = { status: 'running', last_activity: new Date().toISOString() };
      await provider.writeStatus('keep-1', data);
      await provider.writeStatus('keep-2', data);
      await provider.writeStatus('remove-1', data);

      const removed = await provider.cleanup(new Set(['keep-1', 'keep-2']));

      expect(removed).toBe(1);
      expect((await provider.readStatus('keep-1')).available).toBe(true);
      expect((await provider.readStatus('keep-2')).available).toBe(true);
      expect((await provider.readStatus('remove-1')).available).toBe(false);
    });
  });

  describe('getStatusFilePath', () => {
    it('should return correct file path', () => {
      const filePath = provider.getStatusFilePath('my-terminal');
      expect(filePath).toBe(path.join(tmpDir, 'my-terminal.json'));
    });
  });
});
