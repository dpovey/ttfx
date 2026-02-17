/**
 * Tests for fine-grained mode expansion
 */

import { describe, it, expect } from "vitest";
import { DEFAULT_CONFIG, type ReactMacroConfig } from "../../src/use-cases/react/types.js";
import {
  createSignal,
  createComputed,
  createEffect,
  batch,
  untrack,
} from "../../src/use-cases/react/runtime/signals.js";
import { KeyedList, createKeyedList } from "../../src/use-cases/react/runtime/reconciler.js";

// Mock configuration for fine-grained mode
const fineGrainedConfig: ReactMacroConfig = {
  ...DEFAULT_CONFIG,
  mode: "fine-grained",
};

describe("Fine-grained mode expansion", () => {
  describe("config", () => {
    it("should understand fine-grained config option exists", () => {
      expect(fineGrainedConfig.mode).toBe("fine-grained");
      expect(fineGrainedConfig.optimizeRendering).toBe(true);
    });
  });

  describe("signal runtime exports", () => {
    it("should export createSignal", () => {
      expect(typeof createSignal).toBe("function");
    });

    it("should export createComputed", () => {
      expect(typeof createComputed).toBe("function");
    });

    it("should export createEffect", () => {
      expect(typeof createEffect).toBe("function");
    });

    it("should export batch", () => {
      expect(typeof batch).toBe("function");
    });

    it("should export untrack", () => {
      expect(typeof untrack).toBe("function");
    });
  });

  describe("basic signal functionality", () => {
    it("should create a working signal", () => {
      const [count, setCount] = createSignal(0);
      
      expect(count()).toBe(0);
      setCount(1);
      expect(count()).toBe(1);
      setCount((v: number) => v + 1);
      expect(count()).toBe(2);
    });

    it("should create reactive computed values", () => {
      const [count, setCount] = createSignal(1);
      const doubled = createComputed(() => count() * 2);
      
      expect(doubled()).toBe(2);
      setCount(5);
      expect(doubled()).toBe(10);
    });
  });

  describe("reconciler exports", () => {
    it("should export KeyedList component", () => {
      expect(typeof KeyedList).toBe("function");
    });

    it("should export createKeyedList factory", () => {
      expect(typeof createKeyedList).toBe("function");
    });
  });
});
