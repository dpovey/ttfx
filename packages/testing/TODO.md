# TODO

## Roadmap

### Arbitrary Generation

- [ ] [2026-02-21] Field-level range configuration — `@arb.range(0, 100)` or refined types `x: Range<0, 100>` for domain-appropriate test values
- [ ] [2026-02-21] Refined type integration — auto-generate valid values for `Positive`, `Port`, `Email`, etc. (Iron + ScalaCheck pattern)
- [ ] [2026-02-21] Shrinking support — when tests fail, shrink to minimal failing case
- [ ] [2026-02-21] Generator combinators — `Arbitrary.oneOf()`, `Arbitrary.frequency()`, `Arbitrary.suchThat()`
