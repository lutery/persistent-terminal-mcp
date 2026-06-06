import { OutputFilter } from '../output-filter.js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const FIXTURES_DIR = resolve(__dirname, '../../tests/fixtures/tui-output');

function loadFixture(name: string): string {
  return readFileSync(resolve(FIXTURES_DIR, name), 'utf-8');
}

describe('OutputFilter', () => {
  let filter: OutputFilter;

  beforeEach(() => {
    filter = new OutputFilter();
  });

  describe('isSpinnerLine', () => {
    test('should detect braille spinner lines', () => {
      expect(filter.isSpinnerLine('⠋ Building project...')).toBe(true);
      expect(filter.isSpinnerLine('⠙ Building project...')).toBe(true);
      expect(filter.isSpinnerLine('⠹ Building project...')).toBe(true);
    });

    test('should detect progress bar lines', () => {
      expect(filter.isSpinnerLine('[=====>          ] 30% Compiling...')).toBe(true);
      expect(filter.isSpinnerLine('[==========>     ] 60% Compiling...')).toBe(true);
      expect(filter.isSpinnerLine('[===============>] 100% Done!')).toBe(true);
    });

    test('should not flag normal lines as spinner', () => {
      expect(filter.isSpinnerLine('src/index.ts compiled successfully')).toBe(false);
      expect(filter.isSpinnerLine('Error: Cannot find module')).toBe(false);
      expect(filter.isSpinnerLine('✓ 42 tests passed')).toBe(false);
    });

    test('should not flag empty lines as spinner', () => {
      expect(filter.isSpinnerLine('')).toBe(false);
      expect(filter.isSpinnerLine('   ')).toBe(false);
    });
  });

  describe('isBorderLine', () => {
    test('should detect box-drawing border lines', () => {
      expect(filter.isBorderLine('╭─────────────────────────────────╮')).toBe(true);
      expect(filter.isBorderLine('╰─────────────────────────────────╯')).toBe(true);
      expect(filter.isBorderLine('│                                 │')).toBe(true);
      expect(filter.isBorderLine('├─────────────────────────────────┤')).toBe(true);
    });

    test('should not flag lines with mixed content as border', () => {
      expect(filter.isBorderLine('│  Test Results                   │')).toBe(false);
      expect(filter.isBorderLine('src/index.ts compiled successfully')).toBe(false);
    });

    test('should not flag empty lines as border', () => {
      expect(filter.isBorderLine('')).toBe(false);
      expect(filter.isBorderLine('   ')).toBe(false);
    });
  });

  describe('isCriticalLine', () => {
    test('should detect error lines', () => {
      expect(filter.isCriticalLine('Error: Cannot find module')).toBe(true);
      expect(filter.isCriticalLine('error: something went wrong')).toBe(true);
      expect(filter.isCriticalLine('ERROR: critical failure')).toBe(true);
      expect(filter.isCriticalLine('Warning: deprecated API')).toBe(true);
      expect(filter.isCriticalLine('FAIL: test assertion')).toBe(true);
      expect(filter.isCriticalLine('failed to connect')).toBe(true);
      expect(filter.isCriticalLine('exception in thread main')).toBe(true);
      expect(filter.isCriticalLine('Traceback (most recent call last)')).toBe(true);
    });

    test('should detect file path lines', () => {
      expect(filter.isCriticalLine('src/index.ts compiled successfully')).toBe(true);
      expect(filter.isCriticalLine('src/output-filter.ts:42 - TypeError')).toBe(true);
      expect(filter.isCriticalLine('/home/user/project/main.py')).toBe(true);
      expect(filter.isCriticalLine('Reading src/auth/login.ts...')).toBe(true);
    });

    test('should detect test result lines', () => {
      expect(filter.isCriticalLine('✓ 42 tests passed')).toBe(true);
      expect(filter.isCriticalLine('✗ 3 tests failed')).toBe(true);
      expect(filter.isCriticalLine('✔ All tests pass')).toBe(true);
      expect(filter.isCriticalLine('3 tests passed')).toBe(true);
      expect(filter.isCriticalLine('2 tests failed')).toBe(true);
    });

    test('should detect code block markers', () => {
      expect(filter.isCriticalLine('```typescript')).toBe(true);
      expect(filter.isCriticalLine('```')).toBe(true);
    });

    test('should detect prompt symbols', () => {
      expect(filter.isCriticalLine('❯ fix the login bug')).toBe(true);
      expect(filter.isCriticalLine('user@host:~$ ')).toBe(true);
      expect(filter.isCriticalLine('root# ')).toBe(true);
      expect(filter.isCriticalLine('> ')).toBe(true);
    });

    test('should not flag empty lines as critical', () => {
      expect(filter.isCriticalLine('')).toBe(false);
      expect(filter.isCriticalLine('   ')).toBe(false);
    });
  });

  // UT-010: Filter noisy spinner content, preserve errors/file paths/test results
  describe('filterContent - UT-010: noisy spinner filtering', () => {
    test('should remove spinner/progress/border lines but preserve errors, file paths, and test results', () => {
      const input = loadFixture('noisy-spinner.txt');
      const { filtered, metadata } = filter.filterContent(input);

      // Spinner lines should be removed
      expect(filtered).not.toContain('⠋ Building project...');
      expect(filtered).not.toContain('⠙ Building project...');
      expect(filtered).not.toContain('⠹ Building project...');
      expect(filtered).not.toContain('⠸ Building project...');

      // Progress bar lines should be removed
      expect(filtered).not.toContain('[=====>          ] 30% Compiling...');
      expect(filtered).not.toContain('[==========>     ] 60% Compiling...');
      expect(filtered).not.toContain('[===============>] 100% Done!');

      // Border lines should be removed
      expect(filtered).not.toContain('╭─────────────────────────────────╮');
      expect(filtered).not.toContain('╰─────────────────────────────────╯');

      // Critical content should be preserved
      expect(filtered).toContain('Error: Cannot find module \'./missing.js\'');
      expect(filtered).toContain('✓ 42 tests passed');
      expect(filtered).toContain('✗ 3 tests failed');
      expect(filtered).toContain('src/output-filter.ts:42 - TypeError: undefined is not a function');

      // File path lines should be preserved
      expect(filtered).toContain('src/index.ts compiled successfully');
      expect(filtered).toContain('src/mcp-server.ts compiled successfully');

      // Metadata checks
      expect(metadata.mode).toBe('content_only');
      expect(metadata.removedLines).toBeGreaterThan(0);
    });
  });

  // UT-017: Verify ALL critical lines are preserved
  describe('filterContent - UT-017: critical line preservation', () => {
    test('should preserve ALL critical lines (Error, ✓, ✗, file paths)', () => {
      const input = loadFixture('noisy-spinner.txt');
      const { filtered, metadata } = filter.filterContent(input);

      // Every error line must be present
      expect(filtered).toMatch(/Error:/);

      // Every test result indicator must be present
      expect(filtered).toContain('✓');
      expect(filtered).toContain('✗');

      // Every file path must be present
      expect(filtered).toMatch(/src\/index\.ts/);
      expect(filtered).toMatch(/src\/mcp-server\.ts/);
      expect(filtered).toMatch(/src\/output-filter\.ts/);

      // Critical count should reflect preserved lines
      expect(metadata.criticalLineCount).toBeGreaterThan(0);
    });

    test('should preserve prompt lines in Claude Code session', () => {
      const input = loadFixture('claude-code-session.txt');
      const { filtered } = filter.filterContent(input);

      expect(filtered).toContain('❯ fix the login bug');
      expect(filtered).toMatch(/src\/auth\/login\.ts/);
      expect(filtered).toMatch(/src\/auth\/types\.ts/);
    });

    test('should preserve content in Codex session', () => {
      const input = loadFixture('codex-session.txt');
      const { filtered } = filter.filterContent(input);

      expect(filtered).toMatch(/src\/parser\.ts/);
      expect(filtered).toContain('Fix applied successfully');
    });
  });

  describe('filterContent - blank line collapsing', () => {
    test('should collapse consecutive blank lines to a single blank line', () => {
      const input = 'line1\n\n\n\nline2\n\n\n\nline3';
      const { filtered } = filter.filterContent(input);

      // Should not have more than one consecutive blank line
      expect(filtered).not.toContain('\n\n\n');
      expect(filtered).toContain('line1');
      expect(filtered).toContain('line2');
      expect(filtered).toContain('line3');
    });
  });

  describe('filterContent - ANSI stripping', () => {
    test('should handle ANSI escape sequences in input', () => {
      const input = '\x1b[32mSuccess\x1b[0m\n\x1b[31mError: bad\x1b[0m';
      const { filtered } = filter.filterContent(input);

      // Error line should be preserved (critical)
      expect(filtered).toMatch(/Error: bad/);
    });
  });

  describe('filterContent - metadata', () => {
    test('should return correct metadata with default adapter', () => {
      const { metadata } = filter.filterContent('hello world');
      expect(metadata.mode).toBe('content_only');
      expect(metadata.adapter).toBe('generic');
      expect(metadata.confidence).toBeDefined();
      expect(typeof metadata.removedLines).toBe('number');
      expect(typeof metadata.criticalLineCount).toBe('number');
    });

    test('should accept adapter option', () => {
      const { metadata } = filter.filterContent('hello', { adapter: 'claude' });
      expect(metadata.adapter).toBe('claude');
    });
  });

  describe('extractLastResponse', () => {
    test('should return tail snapshot with last_response mode for generic adapter', () => {
      const input = Array.from({ length: 60 }, (_, i) => `Line ${i + 1}`).join('\n');
      const { content, metadata } = filter.extractLastResponse(input, 'generic');

      expect(metadata.mode).toBe('last_response');
      expect(metadata.adapter).toBe('generic');
      expect(metadata.confidence).toBe('low');
      expect(content).toContain('Line 60');
      // Generic adapter returns last 50 lines as tail fallback
      expect(content).toContain('Line 11');
      expect(content).not.toContain('Line 10');
    });

    test('should default to generic adapter when none specified', () => {
      const input = Array.from({ length: 60 }, (_, i) => `Line ${i + 1}`).join('\n');
      const { metadata } = filter.extractLastResponse(input);

      expect(metadata.adapter).toBe('generic');
      expect(metadata.confidence).toBe('low');
    });

    // UT-011: Claude adapter with prompt separators
    test('UT-011: should extract response between prompts for claude adapter', () => {
      const input = [
        '❯ first prompt',
        'First response',
        '',
        '❯ second prompt',
        'Second response line 1',
        'Second response line 2',
        '',
        '❯ ',
      ].join('\n');
      const { content, metadata } = filter.extractLastResponse(input, 'claude');

      expect(metadata.mode).toBe('last_response');
      expect(metadata.adapter).toBe('claude');
      expect(metadata.confidence).toBe('high');
      expect(content).toContain('Second response line 1');
      expect(content).toContain('Second response line 2');
      expect(content).not.toContain('First response');
      expect(content).not.toContain('first prompt');
    });

    test('should return medium confidence when only one claude prompt found', () => {
      const input = [
        'Some initial content',
        '❯ second prompt',
        'Response after prompt',
        '❯ ',
      ].join('\n');
      const { content, metadata } = filter.extractLastResponse(input, 'claude');

      expect(metadata.confidence).toBe('high');
      expect(content).toContain('Response after prompt');
      expect(content).not.toContain('Some initial content');
    });

    test('should return medium confidence with single prompt and no prior prompt', () => {
      const input = [
        'Some initial content',
        'More content here',
        '❯ ',
      ].join('\n');
      const { content, metadata } = filter.extractLastResponse(input, 'claude');

      expect(metadata.confidence).toBe('medium');
      expect(content).toContain('Some initial content');
      expect(content).toContain('More content here');
    });

    test('should fall back to tail for claude adapter when no prompts found', () => {
      const input = Array.from({ length: 60 }, (_, i) => `Line ${i + 1}`).join('\n');
      const { content, metadata } = filter.extractLastResponse(input, 'claude');

      expect(metadata.confidence).toBe('low');
      expect(metadata.adapter).toBe('claude');
      expect(content).toContain('Line 60');
    });

    test('should extract response using codex markers', () => {
      const input = [
        '○ Analyzing...',
        'Analysis result',
        '',
        '● Fix applied',
        '',
        'Changes:',
        '- src/parser.ts: Fixed XML handling',
        '',
        '○ Running tests...',
        '● All tests pass',
      ].join('\n');
      const { content, metadata } = filter.extractLastResponse(input, 'codex');

      expect(metadata.mode).toBe('last_response');
      expect(metadata.adapter).toBe('codex');
      expect(metadata.confidence).toBe('high');
      expect(content).toContain('All tests pass');
    });

    test('should return medium confidence for codex with single completed marker', () => {
      const input = [
        'Some preamble',
        '● Fix applied',
      ].join('\n');
      const { content, metadata } = filter.extractLastResponse(input, 'codex');

      expect(metadata.confidence).toBe('medium');
      expect(content).toContain('Fix applied');
    });

    // UT-012: Unknown format returns low-confidence fallback
    test('UT-012: should return low confidence fallback for unknown format', () => {
      const input = Array.from({ length: 80 }, (_, i) => `Line ${i + 1}`).join('\n');
      const { content, metadata } = filter.extractLastResponse(input, 'claude');

      // No ❯ prompts -> should fall back to tail with low confidence
      expect(metadata.mode).toBe('last_response');
      expect(metadata.confidence).toBe('low');
      expect(metadata.removedLines).toBeGreaterThan(0);
      expect(content).toContain('Line 80');
    });

    test('should return low confidence fallback for codex with no markers', () => {
      const input = Array.from({ length: 80 }, (_, i) => `Line ${i + 1}`).join('\n');
      const { metadata } = filter.extractLastResponse(input, 'codex');

      expect(metadata.confidence).toBe('low');
    });

    test('should count critical lines in extracted response', () => {
      const input = [
        '❯ prompt',
        'Normal line',
        'Error: something failed',
        'src/file.ts:10 - issue',
        '❯ ',
      ].join('\n');
      const { metadata } = filter.extractLastResponse(input, 'claude');

      expect(metadata.criticalLineCount).toBeGreaterThanOrEqual(2);
    });

    test('should trim extracted content', () => {
      const input = [
        '❯ prompt',
        '',
        '',
        'Response content',
        '',
        '',
        '❯ ',
      ].join('\n');
      const { content } = filter.extractLastResponse(input, 'claude');

      expect(content.trim()).toBe(content);
    });
  });
});
