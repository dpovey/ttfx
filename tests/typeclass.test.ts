/**
 * Tests for the typeclass system with Scala 3-like derivation
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  // Typeclass interfaces
  Show,
  Eq,
  Ord,
  Hash,
  Semigroup,
  Monoid,
  // Primitive instances
  showNumber,
  showString,
  showBoolean,
  eqNumber,
  eqString,
  eqBoolean,
  ordNumber,
  ordString,
  hashNumber,
  hashString,
  hashBoolean,
  semigroupNumber,
  semigroupString,
  monoidNumber,
  monoidString,
  // Registries
  ShowRegistry,
  EqRegistry,
  OrdRegistry,
  HashRegistry,
  SemigroupRegistry,
  MonoidRegistry,
  TypeclassRegistry,
  // Derivation functions
  deriveShowProduct,
  deriveEqProduct,
  deriveOrdProduct,
  deriveHashProduct,
  deriveSemigroupProduct,
  deriveMonoidProduct,
  deriveShowSum,
  deriveEqSum,
  // Convenience
  derives,
  derivesSum,
  // Extension methods
  withExtensions,
  // Generic programming
  sorted,
  minimum,
  maximum,
  combineAll,
  distinct,
  groupBy,
} from "../src/use-cases/typeclasses/index.js";

// ============================================================================
// Test Types
// ============================================================================

interface Point {
  x: number;
  y: number;
}

interface Person {
  name: string;
  age: number;
}

interface Config {
  host: string;
  port: number;
  debug: boolean;
}

// Sum type (discriminated union)
interface Circle {
  kind: "circle";
  radius: number;
}

interface Rectangle {
  kind: "rectangle";
  width: number;
  height: number;
}

type Shape = Circle | Rectangle;

// ============================================================================
// Primitive Instance Tests
// ============================================================================

describe("primitive instances", () => {
  describe("Show", () => {
    it("should show numbers", () => {
      expect(showNumber.show(42)).toBe("42");
      expect(showNumber.show(3.14)).toBe("3.14");
      expect(showNumber.show(-1)).toBe("-1");
      expect(showNumber.show(0)).toBe("0");
    });

    it("should show strings", () => {
      expect(showString.show("hello")).toBe('"hello"');
      expect(showString.show("")).toBe('""');
    });

    it("should show booleans", () => {
      expect(showBoolean.show(true)).toBe("true");
      expect(showBoolean.show(false)).toBe("false");
    });
  });

  describe("Eq", () => {
    it("should compare numbers for equality", () => {
      expect(eqNumber.eq(1, 1)).toBe(true);
      expect(eqNumber.eq(1, 2)).toBe(false);
      expect(eqNumber.neq(1, 2)).toBe(true);
      expect(eqNumber.neq(1, 1)).toBe(false);
    });

    it("should compare strings for equality", () => {
      expect(eqString.eq("a", "a")).toBe(true);
      expect(eqString.eq("a", "b")).toBe(false);
    });

    it("should compare booleans for equality", () => {
      expect(eqBoolean.eq(true, true)).toBe(true);
      expect(eqBoolean.eq(true, false)).toBe(false);
    });
  });

  describe("Ord", () => {
    it("should compare numbers", () => {
      expect(ordNumber.compare(1, 2)).toBe(-1);
      expect(ordNumber.compare(2, 1)).toBe(1);
      expect(ordNumber.compare(1, 1)).toBe(0);
    });

    it("should compare strings", () => {
      expect(ordString.compare("a", "b")).toBe(-1);
      expect(ordString.compare("b", "a")).toBe(1);
      expect(ordString.compare("a", "a")).toBe(0);
    });
  });

  describe("Hash", () => {
    it("should hash numbers", () => {
      expect(hashNumber.hash(42)).toBe(42);
      expect(hashNumber.hash(0)).toBe(0);
    });

    it("should hash strings deterministically", () => {
      const h1 = hashString.hash("hello");
      const h2 = hashString.hash("hello");
      expect(h1).toBe(h2);
      expect(hashString.hash("hello")).not.toBe(hashString.hash("world"));
    });

    it("should hash booleans", () => {
      expect(hashBoolean.hash(true)).toBe(1);
      expect(hashBoolean.hash(false)).toBe(0);
    });
  });

  describe("Semigroup", () => {
    it("should combine numbers (addition)", () => {
      expect(semigroupNumber.combine(1, 2)).toBe(3);
      expect(semigroupNumber.combine(0, 5)).toBe(5);
    });

    it("should combine strings (concatenation)", () => {
      expect(semigroupString.combine("hello", " world")).toBe("hello world");
      expect(semigroupString.combine("", "a")).toBe("a");
    });
  });

  describe("Monoid", () => {
    it("should have identity element for numbers", () => {
      expect(monoidNumber.empty()).toBe(0);
      expect(monoidNumber.combine(monoidNumber.empty(), 5)).toBe(5);
      expect(monoidNumber.combine(5, monoidNumber.empty())).toBe(5);
    });

    it("should have identity element for strings", () => {
      expect(monoidString.empty()).toBe("");
      expect(monoidString.combine(monoidString.empty(), "a")).toBe("a");
      expect(monoidString.combine("a", monoidString.empty())).toBe("a");
    });

    it("should satisfy associativity", () => {
      const a = 1,
        b = 2,
        c = 3;
      expect(monoidNumber.combine(monoidNumber.combine(a, b), c)).toBe(
        monoidNumber.combine(a, monoidNumber.combine(b, c)),
      );
    });
  });
});

// ============================================================================
// Registry Tests
// ============================================================================

describe("TypeclassRegistry", () => {
  it("should register and summon instances", () => {
    const registry = new TypeclassRegistry<Show<any>>();
    const instance: Show<number> = { show: (a) => `num:${a}` };
    registry.registerInstance("number", instance);

    expect(registry.hasInstance("number")).toBe(true);
    expect(registry.summon("number")).toBe(instance);
  });

  it("should throw on missing instance", () => {
    const registry = new TypeclassRegistry<Show<any>>();
    expect(() => registry.summon("missing")).toThrow(
      "No instance found for type 'missing'",
    );
  });

  it("should list registered types", () => {
    const registry = new TypeclassRegistry<Show<any>>();
    registry.registerInstance("a", { show: () => "a" });
    registry.registerInstance("b", { show: () => "b" });
    expect(registry.registeredTypes()).toEqual(["a", "b"]);
  });

  it("should check instance existence", () => {
    const registry = new TypeclassRegistry<Eq<any>>();
    expect(registry.hasInstance("number")).toBe(false);
    registry.registerInstance("number", eqNumber);
    expect(registry.hasInstance("number")).toBe(true);
  });
});

// ============================================================================
// Product Type Derivation Tests
// ============================================================================

describe("product type derivation", () => {
  describe("Show derivation", () => {
    it("should derive Show for Point", () => {
      const showPoint = deriveShowProduct<Point>(
        "Point",
        ["x", "y"],
        ["number", "number"],
      );

      expect(showPoint.show({ x: 1, y: 2 })).toBe("Point(x = 1, y = 2)");
      expect(showPoint.show({ x: 0, y: 0 })).toBe("Point(x = 0, y = 0)");
    });

    it("should derive Show for Person", () => {
      const showPerson = deriveShowProduct<Person>(
        "Person",
        ["name", "age"],
        ["string", "number"],
      );

      expect(showPerson.show({ name: "Alice", age: 30 })).toBe(
        'Person(name = "Alice", age = 30)',
      );
    });

    it("should derive Show for mixed types", () => {
      const showConfig = deriveShowProduct<Config>(
        "Config",
        ["host", "port", "debug"],
        ["string", "number", "boolean"],
      );

      expect(
        showConfig.show({ host: "localhost", port: 8080, debug: true }),
      ).toBe('Config(host = "localhost", port = 8080, debug = true)');
    });
  });

  describe("Eq derivation", () => {
    it("should derive Eq for Point", () => {
      const eqPoint = deriveEqProduct<Point>(
        "Point",
        ["x", "y"],
        ["number", "number"],
      );

      expect(eqPoint.eq({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true);
      expect(eqPoint.eq({ x: 1, y: 2 }, { x: 1, y: 3 })).toBe(false);
      expect(eqPoint.eq({ x: 1, y: 2 }, { x: 2, y: 2 })).toBe(false);
    });

    it("should derive neq correctly", () => {
      const eqPoint = deriveEqProduct<Point>(
        "Point",
        ["x", "y"],
        ["number", "number"],
      );

      expect(eqPoint.neq({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(false);
      expect(eqPoint.neq({ x: 1, y: 2 }, { x: 3, y: 4 })).toBe(true);
    });

    it("should derive Eq for Person", () => {
      const eqPerson = deriveEqProduct<Person>(
        "Person",
        ["name", "age"],
        ["string", "number"],
      );

      expect(
        eqPerson.eq({ name: "Alice", age: 30 }, { name: "Alice", age: 30 }),
      ).toBe(true);
      expect(
        eqPerson.eq({ name: "Alice", age: 30 }, { name: "Bob", age: 30 }),
      ).toBe(false);
    });
  });

  describe("Ord derivation", () => {
    it("should derive Ord for Point (lexicographic)", () => {
      const ordPoint = deriveOrdProduct<Point>(
        "Point",
        ["x", "y"],
        ["number", "number"],
      );

      expect(ordPoint.compare({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(0);
      expect(ordPoint.compare({ x: 1, y: 2 }, { x: 2, y: 1 })).toBe(-1);
      expect(ordPoint.compare({ x: 2, y: 1 }, { x: 1, y: 2 })).toBe(1);
      // Same x, different y
      expect(ordPoint.compare({ x: 1, y: 2 }, { x: 1, y: 3 })).toBe(-1);
      expect(ordPoint.compare({ x: 1, y: 3 }, { x: 1, y: 2 })).toBe(1);
    });

    it("should derive Ord for Person", () => {
      const ordPerson = deriveOrdProduct<Person>(
        "Person",
        ["name", "age"],
        ["string", "number"],
      );

      // Compares name first, then age
      expect(
        ordPerson.compare({ name: "Alice", age: 30 }, { name: "Bob", age: 25 }),
      ).toBe(-1);
      expect(
        ordPerson.compare(
          { name: "Alice", age: 25 },
          { name: "Alice", age: 30 },
        ),
      ).toBe(-1);
    });
  });

  describe("Hash derivation", () => {
    it("should derive Hash for Point", () => {
      const hashPoint = deriveHashProduct<Point>(
        "Point",
        ["x", "y"],
        ["number", "number"],
      );

      // Same values should produce same hash
      expect(hashPoint.hash({ x: 1, y: 2 })).toBe(
        hashPoint.hash({ x: 1, y: 2 }),
      );

      // Different values should (usually) produce different hashes
      expect(hashPoint.hash({ x: 1, y: 2 })).not.toBe(
        hashPoint.hash({ x: 2, y: 1 }),
      );
    });

    it("should produce unsigned 32-bit integers", () => {
      const hashPoint = deriveHashProduct<Point>(
        "Point",
        ["x", "y"],
        ["number", "number"],
      );

      const h = hashPoint.hash({ x: 1, y: 2 });
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
    });
  });

  describe("Semigroup derivation", () => {
    it("should derive Semigroup for Point (component-wise addition)", () => {
      const sgPoint = deriveSemigroupProduct<Point>(
        "Point",
        ["x", "y"],
        ["number", "number"],
      );

      expect(sgPoint.combine({ x: 1, y: 2 }, { x: 3, y: 4 })).toEqual({
        x: 4,
        y: 6,
      });
    });

    it("should satisfy associativity", () => {
      const sgPoint = deriveSemigroupProduct<Point>(
        "Point",
        ["x", "y"],
        ["number", "number"],
      );

      const a: Point = { x: 1, y: 2 };
      const b: Point = { x: 3, y: 4 };
      const c: Point = { x: 5, y: 6 };

      expect(sgPoint.combine(sgPoint.combine(a, b), c)).toEqual(
        sgPoint.combine(a, sgPoint.combine(b, c)),
      );
    });
  });

  describe("Monoid derivation", () => {
    it("should derive Monoid for Point", () => {
      const mPoint = deriveMonoidProduct<Point>(
        "Point",
        ["x", "y"],
        ["number", "number"],
      );

      expect(mPoint.empty()).toEqual({ x: 0, y: 0 });
      expect(mPoint.combine({ x: 1, y: 2 }, { x: 3, y: 4 })).toEqual({
        x: 4,
        y: 6,
      });
    });

    it("should satisfy identity laws", () => {
      const mPoint = deriveMonoidProduct<Point>(
        "Point",
        ["x", "y"],
        ["number", "number"],
      );

      const p: Point = { x: 1, y: 2 };
      expect(mPoint.combine(mPoint.empty(), p)).toEqual(p);
      expect(mPoint.combine(p, mPoint.empty())).toEqual(p);
    });
  });
});

// ============================================================================
// Sum Type Derivation Tests
// ============================================================================

describe("sum type derivation", () => {
  beforeEach(() => {
    // Register instances for the variant types
    const showCircle = deriveShowProduct<Circle>(
      "Circle",
      ["kind", "radius"],
      ["string", "number"],
    );
    ShowRegistry.registerInstance("Circle", showCircle);

    const showRectangle = deriveShowProduct<Rectangle>(
      "Rectangle",
      ["kind", "width", "height"],
      ["string", "number", "number"],
    );
    ShowRegistry.registerInstance("Rectangle", showRectangle);

    const eqCircle = deriveEqProduct<Circle>(
      "Circle",
      ["kind", "radius"],
      ["string", "number"],
    );
    EqRegistry.registerInstance("Circle", eqCircle);

    const eqRectangle = deriveEqProduct<Rectangle>(
      "Rectangle",
      ["kind", "width", "height"],
      ["string", "number", "number"],
    );
    EqRegistry.registerInstance("Rectangle", eqRectangle);
  });

  describe("Show derivation for sum types", () => {
    it("should show Circle variant", () => {
      const showShape = deriveShowSum<Shape>("Shape", "kind", {
        circle: "Circle",
        rectangle: "Rectangle",
      });

      const circle: Shape = { kind: "circle", radius: 5 };
      expect(showShape.show(circle)).toBe(
        'Circle(kind = "circle", radius = 5)',
      );
    });

    it("should show Rectangle variant", () => {
      const showShape = deriveShowSum<Shape>("Shape", "kind", {
        circle: "Circle",
        rectangle: "Rectangle",
      });

      const rect: Shape = { kind: "rectangle", width: 3, height: 4 };
      expect(showShape.show(rect)).toBe(
        'Rectangle(kind = "rectangle", width = 3, height = 4)',
      );
    });
  });

  describe("Eq derivation for sum types", () => {
    it("should compare same variants", () => {
      const eqShape = deriveEqSum<Shape>("Shape", "kind", {
        circle: "Circle",
        rectangle: "Rectangle",
      });

      expect(
        eqShape.eq(
          { kind: "circle", radius: 5 },
          { kind: "circle", radius: 5 },
        ),
      ).toBe(true);

      expect(
        eqShape.eq(
          { kind: "circle", radius: 5 },
          { kind: "circle", radius: 10 },
        ),
      ).toBe(false);
    });

    it("should compare different variants as not equal", () => {
      const eqShape = deriveEqSum<Shape>("Shape", "kind", {
        circle: "Circle",
        rectangle: "Rectangle",
      });

      expect(
        eqShape.eq({ kind: "circle", radius: 5 }, {
          kind: "rectangle",
          width: 5,
          height: 5,
        } as any),
      ).toBe(false);
    });
  });
});

// ============================================================================
// derives() Convenience Function Tests
// ============================================================================

describe("derives() convenience function", () => {
  it("should derive multiple typeclasses at once", () => {
    derives<Point>(
      "Point",
      ["x", "y"],
      ["number", "number"],
      ["Show", "Eq", "Ord", "Hash"],
    );

    // Show
    const showPoint = ShowRegistry.summon<Point>("Point");
    expect(showPoint.show({ x: 1, y: 2 })).toBe("Point(x = 1, y = 2)");

    // Eq
    const eqPoint = EqRegistry.summon<Point>("Point");
    expect(eqPoint.eq({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true);
    expect(eqPoint.eq({ x: 1, y: 2 }, { x: 3, y: 4 })).toBe(false);

    // Ord
    const ordPoint = OrdRegistry.summon<Point>("Point");
    expect(ordPoint.compare({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(0);
    expect(ordPoint.compare({ x: 1, y: 2 }, { x: 2, y: 1 })).toBe(-1);

    // Hash
    const hashPoint = HashRegistry.summon<Point>("Point");
    expect(hashPoint.hash({ x: 1, y: 2 })).toBe(hashPoint.hash({ x: 1, y: 2 }));
  });

  it("should derive Semigroup and Monoid", () => {
    derives<Point>(
      "PointM",
      ["x", "y"],
      ["number", "number"],
      ["Semigroup", "Monoid"],
    );

    const sg = SemigroupRegistry.summon<Point>("PointM");
    expect(sg.combine({ x: 1, y: 2 }, { x: 3, y: 4 })).toEqual({
      x: 4,
      y: 6,
    });

    const m = MonoidRegistry.summon<Point>("PointM");
    expect(m.empty()).toEqual({ x: 0, y: 0 });
  });

  it("should derive sum types", () => {
    // First ensure variant instances exist
    derives<Circle>(
      "CircleD",
      ["kind", "radius"],
      ["string", "number"],
      ["Show", "Eq"],
    );
    derives<Rectangle>(
      "RectangleD",
      ["kind", "width", "height"],
      ["string", "number", "number"],
      ["Show", "Eq"],
    );

    derivesSum<Shape>(
      "ShapeD",
      "kind",
      {
        circle: "CircleD",
        rectangle: "RectangleD",
      },
      ["Show", "Eq"],
    );

    const showShape = ShowRegistry.summon<Shape>("ShapeD");
    expect(showShape.show({ kind: "circle", radius: 5 })).toBe(
      'CircleD(kind = "circle", radius = 5)',
    );

    const eqShape = EqRegistry.summon<Shape>("ShapeD");
    expect(
      eqShape.eq({ kind: "circle", radius: 5 }, { kind: "circle", radius: 5 }),
    ).toBe(true);
  });
});

// ============================================================================
// Extension Method Tests
// ============================================================================

describe("extension methods", () => {
  beforeEach(() => {
    derives<Point>(
      "Point",
      ["x", "y"],
      ["number", "number"],
      ["Show", "Eq", "Ord", "Hash", "Semigroup"],
    );
  });

  it("should provide show() extension method", () => {
    const p = withExtensions<Point>({ x: 1, y: 2 }, "Point");
    expect(p.show()).toBe("Point(x = 1, y = 2)");
  });

  it("should provide eq() extension method", () => {
    const p = withExtensions<Point>({ x: 1, y: 2 }, "Point");
    expect(p.eq({ x: 1, y: 2 })).toBe(true);
    expect(p.eq({ x: 3, y: 4 })).toBe(false);
  });

  it("should provide neq() extension method", () => {
    const p = withExtensions<Point>({ x: 1, y: 2 }, "Point");
    expect(p.neq({ x: 1, y: 2 })).toBe(false);
    expect(p.neq({ x: 3, y: 4 })).toBe(true);
  });

  it("should provide compare() extension method", () => {
    const p = withExtensions<Point>({ x: 1, y: 2 }, "Point");
    expect(p.compare({ x: 1, y: 2 })).toBe(0);
    expect(p.compare({ x: 2, y: 1 })).toBe(-1);
    expect(p.compare({ x: 0, y: 3 })).toBe(1);
  });

  it("should provide hash() extension method", () => {
    const p = withExtensions<Point>({ x: 1, y: 2 }, "Point");
    expect(typeof p.hash()).toBe("number");
  });

  it("should provide combine() extension method", () => {
    const p = withExtensions<Point>({ x: 1, y: 2 }, "Point");
    expect(p.combine({ x: 3, y: 4 })).toEqual({ x: 4, y: 6 });
  });

  it("should still allow access to original properties", () => {
    const p = withExtensions<Point>({ x: 1, y: 2 }, "Point");
    expect(p.x).toBe(1);
    expect(p.y).toBe(2);
  });
});

// ============================================================================
// Generic Programming Tests
// ============================================================================

describe("generic programming with typeclasses", () => {
  beforeEach(() => {
    derives<Point>(
      "Point",
      ["x", "y"],
      ["number", "number"],
      ["Show", "Eq", "Ord", "Hash", "Monoid"],
    );
  });

  describe("sorted()", () => {
    it("should sort points lexicographically", () => {
      const points: Point[] = [
        { x: 3, y: 1 },
        { x: 1, y: 2 },
        { x: 2, y: 3 },
        { x: 1, y: 1 },
      ];

      const result = sorted(points, "Point");
      expect(result).toEqual([
        { x: 1, y: 1 },
        { x: 1, y: 2 },
        { x: 2, y: 3 },
        { x: 3, y: 1 },
      ]);
    });

    it("should not mutate the original array", () => {
      const points: Point[] = [
        { x: 3, y: 1 },
        { x: 1, y: 2 },
      ];
      sorted(points, "Point");
      expect(points[0]).toEqual({ x: 3, y: 1 });
    });
  });

  describe("minimum() and maximum()", () => {
    it("should find minimum point", () => {
      const points: Point[] = [
        { x: 3, y: 1 },
        { x: 1, y: 2 },
        { x: 2, y: 3 },
      ];

      expect(minimum(points, "Point")).toEqual({ x: 1, y: 2 });
    });

    it("should find maximum point", () => {
      const points: Point[] = [
        { x: 3, y: 1 },
        { x: 1, y: 2 },
        { x: 2, y: 3 },
      ];

      expect(maximum(points, "Point")).toEqual({ x: 3, y: 1 });
    });

    it("should return undefined for empty arrays", () => {
      expect(minimum<Point>([], "Point")).toBeUndefined();
      expect(maximum<Point>([], "Point")).toBeUndefined();
    });
  });

  describe("combineAll()", () => {
    it("should combine all points using Monoid", () => {
      const points: Point[] = [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
        { x: 5, y: 6 },
      ];

      expect(combineAll(points, "Point")).toEqual({ x: 9, y: 12 });
    });

    it("should return empty for empty array", () => {
      expect(combineAll<Point>([], "Point")).toEqual({ x: 0, y: 0 });
    });
  });

  describe("distinct()", () => {
    it("should remove duplicate points", () => {
      const points: Point[] = [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
        { x: 1, y: 2 },
        { x: 3, y: 4 },
        { x: 5, y: 6 },
      ];

      expect(distinct(points, "Point")).toEqual([
        { x: 1, y: 2 },
        { x: 3, y: 4 },
        { x: 5, y: 6 },
      ]);
    });
  });

  describe("groupBy()", () => {
    it("should group points by x coordinate", () => {
      const points: Point[] = [
        { x: 1, y: 2 },
        { x: 2, y: 3 },
        { x: 1, y: 4 },
        { x: 2, y: 5 },
      ];

      const groups = groupBy(points, (p) => p.x, "number");
      expect(groups.get("1")).toEqual([
        { x: 1, y: 2 },
        { x: 1, y: 4 },
      ]);
      expect(groups.get("2")).toEqual([
        { x: 2, y: 3 },
        { x: 2, y: 5 },
      ]);
    });
  });
});

// ============================================================================
// Macro Definition Tests (compile-time aspects)
// ============================================================================

describe("typeclass macro definitions", () => {
  it("should export typeclass attribute macro", async () => {
    const { typeclassAttribute } = await import("../src/macros/typeclass.js");
    expect(typeclassAttribute).toBeDefined();
    expect(typeclassAttribute.name).toBe("typeclass");
    expect(typeclassAttribute.kind).toBe("attribute");
    expect(typeclassAttribute.validTargets).toContain("interface");
  });

  it("should export instance attribute macro", async () => {
    const { instanceAttribute } = await import("../src/macros/typeclass.js");
    expect(instanceAttribute).toBeDefined();
    expect(instanceAttribute.name).toBe("instance");
    expect(instanceAttribute.kind).toBe("attribute");
  });

  it("should export deriving attribute macro", async () => {
    const { derivingAttribute } = await import("../src/macros/typeclass.js");
    expect(derivingAttribute).toBeDefined();
    expect(derivingAttribute.name).toBe("deriving");
    expect(derivingAttribute.kind).toBe("attribute");
    expect(derivingAttribute.validTargets).toContain("interface");
    expect(derivingAttribute.validTargets).toContain("class");
    expect(derivingAttribute.validTargets).toContain("type");
  });

  it("should export summon expression macro", async () => {
    const { summonMacro } = await import("../src/macros/typeclass.js");
    expect(summonMacro).toBeDefined();
    expect(summonMacro.name).toBe("summon");
    expect(summonMacro.kind).toBe("expression");
  });

  it("should export extend expression macro", async () => {
    const { extendMacro } = await import("../src/macros/typeclass.js");
    expect(extendMacro).toBeDefined();
    expect(extendMacro.name).toBe("extend");
    expect(extendMacro.kind).toBe("expression");
  });

  it("should have built-in derivation strategies", async () => {
    const { builtinDerivations } = await import("../src/macros/typeclass.js");
    expect(builtinDerivations).toBeDefined();
    expect(builtinDerivations["Show"]).toBeDefined();
    expect(builtinDerivations["Eq"]).toBeDefined();
    expect(builtinDerivations["Ord"]).toBeDefined();
    expect(builtinDerivations["Hash"]).toBeDefined();
    expect(builtinDerivations["Semigroup"]).toBeDefined();
    expect(builtinDerivations["Monoid"]).toBeDefined();
    expect(builtinDerivations["Functor"]).toBeDefined();
  });

  it("should support creating custom typeclass derive macros", async () => {
    const { createTypeclassDeriveMacro } =
      await import("../src/macros/typeclass.js");
    expect(typeof createTypeclassDeriveMacro).toBe("function");
  });

  it("should export instance registry utilities", async () => {
    const { findInstance, getTypeclass, instanceVarName } =
      await import("../src/macros/typeclass.js");
    expect(typeof findInstance).toBe("function");
    expect(typeof getTypeclass).toBe("function");
    expect(typeof instanceVarName).toBe("function");
  });

  it("should generate correct instance variable names", async () => {
    const { instanceVarName } = await import("../src/macros/typeclass.js");
    expect(instanceVarName("Show", "Point")).toBe("showPoint");
    expect(instanceVarName("Eq", "number")).toBe("eqNumber");
    expect(instanceVarName("Ord", "Person")).toBe("ordPerson");
  });
});

// ============================================================================
// Typeclass Laws Tests
// ============================================================================

describe("typeclass laws", () => {
  beforeEach(() => {
    derives<Point>(
      "PointLaw",
      ["x", "y"],
      ["number", "number"],
      ["Eq", "Ord", "Semigroup", "Monoid"],
    );
  });

  describe("Eq laws", () => {
    const p1: Point = { x: 1, y: 2 };
    const p2: Point = { x: 1, y: 2 };
    const p3: Point = { x: 3, y: 4 };

    it("reflexivity: eq(a, a) = true", () => {
      const eq = EqRegistry.summon<Point>("PointLaw");
      expect(eq.eq(p1, p1)).toBe(true);
    });

    it("symmetry: eq(a, b) = eq(b, a)", () => {
      const eq = EqRegistry.summon<Point>("PointLaw");
      expect(eq.eq(p1, p2)).toBe(eq.eq(p2, p1));
      expect(eq.eq(p1, p3)).toBe(eq.eq(p3, p1));
    });

    it("transitivity: eq(a, b) && eq(b, c) => eq(a, c)", () => {
      const eq = EqRegistry.summon<Point>("PointLaw");
      const p2copy: Point = { x: 1, y: 2 };
      if (eq.eq(p1, p2) && eq.eq(p2, p2copy)) {
        expect(eq.eq(p1, p2copy)).toBe(true);
      }
    });

    it("negation: neq(a, b) = !eq(a, b)", () => {
      const eq = EqRegistry.summon<Point>("PointLaw");
      expect(eq.neq(p1, p2)).toBe(!eq.eq(p1, p2));
      expect(eq.neq(p1, p3)).toBe(!eq.eq(p1, p3));
    });
  });

  describe("Ord laws", () => {
    const p1: Point = { x: 1, y: 2 };
    const p2: Point = { x: 2, y: 1 };
    const p3: Point = { x: 3, y: 0 };

    it("reflexivity: compare(a, a) = 0", () => {
      const ord = OrdRegistry.summon<Point>("PointLaw");
      expect(ord.compare(p1, p1)).toBe(0);
    });

    it("antisymmetry: compare(a, b) = -compare(b, a)", () => {
      const ord = OrdRegistry.summon<Point>("PointLaw");
      expect(ord.compare(p1, p2)).toBe(-ord.compare(p2, p1) as -1 | 0 | 1);
    });

    it("transitivity: compare(a, b) <= 0 && compare(b, c) <= 0 => compare(a, c) <= 0", () => {
      const ord = OrdRegistry.summon<Point>("PointLaw");
      if (ord.compare(p1, p2) <= 0 && ord.compare(p2, p3) <= 0) {
        expect(ord.compare(p1, p3)).toBeLessThanOrEqual(0);
      }
    });
  });

  describe("Monoid laws", () => {
    const p1: Point = { x: 1, y: 2 };
    const p2: Point = { x: 3, y: 4 };
    const p3: Point = { x: 5, y: 6 };

    it("left identity: combine(empty, a) = a", () => {
      const m = MonoidRegistry.summon<Point>("PointLaw");
      expect(m.combine(m.empty(), p1)).toEqual(p1);
    });

    it("right identity: combine(a, empty) = a", () => {
      const m = MonoidRegistry.summon<Point>("PointLaw");
      expect(m.combine(p1, m.empty())).toEqual(p1);
    });

    it("associativity: combine(combine(a, b), c) = combine(a, combine(b, c))", () => {
      const m = MonoidRegistry.summon<Point>("PointLaw");
      expect(m.combine(m.combine(p1, p2), p3)).toEqual(
        m.combine(p1, m.combine(p2, p3)),
      );
    });
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("edge cases", () => {
  it("should handle empty product types", () => {
    interface Empty {}
    const showEmpty = deriveShowProduct<Empty>("Empty", [], []);
    expect(showEmpty.show({})).toBe("Empty()");

    const eqEmpty = deriveEqProduct<Empty>("Empty", [], []);
    expect(eqEmpty.eq({}, {})).toBe(true);
  });

  it("should handle single-field product types", () => {
    interface Wrapper {
      value: number;
    }
    const showWrapper = deriveShowProduct<Wrapper>(
      "Wrapper",
      ["value"],
      ["number"],
    );
    expect(showWrapper.show({ value: 42 })).toBe("Wrapper(value = 42)");
  });

  it("should handle deeply nested derivation", () => {
    // Derive for inner type first
    derives<Point>(
      "InnerPoint",
      ["x", "y"],
      ["number", "number"],
      ["Show", "Eq"],
    );

    // Then derive for outer type that references inner
    const showInner = ShowRegistry.summon<Point>("InnerPoint");
    expect(showInner.show({ x: 1, y: 2 })).toBe("InnerPoint(x = 1, y = 2)");
  });
});
