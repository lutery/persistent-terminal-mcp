import { OutputFilterMetadata } from './types.js';

export interface ContentFilterOptions {
  adapter?: 'generic' | 'claude' | 'codex';
}

/**
 * OutputFilter performs conservative noise removal from terminal output,
 * following the principle that correctness is more important than compression.
 * When unsure whether to remove a line, it is kept and confidence is lowered.
 */
export class OutputFilter {
  // Spinner characters: braille, circles, blocks, classic ASCII, bralette
  private static readonly SPINNER_CHARS = new Set([
    // Braille spinners - all common braille pattern dots (U+2800-U+28FF)
    // Single dot patterns
    '⠁', '⠂', '⠃', '⠄', '⠅', '⠆', '⠇', '⠈', '⠉', '⠊', '⠋',
    '⠌', '⠍', '⠎', '⠏', '⠐', '⠑', '⠒', '⠓', '⠔', '⠕', '⠖',
    '⠗', '⠘', '⠙', '⠚', '⠛', '⠜', '⠝', '⠞', '⠟',
    // Multi-dot braille patterns commonly used in spinners
    '⠠', '⠡', '⠢', '⠣', '⠤', '⠥', '⠦', '⠧', '⠨', '⠩', '⠪',
    '⠫', '⠬', '⠭', '⠮', '⠯', '⠰', '⠱', '⠲', '⠳', '⠴', '⠵',
    '⠶', '⠷', '⠸', '⠹', '⠺', '⠻', '⠼', '⠽', '⠾', '⠿',
    // Circle spinners (rotating, not bullet-like)
    '◐', '◓', '◑', '◒',
    // Block spinners
    '╸', '╺', '╾', '╼',
    // Classic ASCII spinners
    '|', '/', '-', '\\',
    // Bralette spinners
    '⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷',
  ]);

  // Box-drawing characters used in diff borders
  private static readonly BOX_DRAWING_CHARS = new Set([
    '╭', '╮', '╰', '╯', '─', '│', '├', '┤', '┬', '┴', '┼',
    // Also include ASCII box-drawing variants
    '┌', '┐', '└', '┘',
  ]);

