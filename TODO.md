# typesugar TODO

## Cool Language Features to Implement

1. **Zero-Cost Optics (`@optics` / `Lens`)**
   - **What:** A macro that generates type-safe, zero-cost lenses for data structures.
   - **Why:** Deep immutable updates in TypeScript are verbose. This compiles to direct object spread operations with zero runtime overhead and fully typed paths.

2. **Algebraic Data Types (`@adt`)**
   - **What:** A concise syntax for defining ADTs that auto-generates constructors, type guards, and matchers.
   - **Why:** Reduces boilerplate for sum types and pairs perfectly with the existing `match` macro in `@typesugar/std`.

3. ~~**Structural Pattern Matching (`match!`)**~~ ✅ **Done**
   - Unified `match()` macro in `@typesugar/std` with:
     - Compile-time exhaustiveness checking via type checker
     - Auto-detected discriminants (`kind`, `_tag`, `type`, `tag`, `ok`, etc.)
     - `when()`/`otherwise()` guard syntax
     - **OR patterns**: pipe-separated keys (`"circle|square"`) compile to `||` conditions or switch fall-through
     - **Type patterns**: `isType("string")` → `typeof`, `isType(Date)` → `instanceof`, `isType("null")` → `=== null`
     - **Array/structural helpers**: `P.empty`, `P.length(n)`, `P.minLength(n)`, `P.between(lo, hi)`, `P.oneOf(...)`, `P.head(pred)`, `P.has(key)`, `P.regex(re)` — all inlined at compile time
     - Binary search for sparse integers (O(log n))
     - Switch IIFE for large case counts (V8-optimized)
     - Backwards-compatible `matchLiteral`/`matchGuard` aliases
   - **Future enhancement:** Nested pattern merging (decision tree fusion across nested `match()` calls).

4. **Zero-Cost Array Comprehensions**
   - **What:** A macro that compiles declarative list comprehensions (e.g., `[for (x of items) if (x > 0) x * 2]`) into highly optimized, single-pass `for` loops.
   - **Why:** Avoids intermediate array allocations from `.map().filter()`, fitting the zero-cost abstraction philosophy perfectly.

5. **Implicit Context Passing (Scala 3 `using` style)**
   - **What:** A system where functions can declare implicit parameters, and a macro automatically threads the current context through the call graph.
   - **Why:** Removes the need to manually pass a context (like config or environment) everywhere or rely on runtime context providers.

6. **Keyword / Named Arguments**
   - **What:** A preprocessor feature that allows calling functions with named arguments (e.g., `fn(a=1, b=2)`).
   - **Why:** The macro rewrites them into positional arguments at compile time based on the function signature, bringing Python/C#-style named arguments to TS with zero runtime cost.

7. **Deep-Type Compatibility Checking (`@typesugar/mapper`)**
   - **What:** Add recursive deep-type compatibility checking to the `transformInto` macro.
   - **Why:** To ensure nested objects and complex mappings strictly adhere to the target type without runtime mapping errors.
