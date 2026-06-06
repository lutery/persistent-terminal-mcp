import { z } from 'zod';
import { promises as fs } from 'fs';
import * as path from 'path';
import type { StatusFileData } from './types.js';

const StatusFileSchema = z.object({
  status: z.string(),
  last_activity: z.string(),
  tool_calls: z.number().optional(),
  files_modified: z.array(z.string()).optional()
});

export interface StatusFileReadResult {
  available: boolean;
  path?: string;
  parsed: boolean;
  data?: StatusFileData;
  error?: string;
}

export class StatusProvider {
  private statusDir: string;

  constructor(statusDir?: string) {
    this.statusDir = statusDir || path.join(process.cwd(), '.terminal-status');
  }

  async ensureDir(): Promise<void> {
    try {
      await fs.mkdir(this.statusDir, { recursive: true });
    } catch {
      // Directory may already exist
    }
  }

  getStatusFilePath(terminalId: string): string {
    return path.join(this.statusDir, `${terminalId}.json`);
  }

  async writeStatus(terminalId: string, data: StatusFileData): Promise<string> {
    await this.ensureDir();
    const filePath = this.getStatusFilePath(terminalId);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return filePath;
  }

  async readStatusFile(filePath: string): Promise<StatusFileReadResult> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const json = JSON.parse(content);
      const result = StatusFileSchema.safeParse(json);

      if (!result.success) {
        return {
          available: true,
          path: filePath,
          parsed: false,
          error: `Schema validation failed: ${result.error.message}`
        };
      }

      return {
        available: true,
        path: filePath,
        parsed: true,
        data: result.data as StatusFileData
      };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return {
          available: false,
          path: filePath,
          parsed: false,
          error: 'File not found'
        };
      }
      if (error instanceof SyntaxError) {
        return {
          available: true,
          path: filePath,
          parsed: false,
          error: `Invalid JSON: ${error.message}`
        };
      }
      return {
        available: false,
        path: filePath,
        parsed: false,
        error: `Read error: ${error.message}`
      };
    }
  }

  async readStatus(terminalId: string): Promise<StatusFileReadResult> {
    const filePath = this.getStatusFilePath(terminalId);
    return this.readStatusFile(filePath);
  }

  async deleteStatus(terminalId: string): Promise<void> {
    const filePath = this.getStatusFilePath(terminalId);
    try {
      await fs.unlink(filePath);
    } catch {
      // File may not exist, ignore
    }
  }

  async cleanup(terminalIdsToKeep: Set<string>): Promise<number> {
    let removed = 0;
    try {
      const files = await fs.readdir(this.statusDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const terminalId = file.slice(0, -5);
        if (!terminalIdsToKeep.has(terminalId)) {
          await fs.unlink(path.join(this.statusDir, file));
          removed++;
        }
      }
    } catch {
      // Directory may not exist
    }
    return removed;
  }
}