  // ANSI escape sequence regex
  private static readonly ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]/g;

  // Progress bar pattern: [=====>    ] 50%
  private static readonly PROGRESS_BAR_REGEX = /^\s*\[[=<>#*\-.\s]+\]\s*\d+%/;

  /**
   * Filter content by removing noise (spinners, borders, ANSI) while
   * preserving all critical lines (errors, file paths, test results, etc.)
   */
  filterContent(rawText: string, options?: ContentFilterOptions): {
    filtered: string;
    metadata: OutputFilterMetadata;
  } {
    const adapter = options?.adapter ?? 'generic';
    const lines = rawText.split('\n');
    const keptLines: string[] = [];
    let removedLines = 0;
    let criticalLineCount = 0;
    let confidence: 'low' | 'medium' | 'high' = 'high';

    let prevBlank = false;

    for (const line of lines) {
      // Strip ANSI for analysis
      const stripped = this.stripAnsi(line);
      const trimmed = stripped.trim();

      // Always preserve critical lines
      if (this.isCriticalLine(stripped)) {
        criticalLineCount++;
        // Collapse consecutive blank lines even around critical content
        if (trimmed.length === 0) {
          if (!prevBlank) {
            keptLines.push('');
            prevBlank = true;
          }
          continue;
        }
        keptLines.push(line);
        prevBlank = false;
        continue;
      }

      // Remove spinner/progress lines
      if (this.isSpinnerLine(stripped)) {
        removedLines++;
        // Lower confidence if we're unsure about a removal
        if (trimmed.length > 0 && !this.isProgressOnly(stripped)) {
          confidence = 'medium';
        }
        continue;
      }

      // Remove border lines (only box-drawing chars + whitespace)
      if (this.isBorderLine(stripped)) {
        removedLines++;
        continue;
      }

      // Collapse consecutive blank lines to a single blank line
      if (trimmed.length === 0) {
        if (!prevBlank) {
          keptLines.push('');
          prevBlank = true;
        } else {
          removedLines++;
        }
        continue;
      }

      // Keep all other lines
      keptLines.push(line);
      prevBlank = false;
    }

    // If we removed very few lines, confidence stays high
    // If we removed many lines but had many critical lines, medium confidence
    if (removedLines > 0 && criticalLineCount === 0 && confidence === 'high') {
      confidence = 'medium';
    }

    return {
      filtered: keptLines.join('\n'),
      metadata: {
        mode: 'content_only',
        adapter,
        confidence,
        removedLines,
        criticalLineCount,
      },
    };
  }

  /**
   * Extract the last AI response from terminal output using adapter-specific
   * heuristics. Falls back to a tail snapshot when no adapter markers are found.
   */
  extractLastResponse(rawText: string, adapter: 'generic' | 'claude' | 'codex' = 'generic'): {
    content: string;
    metadata: OutputFilterMetadata;
  } {
    const lines = rawText.split('\n');

    if (adapter === 'claude') {
      // Claude Code CLI uses ❯ as prompt separator.
      // The response comes BEFORE the prompt, so we extract the block
      // between the second-to-last and last ❯.
      let lastPromptIdx = -1;
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i]!.includes('❯')) {
          lastPromptIdx = i;
          break;
        }
      }

      if (lastPromptIdx >= 0) {
        // Find the second-to-last ❯
        let secondLastPromptIdx = -1;
        for (let i = lastPromptIdx - 1; i >= 0; i--) {
          if (lines[i]!.includes('❯')) {
            secondLastPromptIdx = i;
            break;
          }
        }

        if (secondLastPromptIdx >= 0) {
          const responseLines = lines.slice(secondLastPromptIdx + 1, lastPromptIdx);
          const content = responseLines.join('\n').trim();
          return {
            content,
            metadata: {
              mode: 'last_response',
              adapter: 'claude',
              confidence: 'high',
              removedLines: lines.length - responseLines.length,
              criticalLineCount: this.countCriticalLines(responseLines),
            },
          };
        }

        // Only one prompt found - return everything before it
        const responseLines = lines.slice(0, lastPromptIdx);
        const content = responseLines.join('\n').trim();
        return {
          content,
          metadata: {
            mode: 'last_response',
            adapter: 'claude',
            confidence: 'medium',
            removedLines: lines.length - responseLines.length,
            criticalLineCount: this.countCriticalLines(responseLines),
          },
        };
      }

      // No prompt found - fallback to tail
      return this.tailFallback(lines, adapter);
    }

    if (adapter === 'codex') {
      // Codex uses ○ (pending) and ● (completed) as task separators
      let lastCompletedIdx = -1;
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i]!.includes('●')) {
          lastCompletedIdx = i;
          break;
        }
      }

      if (lastCompletedIdx >= 0) {
        // Find the previous ○ or ●
        let prevMarkerIdx = -1;
        for (let i = lastCompletedIdx - 1; i >= 0; i--) {
          if (lines[i]!.includes('○') || lines[i]!.includes('●')) {
            prevMarkerIdx = i;
            break;
          }
        }

        const startIdx = prevMarkerIdx >= 0 ? prevMarkerIdx + 1 : 0;
        const responseLines = lines.slice(startIdx, lastCompletedIdx + 1);
        const content = responseLines.join('\n').trim();
        return {
          content,
          metadata: {
            mode: 'last_response',
            adapter: 'codex',
            confidence: prevMarkerIdx >= 0 ? 'high' : 'medium',
            removedLines: lines.length - responseLines.length,
            criticalLineCount: this.countCriticalLines(responseLines),
          },
        };
      }

      return this.tailFallback(lines, adapter);
    }

    // Generic adapter - return tail snapshot
    return this.tailFallback(lines, adapter);
  }

  private tailFallback(lines: string[], adapter: 'generic' | 'claude' | 'codex'): {
    content: string;
    metadata: OutputFilterMetadata;
  } {
    const tailCount = Math.min(50, lines.length);
    const tailLines = lines.slice(-tailCount);
    return {
      content: tailLines.join('\n'),
      metadata: {
        mode: 'last_response',
        adapter,
        confidence: 'low',
        removedLines: lines.length - tailCount,
        criticalLineCount: this.countCriticalLines(tailLines),
      },
    };
  }

  private countCriticalLines(lines: string[]): number {
    return lines.filter(line => this.isCriticalLine(line)).length;
  }

  /**
   * Check if a line is a spinner/animation line.
   * A line is considered a spinner if, after stripping ANSI:
   * - It matches a progress bar pattern, OR
   * - It starts with a spinner character followed by a space (common pattern), OR
   * - >30% of visible characters are spinner characters
   */
  isSpinnerLine(line: string): boolean {
    const stripped = this.stripAnsi(line);
    const trimmed = stripped.trim();

    if (trimmed.length === 0) {
      return false;
    }

    // Check progress bar pattern first
    if (OutputFilter.PROGRESS_BAR_REGEX.test(trimmed)) {
      return true;
    }

    // Check if line starts with a spinner char followed by a space
    // This catches patterns like "⠋ Building project..." where the spinner
    // density is low but the pattern is clearly a spinner animation frame
    const firstChar = trimmed[0];
    if (firstChar && OutputFilter.SPINNER_CHARS.has(firstChar)) {
      const rest = trimmed.slice(1);
      // Spinner char followed by space and text is the classic CLI spinner pattern
      if (/^\s/.test(rest)) {
        return true;
      }
    }

    // Count visible characters and spinner characters
    let visibleChars = 0;
    let spinnerChars = 0;

    for (const char of trimmed) {
      // Skip whitespace
      if (char === ' ' || char === '\t') {
        continue;
      }
      visibleChars++;
      if (OutputFilter.SPINNER_CHARS.has(char)) {
        spinnerChars++;
      }
    }

    if (visibleChars === 0) {
      return false;
    }

    // If >30% of visible chars are spinner chars, it's a spinner line
    return (spinnerChars / visibleChars) > 0.3;
  }

  /**
   * Check if a line consists entirely of box-drawing characters and whitespace.
   */
  isBorderLine(line: string): boolean {
    const stripped = this.stripAnsi(line);
    const trimmed = stripped.trim();

    if (trimmed.length === 0) {
      return false;
    }

    // Every non-whitespace character must be a box-drawing character
    for (const char of trimmed) {
      if (char === ' ' || char === '\t') {
        continue;
      }
      if (!OutputFilter.BOX_DRAWING_CHARS.has(char)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if a line contains critical content that must be preserved.
   */
  isCriticalLine(line: string): boolean {
    const stripped = this.stripAnsi(line);
    const trimmed = stripped.trim();

    // Empty lines are not critical (but we handle blank collapsing separately)
    if (trimmed.length === 0) {
      return false;
    }

    // Error/warning indicators
    const errorPatterns = [
      /\berror\b/i,
      /\bwarn(ing)?\b/i,
      /\bFAIL(ed)?\b/i,
      /\bexception\b/i,
      /\btrace\b/i,
      /\bTraceback\b/,
    ];
    for (const pattern of errorPatterns) {
      if (pattern.test(trimmed)) {
        return true;
      }
    }

    // File paths: lines containing / or \ followed by common extensions
    if (/[\/\\][\w.-]+\.(ts|js|py|tsx|jsx|json|yaml|yml|md|txt|sh|bash|zsh|c|cpp|h|hpp|rs|go|java|rb|php|css|html|sql|xml|toml|ini|cfg|conf|env|lock)\b/.test(trimmed)) {
      return true;
    }

    // Also detect file paths at start of line (e.g., "src/output-filter.ts:42")
    if (/^[\w.\/\\-]+\.(ts|js|py|tsx|jsx|json|yaml|yml|md|txt|sh|bash|c|cpp|h|hpp|rs|go|java|rb|php|css|html|sql|xml|toml|ini|cfg|conf|env|lock)[:\s]/.test(trimmed)) {
      return true;
    }

    // Test results
    if (/[✓✔✗✘]/.test(trimmed)) {
      return true;
    }
    if (/\bpassed\b/i.test(trimmed) || /\bfailed\b/i.test(trimmed)) {
      return true;
    }

    // Code markers (fenced code blocks)
    if (/^```/.test(trimmed)) {
      return true;
    }

    // Prompt symbols: >, $, #, ❯
    // Match at end of line (e.g., "user@host$ ", "root# ")
    if (/[>$#❯]\s*$/.test(trimmed)) {
      return true;
    }
    // Match at start of line followed by space and text (e.g., "❯ fix the bug", "> do something")
    if (/^[>$#❯]\s+\S/.test(trimmed)) {
      return true;
    }

    return false;
  }

  /**
   * Strip ANSI escape sequences from a string.
   */
  private stripAnsi(text: string): string {
    return text.replace(OutputFilter.ANSI_REGEX, '');
  }

  /**
   * Check if a line is purely a progress bar (no other meaningful content).
   */
  private isProgressOnly(line: string): boolean {
    const stripped = this.stripAnsi(line);
    const trimmed = stripped.trim();
    // If the line is just a progress bar pattern with no other text
    return /^\s*\[[=<>#*\-.\s]+\]\s*\d+%\s*$/.test(trimmed);
  }
}
