# TODO

## Roadmap

### Refined Types (inspired by Iron)

- [ ] [2026-02-21] Inline constraint syntax — `number :| Positive` instead of `Refined<number, Positive>` (Iron's `:| ` operator)
- [ ] [2026-02-21] Subtyping behavior — refined types should be true subtypes of their base type (assignable without unwrap)
- [ ] [2026-02-21] Monadic refinement API — `.refineEither()`, `.refineOption()` returning `Either`/`Option` instead of throwing
- [ ] [2026-02-21] Improved error messages — show value, constraint name, and detailed failure reason (Iron-style)
- [ ] [2026-02-21] Constraint composition — `Positive & Lt<100>` for combining constraints
- [ ] [2026-02-21] More integrations — circe-style JSON codecs that auto-validate refined types on decode
