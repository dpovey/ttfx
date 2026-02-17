/**
 * Tests for derive macro functionality
 */

import { describe, it, expect } from "vitest";
import {
  deriveMacros,
  createDerivedFunctionName,
} from "../src/macros/derive.js";
import { globalRegistry } from "../src/core/registry.js";
import {
  builtinDerivations,
  typeclassRegistry,
  derivingAttribute,
} from "../src/macros/typeclass.js";

// Ensure all macros are registered
import "../src/macros/index.js";

describe("derive macro definitions", () => {
  it("should have Eq derive macro", () => {
    expect(deriveMacros.Eq).toBeDefined();
    expect(deriveMacros.Eq.name).toBe("Eq");
    expect(deriveMacros.Eq.kind).toBe("derive");
  });

  it("should have Ord derive macro", () => {
    expect(deriveMacros.Ord).toBeDefined();
    expect(deriveMacros.Ord.name).toBe("Ord");
  });

  it("should have Clone derive macro", () => {
    expect(deriveMacros.Clone).toBeDefined();
    expect(deriveMacros.Clone.name).toBe("Clone");
  });

  it("should have Debug derive macro", () => {
    expect(deriveMacros.Debug).toBeDefined();
    expect(deriveMacros.Debug.name).toBe("Debug");
  });

  it("should have Hash derive macro", () => {
    expect(deriveMacros.Hash).toBeDefined();
    expect(deriveMacros.Hash.name).toBe("Hash");
  });

  it("should have Default derive macro", () => {
    expect(deriveMacros.Default).toBeDefined();
    expect(deriveMacros.Default.name).toBe("Default");
  });

  it("should have Json derive macro", () => {
    expect(deriveMacros.Json).toBeDefined();
    expect(deriveMacros.Json.name).toBe("Json");
  });

  it("should have Builder derive macro", () => {
    expect(deriveMacros.Builder).toBeDefined();
    expect(deriveMacros.Builder.name).toBe("Builder");
  });
});

describe("TypeGuard derive macro", () => {
  it("should have TypeGuard derive macro", () => {
    expect(deriveMacros.TypeGuard).toBeDefined();
    expect(deriveMacros.TypeGuard.name).toBe("TypeGuard");
    expect(deriveMacros.TypeGuard.kind).toBe("derive");
  });
});

describe("createDerivedFunctionName", () => {
  it("should create function names with correct conventions", () => {
    expect(createDerivedFunctionName("eq", "User")).toBe("userEq");
    expect(createDerivedFunctionName("compare", "User")).toBe("userCompare");
    expect(createDerivedFunctionName("clone", "User")).toBe("cloneUser");
    expect(createDerivedFunctionName("debug", "Point")).toBe("debugPoint");
    expect(createDerivedFunctionName("hash", "Config")).toBe("hashConfig");
    expect(createDerivedFunctionName("default", "Settings")).toBe(
      "defaultSettings",
    );
    expect(createDerivedFunctionName("toJson", "Data")).toBe("dataToJson");
    expect(createDerivedFunctionName("fromJson", "Data")).toBe("dataFromJson");
    expect(createDerivedFunctionName("typeGuard", "User")).toBe("isUser");
    expect(createDerivedFunctionName("is", "Point")).toBe("isPoint");
  });
});

// ============================================================================
// Unified @derive / @deriving system tests
// ============================================================================

