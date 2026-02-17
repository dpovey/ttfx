/**
 * typemacro/testing — Compile-time testing superpowers for TypeScript
 *
 * Import from "typemacro/testing" to use these macros in your test files.
 * The transformer will expand them at compile time.
 *
 * @example
 * ```typescript
 * import {
 *   powerAssert,
 *   comptimeAssert,
 *   assertSnapshot,
 *   typeAssert,
 *   forAll,
 *   type Equal,
 *   type Extends,
 * } from "typemacro/testing";
 *
 * // Power assertions — sub-expression capture on failure
 * powerAssert(users.length === activeIds.filter(id => id > 0).length);
 *
 * // Compile-time assertions — fail the BUILD, not the test
 * comptimeAssert(3 + 4 === 7, "basic math must work");
 *
 * // Snapshot testing with source capture
 * assertSnapshot(formatUser(testUser));
 *
 * // Type-level assertions
 * typeAssert<Equal<ReturnType<typeof parse>, AST>>();
 *
 * // Property-based testing with @derive(Arbitrary)
 * forAll(arbitraryUser, (user) => {
 *   expect(deserialize(serialize(user))).toEqual(user);
 * });
 * ```
 *
 * For parameterized tests, use the @testCases decorator:
 * ```typescript
 * import { testCases } from "typemacro/testing";
 *
 * @testCases([
 *   { input: "", expected: true },
 *   { input: "hello", expected: false },
 * ])
 * function testIsBlank(input: string, expected: boolean) {
 *   expect(isBlank(input)).toBe(expected);
 * }
 * ```
 *
 * For property-based testing, use @derive(Arbitrary):
 * ```typescript
 * import { derive } from "ttfx";
 *
 * @derive(Arbitrary)
 * interface User {
 *   name: string;
 *   age: number;
 *   active: boolean;
 * }
 * // Generates: arbitraryUser(seed?) and arbitraryUserMany(count, seed?)
 * ```
 *
 * @packageDocumentation
 */

// ============================================================================
// Power Assertions
// ============================================================================

/**
 * Assert with sub-expression capture.
 *
 * On failure, prints a diagram showing the value of every sub-expression
 * in the assertion, similar to Rust's assert_eq!, Elixir's assert, and
 * Swift's #expect.
 *
 * @param condition - The boolean expression to assert
 * @param message - Optional failure message
 *
 * @example
 * ```typescript
 * powerAssert(users.length === filtered.length);
 * // On failure:
 * //   Power Assert Failed
 * //
 * //   users.length === filtered.length
 * //
 * //   Sub-expressions:
 * //     users.length === filtered.length → false
 * //     users.length → 3
 * //     users → [{...}, {...}, {...}]
 * //     filtered.length → 2
 * //     filtered → [{...}, {...}]
 * ```
 */
export function powerAssert(condition: boolean, message?: string): void {
  // Runtime fallback — the transformer replaces this with instrumented code
  if (!condition) {
    throw new Error(
      message ??
        "Power assertion failed (run with typemacro transformer for detailed output)",
    );
  }
}

// ============================================================================
// Compile-Time Assertions
// ============================================================================

/**
 * Assert a condition at compile time.
 *
 * If the condition evaluates to false during compilation, the BUILD fails
 * with a clear error message. No runtime cost — expands to `void 0`.
 *
 * @param condition - A compile-time evaluable expression
 * @param message - Optional error message for build failure
 *
 * @example
 * ```typescript
 * comptimeAssert(3 + 4 === 7, "basic math");
 * comptimeAssert(SUPPORTED_LOCALES.length > 0, "must have locales");
 * ```
 */
export function comptimeAssert(_condition: boolean, _message?: string): void {
  // Placeholder — transformer evaluates at compile time
}

// ============================================================================
// Parameterized Tests
// ============================================================================

/**
 * Expand a single test function into multiple parameterized test cases.
 *
 * Each element in the array becomes a separate `it()` test case with a
 * descriptive name showing the parameter values.
 *
 * @param cases - Array of test case objects whose keys match the function parameters
 *
 * @example
 * ```typescript
 * @testCases([
 *   { input: "", expected: true },
 *   { input: "hello", expected: false },
 *   { input: "  ", expected: true },
 * ])
 * function testIsBlank(input: string, expected: boolean) {
 *   expect(isBlank(input)).toBe(expected);
 * }
 * // Expands to:
 * // it('testIsBlank (case #1: input="", expected=true)', () => { ... })
 * // it('testIsBlank (case #2: input="hello", expected=false)', () => { ... })
 * // it('testIsBlank (case #3: input="  ", expected=true)', () => { ... })
 * ```
 */
