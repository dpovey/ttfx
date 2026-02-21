# TODO

## Roadmap

### Refined Type Integration

- [ ] [2026-02-21] Wire `generateValidationChecks` to recognize `Refined<Base, Brand>` types — when a field or parameter has a refined type, look up the `Refinement` predicate from the registry and emit `.is()` / `.refine()` checks instead of just checking the base type
- [ ] [2026-02-21] Import `REFINEMENT_PREDICATES` from `@typesugar/type-system` so the macro can resolve brand names to predicates at compile time without requiring `@typesugar/contracts-refined`
- [ ] [2026-02-21] `@validate` attribute macro — decorator on functions that auto-generates validation for all parameters based on their types (including refined types), as a cross-cutting concern
- [ ] [2026-02-21] Compose with `@typesugar/contracts` — when both `@validate` and `@contract` are on the same function, `@validate` should check structural shape and refinements, while `@contract` handles semantic pre/postconditions; avoid duplicating checks

### Schema Typeclass Integration

- [ ] [2026-02-21] Bridge `Schema` typeclass to refined types — `Schema.parse()` should automatically validate refinements on the output type
- [ ] [2026-02-21] Zod/Valibot adapter should map `Refined<number, "Positive">` to `z.number().positive()` automatically

### Depth and Coverage

- [ ] [2026-02-21] Recursive array element validation — currently only checks `Array.isArray()`, should recurse into element types
- [ ] [2026-02-21] Discriminated union validation — detect discriminant field and generate switch-based validation
- [ ] [2026-02-21] Literal type validation — `"admin" | "user"` should check against the literal values
- [ ] [2026-02-21] Tuple validation — validate length and per-position types
