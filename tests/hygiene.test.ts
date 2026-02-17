/**
 * Tests for the macro hygiene system
 */

import { describe, it, expect, beforeEach } from "vitest";
import { HygieneContext } from "../src/core/hygiene.js";

describe("macro hygiene system", () => {
  let hygiene: HygieneContext;

  beforeEach(() => {
    hygiene = new HygieneContext();
  });

  describe("scope management", () => {
    it("should report not in scope at top level", () => {
      expect(hygiene.isInScope()).toBe(false);
    });

    it("should report in scope inside withScope", () => {
      hygiene.withScope(() => {
        expect(hygiene.isInScope()).toBe(true);
      });
      expect(hygiene.isInScope()).toBe(false);
    });

    it("should track scope depth", () => {
      expect(hygiene.getScopeDepth()).toBe(0);

      hygiene.withScope(() => {
        expect(hygiene.getScopeDepth()).toBe(1);

        hygiene.withScope(() => {
          expect(hygiene.getScopeDepth()).toBe(2);
        });

        expect(hygiene.getScopeDepth()).toBe(1);
      });

      expect(hygiene.getScopeDepth()).toBe(0);
    });
  });

  describe("name mangling", () => {
    it("should mangle names inside a scope", () => {
      hygiene.withScope(() => {
        const name = hygiene.mangleName("temp");
        expect(name).toMatch(/^__typemacro_temp_s\d+_\d+__$/);
      });
    });

    it("should return the same mangled name for the same input in the same scope", () => {
      hygiene.withScope(() => {
        const name1 = hygiene.mangleName("temp");
        const name2 = hygiene.mangleName("temp");
        expect(name1).toBe(name2);
      });
    });

    it("should return different mangled names for different inputs", () => {
      hygiene.withScope(() => {
        const name1 = hygiene.mangleName("a");
        const name2 = hygiene.mangleName("b");
        expect(name1).not.toBe(name2);
      });
    });

    it("should return different mangled names in different scopes", () => {
      let name1: string;
      let name2: string;

      hygiene.withScope(() => {
        name1 = hygiene.mangleName("temp");
      });

      hygiene.withScope(() => {
        name2 = hygiene.mangleName("temp");
      });

      expect(name1!).not.toBe(name2!);
    });

    it("should mangle names outside scope with global counter", () => {
      const name1 = hygiene.mangleName("x");
      const name2 = hygiene.mangleName("x");
      expect(name1).toMatch(/^__typemacro_x_\d+__$/);
      expect(name1).not.toBe(name2); // Different because no scope caching
    });
  });

  describe("identifier creation", () => {
    it("should create hygienic identifiers", () => {
      hygiene.withScope(() => {
        const id = hygiene.createIdentifier("result");
        expect(id.text).toMatch(/^__typemacro_result_s\d+_\d+__$/);
      });
    });

    it("should create unhygienic identifiers", () => {
      const id = hygiene.createUnhygienicIdentifier("result");
      expect(id.text).toBe("result");
    });
  });

  describe("scope introspection", () => {
    it("should track introduced names", () => {
      hygiene.withScope(() => {
        expect(hygiene.isIntroducedInCurrentScope("temp")).toBe(false);
        hygiene.mangleName("temp");
        expect(hygiene.isIntroducedInCurrentScope("temp")).toBe(true);
      });
    });

    it("should list current scope names", () => {
      hygiene.withScope(() => {
        hygiene.mangleName("a");
        hygiene.mangleName("b");
        const names = hygiene.getCurrentScopeNames();
        expect(names.size).toBe(2);
        expect(names.has("a")).toBe(true);
        expect(names.has("b")).toBe(true);
      });
    });
  });

  describe("reset", () => {
    it("should reset all state", () => {
      hygiene.withScope(() => {
        hygiene.mangleName("x");
      });

      hygiene.reset();

      // After reset, scope counter starts from 0 again
      hygiene.withScope(() => {
        const name = hygiene.mangleName("x");
        expect(name).toBe("__typemacro_x_s0_0__");
      });
    });
  });
});
