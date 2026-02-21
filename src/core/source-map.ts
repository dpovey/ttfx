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
// Source Map Preservation Helper
// =============================================================================

/**
 * Preserve source map information when replacing an original node with a new synthetic node.
 *
 * TypeScript's emitter uses source map ranges on AST nodes to generate source maps.
 * Synthetic nodes (created by macro expansion) have pos: -1, end: -1 by default,
 * which produces no source map entries. This helper copies the source map range
 * from the original macro call site to the expanded output, so debuggers and
 * stack traces point to the original source location.
 *
 * @param newNode - The synthetic node produced by macro expansion
 * @param originalNode - The original node (macro call site) being replaced
 * @returns The newNode with source map range set to originalNode's range
 *
 * @example
 * ```typescript
 * const expanded = macro.expand(ctx, node, args);
 * return preserveSourceMap(expanded, node);
 * ```
 */
export function preserveSourceMap<T extends ts.Node>(
  newNode: T,
  originalNode: ts.Node,
): T {
  ts.setSourceMapRange(newNode, ts.getSourceMapRange(originalNode));
  return newNode;
}

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

  /** Package that provided this macro (for audit trail) */
  sourcePackage?: string;

  /** Number of unhygienic identifiers introduced */
  unhygienicEscapes?: number;
}

/**
 * Patterns in expanded output that may indicate security concerns.
 * Used by the audit report to flag suspicious expansions.
 */
const SUSPICIOUS_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\beval\s*\(/, label: "eval()" },
  { pattern: /\bnew\s+Function\s*\(/, label: "new Function()" },
  {
    pattern: /\brequire\s*\(\s*['"]child_process['"]/,
    label: "require('child_process')",
  },
  { pattern: /\brequire\s*\(\s*['"]fs['"]/, label: "require('fs')" },
  { pattern: /\bprocess\.env\b/, label: "process.env access" },
  { pattern: /\bfetch\s*\(\s*['"]https?:\/\//, label: "network fetch" },
  { pattern: /\bimport\s*\(/, label: "dynamic import()" },
];

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
        package: e.sourcePackage,
      })),
    };
  }

  /**
   * Scan all expansions for suspicious patterns in expanded output.
   * Returns a list of flagged expansions with the matched pattern labels.
   */
  auditExpansions(): Array<{ record: ExpansionRecord; flags: string[] }> {
    const flagged: Array<{ record: ExpansionRecord; flags: string[] }> = [];

    for (const record of this.expansions) {
      const flags: string[] = [];
      for (const { pattern, label } of SUSPICIOUS_PATTERNS) {
        if (pattern.test(record.expandedText)) {
          flags.push(label);
        }
      }
      if (record.unhygienicEscapes && record.unhygienicEscapes > 0) {
        flags.push(`${record.unhygienicEscapes} unhygienic escape(s)`);
      }
      if (flags.length > 0) {
        flagged.push({ record, flags });
      }
    }

    return flagged;
  }

  /**
   * Generate a security audit report.
   * Lists all expansions with suspicious patterns flagged.
   */
  generateAuditReport(): string {
    const flagged = this.auditExpansions();

    if (flagged.length === 0 && this.expansions.length > 0) {
      return (
        `Security Audit: ${this.expansions.length} macro expansion(s), ` +
        `0 suspicious patterns detected.`
      );
    }

    if (this.expansions.length === 0) {
      return "Security Audit: No macro expansions recorded.";
    }

    const lines: string[] = [
      `Security Audit Report (${flagged.length} flagged / ${this.expansions.length} total)`,
      "=".repeat(70),
      "",
    ];

    for (const { record, flags } of flagged) {
      const pkg = record.sourcePackage ?? "unknown";
      lines.push(
        `  [${flags.join(", ")}]`,
        `  Macro: ${record.macroName} (from ${pkg})`,
        `  File:  ${record.originalFile}:${record.originalLine}`,
        `  Input: ${truncate(record.originalText, 80)}`,
        `  Output: ${truncate(record.expandedText, 80)}`,
        "",
      );
    }

    return lines.join("\n");
  }

  /**
   * Generate a JSON audit log suitable for CI diffing.
   * Deterministic output: sorted by file, then line, no timestamps.
   */
  toAuditJSON(): object {
    const sorted = [...this.expansions].sort((a, b) => {
      const fileCmp = a.originalFile.localeCompare(b.originalFile);
      if (fileCmp !== 0) return fileCmp;
      return a.originalLine - b.originalLine;
    });

    const flaggedSet = new Set(this.auditExpansions().map((f) => f.record));

    return {
      version: 1,
      totalExpansions: sorted.length,
      flaggedCount: flaggedSet.size,
      files: Object.fromEntries(
        groupBy(sorted, (e) => e.originalFile).map(([file, exps]) => [
          file,
          {
            expansions: exps.map((e) => ({
              macro: e.macroName,
              package: e.sourcePackage ?? "unknown",
              line: e.originalLine,
              original: e.originalText,
              expanded: e.expandedText,
              unhygienicEscapes: e.unhygienicEscapes ?? 0,
              flags: flaggedSet.has(e)
                ? (this.auditExpansions().find((f) => f.record === e)?.flags ??
                  [])
                : [],
            })),
          },
        ]),
      ),
    };
  }
}

function groupBy<T>(
  items: T[],
  keyFn: (item: T) => string,
): Array<[string, T[]]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const arr = map.get(key) ?? [];
    arr.push(item);
    map.set(key, arr);
  }
  return [...map.entries()];
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
