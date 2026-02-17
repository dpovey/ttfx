/**
 * Source Map Support for Macro Expansions
 *
 * Tracks the mapping between original source locations and macro-expanded
 * code locations. This enables:
 * - Debugger breakpoints in original source
 * - Error stack traces pointing to original code
 * - IDE "go to definition" through macro expansions
 *
 * Inspired by: Babel source maps, Rust proc-macro spans, C++ #line directives
 *
 * @example
 * ```typescript
 * const tracker = new ExpansionTracker();
 *
 * // Record a macro expansion
 * tracker.recordExpansion({
 *   macroName: "comptime",
 *   originalFile: "src/app.ts",
 *   originalLine: 42,
 *   originalColumn: 5,
 *   expandedText: "25",
 *   originalText: "comptime(() => 5 * 5)",
 * });
 *
 * // Generate source map
 * const sourceMap = tracker.generateSourceMap("src/app.ts");
 * ```
 */

import * as ts from "typescript";

// =============================================================================
// Expansion Record
// =============================================================================

/**
 * Records a single macro expansion event.
 */
export interface ExpansionRecord {
  /** Name of the macro that was expanded */
  macroName: string;

  /** Original source file path */
  originalFile: string;

  /** Line number in the original source (1-based) */
  originalLine: number;

  /** Column number in the original source (0-based) */
  originalColumn: number;

  /** The original source text that was replaced */
  originalText: string;

  /** The expanded output text */
  expandedText: string;

  /** Timestamp of the expansion */
  timestamp: number;

  /** Whether the expansion was from cache */
  fromCache: boolean;
}

// =============================================================================
// Expansion Tracker
// =============================================================================

/**
 * Tracks all macro expansions during a compilation for source map generation
 * and debugging support.
 */
export class ExpansionTracker {
  private expansions: ExpansionRecord[] = [];

  /**
   * Record a macro expansion.
   */
  recordExpansion(
    macroName: string,
    originalNode: ts.Node,
    sourceFile: ts.SourceFile,
    expandedText: string,
    fromCache: boolean = false,
  ): void {
    const start = originalNode.getStart(sourceFile);
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(start);

    let originalText: string;
    try {
      originalText = originalNode.getText(sourceFile);
    } catch {
      originalText = "<synthetic node>";
    }

    this.expansions.push({
      macroName,
      originalFile: sourceFile.fileName,
      originalLine: line + 1,
      originalColumn: character,
      originalText,
      expandedText,
      timestamp: Date.now(),
      fromCache,
    });
  }

  /**
   * Get all expansions for a specific file.
   */
  getExpansionsForFile(fileName: string): ExpansionRecord[] {
    return this.expansions.filter((e) => e.originalFile === fileName);
  }

  /**
   * Get all expansions.
   */
  getAllExpansions(): ReadonlyArray<ExpansionRecord> {
    return this.expansions;
  }

  /**
   * Get expansion count.
   */
  get count(): number {
    return this.expansions.length;
  }

  /**
   * Clear all recorded expansions.
   */
  clear(): void {
    this.expansions = [];
  }

  /**
   * Generate a human-readable expansion report.
   */
  generateReport(): string {
    if (this.expansions.length === 0) {
      return "No macro expansions recorded.";
    }

    const lines: string[] = [
      `Macro Expansion Report (${this.expansions.length} expansions)`,
      "=".repeat(60),
      "",
    ];

    // Group by file
    const byFile = new Map<string, ExpansionRecord[]>();
    for (const exp of this.expansions) {
      const existing = byFile.get(exp.originalFile) ?? [];
      existing.push(exp);
      byFile.set(exp.originalFile, existing);
    }

    for (const [file, exps] of byFile) {
      lines.push(`File: ${file}`);
      lines.push("-".repeat(40));

      for (const exp of exps) {
        const cached = exp.fromCache ? " [cached]" : "";
        lines.push(`  Line ${exp.originalLine}: ${exp.macroName}${cached}`);
        lines.push(`    Original: ${truncate(exp.originalText, 80)}`);
        lines.push(`    Expanded: ${truncate(exp.expandedText, 80)}`);
        lines.push("");
      }
    }

    // Summary
    const macroCount = new Map<string, number>();
    let cachedCount = 0;
    for (const exp of this.expansions) {
      macroCount.set(exp.macroName, (macroCount.get(exp.macroName) ?? 0) + 1);
      if (exp.fromCache) cachedCount++;
    }

    lines.push("Summary:");
    lines.push("-".repeat(40));
    for (const [name, count] of macroCount) {
      lines.push(`  ${name}: ${count} expansion${count === 1 ? "" : "s"}`);
    }
    if (cachedCount > 0) {
      lines.push(`  (${cachedCount} from cache)`);
    }

    return lines.join("\n");
  }

  /**
   * Generate a JSON-serializable expansion map.
   * Useful for IDE integration and tooling.
   */
  toJSON(): object {
    return {
      version: 1,
      expansions: this.expansions.map((e) => ({
        macro: e.macroName,
        file: e.originalFile,
        line: e.originalLine,
        column: e.originalColumn,
        original: e.originalText,
        expanded: e.expandedText,
        cached: e.fromCache,
      })),
    };
  }
}

/**
 * Truncate a string for display.
 */
function truncate(str: string, maxLen: number): string {
  const oneLine = str.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLen) return oneLine;
  return oneLine.slice(0, maxLen - 3) + "...";
}

/**
 * Global expansion tracker singleton.
 */
export const globalExpansionTracker = new ExpansionTracker();