export function testCases(
  _cases: Array<Record<string, unknown>>,
): MethodDecorator & ClassDecorator & PropertyDecorator {
  // Placeholder decorator — processed by transformer
  return (() => {}) as any;
}

// ============================================================================
// Snapshot Testing
// ============================================================================

/**
 * Snapshot testing with compile-time source expression capture.
 *
 * The macro captures the source text of the expression at compile time,
 * so the snapshot label includes both the file location and the expression
 * that produced the value.
 *
 * @param value - The value to snapshot
 * @param name - Optional snapshot name
 *
 * @example
 * ```typescript
 * assertSnapshot(formatUser(testUser));
 * // Expands to: expect(formatUser(testUser)).toMatchSnapshot("file.ts:42 — formatUser(testUser)")
 *
 * assertSnapshot(renderComponent(props), "dark mode");
 * // Expands to: expect(renderComponent(props)).toMatchSnapshot("file.ts:45 — renderComponent(props) [dark mode]")
 * ```
 */
export function assertSnapshot<T>(value: T, name?: string): void {
  // Runtime fallback — works with vitest/jest but without source capture
  const label = name ?? "snapshot";
  (expect as any)(value).toMatchSnapshot(label);
}

// ============================================================================
// Type Assertions
// ============================================================================

/**
 * Assert a type relationship at compile time.
 *
 * The type argument must resolve to the literal type `true`.
 * If it resolves to `false`, the build fails with a clear error.
 *
 * Use with `Equal<A, B>` and `Extends<A, B>` type utilities.
 *
 * @example
 * ```typescript
 * typeAssert<Equal<1 + 1, 2>>();                    // passes
 * typeAssert<Extends<"hello", string>>();            // passes
 * typeAssert<Equal<ReturnType<typeof fn>, number>>(); // passes if fn returns number
 * ```
 */
export function typeAssert<_T extends true>(): void {
  // Type-level only — no runtime effect
}

// ============================================================================
// Property-Based Testing
// ============================================================================

/**
 * Run a property-based test with auto-generated values.
 *
 * Pairs with `@derive(Arbitrary)` to generate random inputs and test
 * that a property holds for all of them.
 *
 * @param generator - A function that produces random values (from @derive(Arbitrary))
 * @param countOrProperty - Either the number of iterations or the property function
 * @param property - The property function (if count is provided)
 *
 * @example
 * ```typescript
 * // Basic usage (100 iterations by default)
 * forAll(arbitraryUser, (user) => {
 *   expect(deserialize(serialize(user))).toEqual(user);
 * });
 *
 * // With custom iteration count
 * forAll(arbitraryUser, 500, (user) => {
 *   expect(user.age).toBeGreaterThanOrEqual(0);
 * });
 * ```
 */
export function forAll<T>(
  generator: (seed: number) => T,
  countOrProperty: number | ((value: T) => void),
  property?: (value: T) => void,
): void {
  // Runtime fallback
  const count = typeof countOrProperty === "number" ? countOrProperty : 100;
  const prop =
    typeof countOrProperty === "function" ? countOrProperty : property!;

  for (let i = 0; i < count; i++) {
    const value = generator(i);
    try {
      prop(value);
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      throw new Error(
        `Property failed after ${i + 1} tests.\n` +
          `Failing input: ${JSON.stringify(value)}\n` +
          `Error: ${err}`,
      );
    }
  }
}

// ============================================================================
// Type Utilities (re-exported for convenience)
// ============================================================================

/** Type-level equality check */
export type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

/** Type-level extends/subtype check */
export type Extends<A, B> = A extends B ? true : false;

/** Type-level NOT */
export type Not<T extends boolean> = T extends true ? false : true;

/** Type-level AND */
export type And<A extends boolean, B extends boolean> = A extends true
  ? B extends true
    ? true
    : false
  : false;

/** Type-level OR */
export type Or<A extends boolean, B extends boolean> = A extends true
  ? true
  : B extends true
    ? true
    : false;

/** Assert that a type is exactly `never` */
export type IsNever<T> = [T] extends [never] ? true : false;

/** Assert that a type is `any` */
export type IsAny<T> = 0 extends 1 & T ? true : false;

/** Assert that a type is `unknown` */
export type IsUnknown<T> =
  IsAny<T> extends true ? false : unknown extends T ? true : false;