describe("unified derive system", () => {
  describe("code-gen derive macros are registered in global registry", () => {
    it("should find Eq derive macro by name", () => {
      const macro = globalRegistry.getDerive("Eq");
      expect(macro).toBeDefined();
      expect(macro!.name).toBe("Eq");
      expect(macro!.kind).toBe("derive");
    });

    it("should find TypeGuard derive macro by name", () => {
      const macro = globalRegistry.getDerive("TypeGuard");
      expect(macro).toBeDefined();
      expect(macro!.name).toBe("TypeGuard");
    });

    it("should find Builder derive macro by name", () => {
      const macro = globalRegistry.getDerive("Builder");
      expect(macro).toBeDefined();
    });
  });

  describe("typeclass auto-derivation strategies exist", () => {
    it("should have Show derivation strategy", () => {
      expect(builtinDerivations["Show"]).toBeDefined();
      expect(typeof builtinDerivations["Show"].deriveProduct).toBe("function");
      expect(typeof builtinDerivations["Show"].deriveSum).toBe("function");
    });

    it("should have Eq derivation strategy", () => {
      expect(builtinDerivations["Eq"]).toBeDefined();
    });

    it("should have Ord derivation strategy", () => {
      expect(builtinDerivations["Ord"]).toBeDefined();
    });

    it("should have Hash derivation strategy", () => {
      expect(builtinDerivations["Hash"]).toBeDefined();
    });

    it("should have Semigroup derivation strategy", () => {
      expect(builtinDerivations["Semigroup"]).toBeDefined();
    });

    it("should have Monoid derivation strategy", () => {
      expect(builtinDerivations["Monoid"]).toBeDefined();
    });

    it("should have Functor derivation strategy", () => {
      expect(builtinDerivations["Functor"]).toBeDefined();
    });
  });

  describe("typeclass TC derive macros are registered", () => {
    it("should find ShowTC derive macro", () => {
      const macro = globalRegistry.getDerive("ShowTC");
      expect(macro).toBeDefined();
      expect(macro!.kind).toBe("derive");
    });

    it("should find EqTC derive macro", () => {
      const macro = globalRegistry.getDerive("EqTC");
      expect(macro).toBeDefined();
    });

    it("should find OrdTC derive macro", () => {
      const macro = globalRegistry.getDerive("OrdTC");
      expect(macro).toBeDefined();
    });

    it("should find HashTC derive macro", () => {
      const macro = globalRegistry.getDerive("HashTC");
      expect(macro).toBeDefined();
    });

    it("should find FunctorTC derive macro", () => {
      const macro = globalRegistry.getDerive("FunctorTC");
      expect(macro).toBeDefined();
    });
  });

  describe("@deriving attribute is registered as backward-compatible alias", () => {
    it("should have deriving attribute macro registered", () => {
      const macro = globalRegistry.getAttribute("deriving");
      expect(macro).toBeDefined();
      expect(macro!.name).toBe("deriving");
    });
  });

  describe("unified resolution order", () => {
    it("code-gen derive macros take priority over typeclass derivations", () => {
      // Both "Eq" exists as a code-gen derive AND a typeclass derivation.
      // The code-gen derive should be found first in the registry.
      const codeGenDerive = globalRegistry.getDerive("Eq");
      const typeclassDerivation = builtinDerivations["Eq"];

      // Both exist
      expect(codeGenDerive).toBeDefined();
      expect(typeclassDerivation).toBeDefined();

      // The code-gen derive is a DeriveMacro with expand()
      expect(codeGenDerive!.kind).toBe("derive");
      expect(typeof codeGenDerive!.expand).toBe("function");
    });

    it("typeclass derivation is available for types without code-gen derive", () => {
      // "Show" has a typeclass derivation but no code-gen derive macro
      const codeGenDerive = globalRegistry.getDerive("Show");
      const typeclassDerivation = builtinDerivations["Show"];

      // No code-gen derive for "Show" (it's only in the typeclass system)
      // Note: ShowTC exists as a derive macro, but "Show" itself does not
      expect(codeGenDerive).toBeUndefined();
      expect(typeclassDerivation).toBeDefined();
    });

    it("TC derive macros are the fallback for typeclass derivation", () => {
      // "Functor" has no code-gen derive and no builtinDerivation entry
      // would be found by name, but FunctorTC exists
      const tcDerive = globalRegistry.getDerive("FunctorTC");
      expect(tcDerive).toBeDefined();
    });
  });
});

// ============================================================================
// expandAfter dependency ordering tests
// ============================================================================

describe("macro dependency ordering (expandAfter)", () => {
  it("MacroDefinitionBase supports expandAfter field", () => {
    // Verify the type system accepts expandAfter
    const macro = globalRegistry.getDerive("Eq");
    expect(macro).toBeDefined();
    // expandAfter is optional, so it should be undefined for existing macros
    expect(macro!.expandAfter).toBeUndefined();
  });
});
