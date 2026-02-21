import { describe, it, expect } from "vitest";
import {
  Schema,
  ValidatorF,
  nativeSchema,
  parseOrElse,
  parseMap,
  parseAll,
  safeParseAll,
  makeSchema,
} from "../schema.js";

describe("Schema typeclass", () => {
  describe("nativeSchema instance", () => {
    const isNumber = (value: unknown): value is number =>
      typeof value === "number";

    it("parse returns value when valid", () => {
      expect(nativeSchema.parse(isNumber, 42)).toBe(42);
    });

    it("parse throws when invalid", () => {
      expect(() => nativeSchema.parse(isNumber, "not a number")).toThrow(
        "Validation failed",
      );
    });

    it("safeParse returns Valid when valid", () => {
      const result = nativeSchema.safeParse(isNumber, 42);
      expect(result._tag).toBe("Valid");
      if (result._tag === "Valid") {
        expect(result.value).toBe(42);
      }
    });

    it("safeParse returns Invalid when invalid", () => {
      const result = nativeSchema.safeParse(isNumber, "not a number");
      expect(result._tag).toBe("Invalid");
      if (result._tag === "Invalid") {
        expect(result.error.head.message).toBe("Validation failed");
      }
    });
  });

  describe("derived operations", () => {
    const isPositive = (value: unknown): value is number =>
      typeof value === "number" && value > 0;

    it("parseOrElse returns value when valid", () => {
      const parse = parseOrElse(nativeSchema);
      expect(parse(isPositive, 42, -1)).toBe(42);
    });

    it("parseOrElse returns fallback when invalid", () => {
      const parse = parseOrElse(nativeSchema);
      expect(parse(isPositive, -5, -1)).toBe(-1);
    });

    it("parseMap transforms valid results", () => {
      const parse = parseMap(nativeSchema);
      expect(parse(isPositive, 42, (n) => n * 2)).toBe(84);
    });

    it("parseAll validates multiple values", () => {
      const parse = parseAll(nativeSchema);
      expect(parse(isPositive, [1, 2, 3])).toEqual([1, 2, 3]);
    });

    it("parseAll throws on first invalid value", () => {
      const parse = parseAll(nativeSchema);
      expect(() => parse(isPositive, [1, -2, 3])).toThrow();
    });

    it("safeParseAll collects all valid values", () => {
      const parse = safeParseAll(nativeSchema);
      const result = parse(isPositive, [1, 2, 3]);
      expect(result._tag).toBe("Valid");
      if (result._tag === "Valid") {
        expect(result.value).toEqual([1, 2, 3]);
      }
    });

    it("safeParseAll returns Invalid when any value fails", () => {
      const parse = safeParseAll(nativeSchema);
      const result = parse(isPositive, [1, -2, 3]);
      expect(result._tag).toBe("Invalid");
    });
  });

  describe("makeSchema", () => {
    it("creates a custom Schema instance", () => {
      const customSchema = makeSchema<ValidatorF>(
        (validator, data) => {
          if (validator(data)) return data;
          throw new Error("Custom validation failed");
        },
        (validator, data) => {
          if (validator(data)) {
            return { _tag: "Valid" as const, value: data };
          }
          return {
            _tag: "Invalid" as const,
            error: {
              _tag: "NonEmptyList" as const,
              head: { path: "$", message: "Custom error" },
              tail: { _tag: "Nil" as const },
            },
          };
        },
      );

      const isString = (value: unknown): value is string =>
        typeof value === "string";

      expect(customSchema.parse(isString, "hello")).toBe("hello");
      expect(() => customSchema.parse(isString, 123)).toThrow(
        "Custom validation failed",
      );

      const result = customSchema.safeParse(isString, 123);
      expect(result._tag).toBe("Invalid");
      if (result._tag === "Invalid") {
        expect(result.error.head.message).toBe("Custom error");
      }
    });
  });
});
