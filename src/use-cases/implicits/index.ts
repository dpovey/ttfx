/**
 * @instance + @using Demo
 *
 * This file demonstrates the implicit parameter system using:
 * - `@instance` - Register typeclass instances (already exists in typeclass.ts)
 * - `@using` - Mark parameters to be filled automatically
 *
 * ## How It Works
 *
 * 1. Register typeclass instances with `@instance`
 * 2. Mark function parameters with `@using`
 * 3. At call sites, missing `@using` arguments are resolved from the instance registry
 *
 * @example
 * ```typescript
 * // 1. Register instances with @instance
 * @instance
 * const showNumber: Show<number> = {
 *   show: (a) => String(a),
 * };
 *
 * // 2. Declare functions with @using parameters
 * function print<A>(a: A, @using S: Show<A>): void {
 *   console.log(S.show(a));
 * }
 *
 * // 3. Call without explicit instances!
 * print(42);  // → print(42, Show.summon<number>("number"))
 * ```
 */

// ============================================================================
// Show typeclass (simulated - in real usage would use @typeclass)
// ============================================================================

interface Show<A> {
  show(a: A): string;
}

const showInstances = new Map<string, Show<any>>();

const Show = {
  registerInstance<A>(typeName: string, instance: Show<A>): void {
    showInstances.set(typeName, instance);
  },
  summon<A>(typeName: string): Show<A> {
    const instance = showInstances.get(typeName);
    if (!instance) {
      throw new Error(`No Show instance for ${typeName}`);
    }
    return instance;
  },
};

// ============================================================================
// @instance declarations
// ============================================================================

// @instance
const showNumber: Show<number> = {
  show: (a) => String(a),
};
Show.registerInstance<number>("number", showNumber);

// @instance
const showString: Show<string> = {
  show: (a) => JSON.stringify(a),
};
Show.registerInstance<string>("string", showString);

// @instance
const showBoolean: Show<boolean> = {
  show: (a) => (a ? "true" : "false"),
};
Show.registerInstance<boolean>("boolean", showBoolean);

// ============================================================================
// Eq typeclass
// ============================================================================

interface Eq<A> {
  equals(a: A, b: A): boolean;
}

const eqInstances = new Map<string, Eq<any>>();

const Eq = {
  registerInstance<A>(typeName: string, instance: Eq<A>): void {
    eqInstances.set(typeName, instance);
  },
  summon<A>(typeName: string): Eq<A> {
    const instance = eqInstances.get(typeName);
    if (!instance) {
      throw new Error(`No Eq instance for ${typeName}`);
    }
    return instance;
  },
};

// @instance
const eqNumber: Eq<number> = {
  equals: (a, b) => a === b,
};
Eq.registerInstance<number>("number", eqNumber);

// @instance
const eqString: Eq<string> = {
  equals: (a, b) => a === b,
};
Eq.registerInstance<string>("string", eqString);

// ============================================================================
// Functions with @using parameters
// ============================================================================

/**
 * Print a value using its Show instance.
 *
 * With @using:
 *   print(42)  →  print(42, Show.summon<number>("number"))
 */
function print<A>(a: A, /* @using */ S: Show<A>): void {
  console.log(S.show(a));
}

/**
 * Convert to string representation.
 */
function stringify<A>(a: A, /* @using */ S: Show<A>): string {
  return S.show(a);
}

/**
 * Check equality using Eq instance.
 */
function isEqual<A>(a: A, b: A, /* @using */ E: Eq<A>): boolean {
  return E.equals(a, b);
}

/**
 * Find element in list using Eq instance.
 */
function find<A>(list: A[], target: A, /* @using */ E: Eq<A>): A | undefined {
  return list.find((x) => E.equals(x, target));
}

/**
 * Multiple @using parameters.
 */
function showAndCompare<A>(
  a: A,
  b: A,
  /* @using */ S: Show<A>,
  /* @using */ E: Eq<A>,
): string {
  const eq = E.equals(a, b) ? "==" : "!=";
  return `${S.show(a)} ${eq} ${S.show(b)}`;
}

// ============================================================================
// Demo
// ============================================================================

console.log("=== @instance + @using Demo ===\n");

// Currently passing instances explicitly:
print(42, showNumber);
print("hello", showString);
print(true, showBoolean);

// With @using macro, we would write:
// print(42);
// print("hello");
// print(true);

console.log("\n=== Eq typeclass ===\n");
console.log(`isEqual(1, 1): ${isEqual(1, 1, eqNumber)}`);
console.log(`isEqual(1, 2): ${isEqual(1, 2, eqNumber)}`);

// With @using:
// console.log(`isEqual(1, 1): ${isEqual(1, 1)}`);

console.log("\n=== Multiple @using params ===\n");
console.log(showAndCompare(1, 1, showNumber, eqNumber));
console.log(showAndCompare(1, 2, showNumber, eqNumber));

// With @using:
// console.log(showAndCompare(1, 1));
// console.log(showAndCompare(1, 2));

console.log("\n=== Find in list ===\n");
const result = find([1, 2, 3, 4, 5], 3, eqNumber);
console.log(`find([1,2,3,4,5], 3): ${result}`);

// With @using:
// const result = find([1, 2, 3, 4, 5], 3);

// ============================================================================
// Summary
// ============================================================================

/**
 * The @instance + @using system:
 *
 * 1. `@instance` (from typeclass.ts) - Registers typeclass instances
 *    @instance
 *    const showNumber: Show<number> = { show: String };
 *
 * 2. `@using` parameter decorator - Marks params for implicit resolution
 *    function print<A>(a: A, @using S: Show<A>): void { ... }
 *
 * 3. Call-site transformation - Automatically fills missing args
 *    print(42)  →  print(42, Show.summon<number>("number"))
 *
 * 4. `summonAll<T1, T2>()` - Summon multiple instances
 *    const [s, e] = summonAll<Show<Point>, Eq<Point>>();
 *
 * Integration:
 * - Works with @typeclass for defining typeclasses
 * - Works with @deriving for auto-derived instances
 * - Works with implicit extension methods (x.show())
 */
