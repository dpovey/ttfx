/**
 * Tests for source map generation in the macro transformer
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as ts from "typescript";
import { preserveSourceMap, ExpansionTracker, type RawSourceMap } from "@typesugar/core";

describe("preserveSourceMap", () => {
  it("should copy source map range from original to new node", () => {
    const sourceCode = "const x = comptime(() => 5 * 5);";
    const sourceFile = ts.createSourceFile("test.ts", sourceCode, ts.ScriptTarget.Latest, true);

    // Find the call expression node
    let originalNode: ts.Node | undefined;
    ts.forEachChild(sourceFile, (node) => {
      if (ts.isVariableStatement(node)) {
        const decl = node.declarationList.declarations[0];
        if (decl.initializer && ts.isCallExpression(decl.initializer)) {
          originalNode = decl.initializer;
        }
      }
    });
    expect(originalNode).toBeDefined();

    // Create a synthetic node (numeric literal)
    const factory = ts.factory;
    const newNode = factory.createNumericLiteral("25");

    // Apply preserveSourceMap
    const mapped = preserveSourceMap(newNode, originalNode!);

    // Verify the source map range was set
    const range = ts.getSourceMapRange(mapped);
    const originalRange = ts.getSourceMapRange(originalNode!);
    expect(range.pos).toBe(originalRange.pos);
    expect(range.end).toBe(originalRange.end);
  });

  it("should return the same node reference", () => {
    const sourceFile = ts.createSourceFile("test.ts", "const x = 1;", ts.ScriptTarget.Latest, true);
    const originalNode = sourceFile.statements[0];
    const factory = ts.factory;
    const newNode = factory.createNumericLiteral("42");

    const result = preserveSourceMap(newNode, originalNode);
    expect(result).toBe(newNode);
  });
});

describe("ExpansionTracker", () => {
  let tracker: ExpansionTracker;

  beforeEach(() => {
    tracker = new ExpansionTracker();
  });

  describe("recordExpansion", () => {
    it("should record expansion with byte offsets", () => {
      const sourceCode = "const x = comptime(() => 5 * 5);";
      const sourceFile = ts.createSourceFile("test.ts", sourceCode, ts.ScriptTarget.Latest, true);

      // Find the call expression
      let callNode: ts.CallExpression | undefined;
      ts.forEachChild(sourceFile, (node) => {
        if (ts.isVariableStatement(node)) {
          const decl = node.declarationList.declarations[0];
          if (decl.initializer && ts.isCallExpression(decl.initializer)) {
            callNode = decl.initializer;
          }
        }
      });
      expect(callNode).toBeDefined();

      tracker.recordExpansion("comptime", callNode!, sourceFile, "25");

      const expansions = tracker.getAllExpansions();
      expect(expansions).toHaveLength(1);

      const exp = expansions[0];
      expect(exp.macroName).toBe("comptime");
      expect(exp.originalFile).toBe("test.ts");
      expect(exp.originalStart).toBeGreaterThan(0);
      expect(exp.originalEnd).toBeGreaterThan(exp.originalStart);
      expect(exp.expandedText).toBe("25");
    });
  });

  describe("generateSourceMap", () => {
    it("should return null when no expansions recorded", () => {
      const map = tracker.generateSourceMap("const x = 1;", "test.ts");
      expect(map).toBeNull();
    });

    it("should return null when no expansions for the given file", () => {
      const sourceCode = "const x = comptime(() => 5 * 5);";
      const sourceFile = ts.createSourceFile("other.ts", sourceCode, ts.ScriptTarget.Latest, true);

      // Record expansion for a different file
      let callNode: ts.CallExpression | undefined;
      ts.forEachChild(sourceFile, (node) => {
        if (ts.isVariableStatement(node)) {
          const decl = node.declarationList.declarations[0];
          if (decl.initializer && ts.isCallExpression(decl.initializer)) {
            callNode = decl.initializer;
          }
        }
      });
      tracker.recordExpansion("comptime", callNode!, sourceFile, "25");

      // Request map for a different file
      const map = tracker.generateSourceMap(sourceCode, "test.ts");
      expect(map).toBeNull();
    });

    it("should generate valid v3 source map with single expansion", () => {
      const sourceCode = "const x = comptime(() => 5 * 5);";
      const sourceFile = ts.createSourceFile("test.ts", sourceCode, ts.ScriptTarget.Latest, true);

      let callNode: ts.CallExpression | undefined;
      ts.forEachChild(sourceFile, (node) => {
        if (ts.isVariableStatement(node)) {
          const decl = node.declarationList.declarations[0];
          if (decl.initializer && ts.isCallExpression(decl.initializer)) {
            callNode = decl.initializer;
          }
        }
      });
      expect(callNode).toBeDefined();

      tracker.recordExpansion("comptime", callNode!, sourceFile, "25");

      const map = tracker.generateSourceMap(sourceCode, "test.ts");
      expect(map).not.toBeNull();

      // Verify v3 source map structure
      expect(map!.version).toBe(3);
      expect(map!.sources).toContain("test.ts");
      expect(typeof map!.mappings).toBe("string");
      expect(map!.mappings.length).toBeGreaterThan(0);
    });

    it("should generate source map with multiple non-overlapping expansions", () => {
      const sourceCode = "const x = comptime(() => 1); const y = comptime(() => 2);";
      const sourceFile = ts.createSourceFile("test.ts", sourceCode, ts.ScriptTarget.Latest, true);

      // Find both call expressions
      const callNodes: ts.CallExpression[] = [];
      ts.forEachChild(sourceFile, (node) => {
        if (ts.isVariableStatement(node)) {
          for (const decl of node.declarationList.declarations) {
            if (decl.initializer && ts.isCallExpression(decl.initializer)) {
              callNodes.push(decl.initializer);
            }
          }
        }
      });
      expect(callNodes).toHaveLength(2);

      tracker.recordExpansion("comptime", callNodes[0], sourceFile, "1");
      tracker.recordExpansion("comptime", callNodes[1], sourceFile, "2");

      const map = tracker.generateSourceMap(sourceCode, "test.ts");
      expect(map).not.toBeNull();
      expect(map!.version).toBe(3);
      expect(map!.mappings.length).toBeGreaterThan(0);
    });

    it("should handle nested expansions by only applying outermost", () => {
      const sourceCode = "const x = outer(inner(1));";
      const sourceFile = ts.createSourceFile("test.ts", sourceCode, ts.ScriptTarget.Latest, true);

      // Find the outer and inner call expressions
      let outerCall: ts.CallExpression | undefined;
      let innerCall: ts.CallExpression | undefined;

      ts.forEachChild(sourceFile, (node) => {
        if (ts.isVariableStatement(node)) {
          const decl = node.declarationList.declarations[0];
          if (decl.initializer && ts.isCallExpression(decl.initializer)) {
            outerCall = decl.initializer;
            if (outerCall.arguments.length > 0 && ts.isCallExpression(outerCall.arguments[0])) {
              innerCall = outerCall.arguments[0];
            }
          }
        }
      });
      expect(outerCall).toBeDefined();
      expect(innerCall).toBeDefined();

      // Record both expansions (inner first, then outer)
      tracker.recordExpansion("inner", innerCall!, sourceFile, "wrapped(1)");
      tracker.recordExpansion("outer", outerCall!, sourceFile, "result");

      const map = tracker.generateSourceMap(sourceCode, "test.ts");
      expect(map).not.toBeNull();
      expect(map!.version).toBe(3);
    });

    it("should include sources content when includeContent is true", () => {
      const sourceCode = "const x = comptime(() => 5);";
      const sourceFile = ts.createSourceFile("test.ts", sourceCode, ts.ScriptTarget.Latest, true);

      let callNode: ts.CallExpression | undefined;
      ts.forEachChild(sourceFile, (node) => {
        if (ts.isVariableStatement(node)) {
          const decl = node.declarationList.declarations[0];
          if (decl.initializer && ts.isCallExpression(decl.initializer)) {
            callNode = decl.initializer;
          }
        }
      });

      tracker.recordExpansion("comptime", callNode!, sourceFile, "5");

      const map = tracker.generateSourceMap(sourceCode, "test.ts");
      expect(map).not.toBeNull();
      expect(map!.sourcesContent).toBeDefined();
      expect(map!.sourcesContent![0]).toBe(sourceCode);
    });
  });

  describe("clear", () => {
    it("should remove all recorded expansions", () => {
      const sourceFile = ts.createSourceFile(
        "test.ts",
        "const x = macro();",
        ts.ScriptTarget.Latest,
        true
      );

      // Find a node to record
      const node = sourceFile.statements[0];
      tracker.recordExpansion("macro", node, sourceFile, "result");

      expect(tracker.count).toBe(1);
      tracker.clear();
      expect(tracker.count).toBe(0);
    });
  });
});
