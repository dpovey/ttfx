# TODO

## Roadmap

### Cross-Cutting Macro Infrastructure

- [ ] [2026-02-21] `cfg()`-aware macro stripping — attribute macros that wrap function bodies (profiling, logging, tracing, retry) need a standard pattern for conditional compilation; currently each macro would re-implement `cfg()` checking independently
- [ ] [2026-02-21] `defineWrappingMacro()` helper — a higher-level API for the common "wrap function body with before/after/around" pattern; handles async functions, generators, arrow functions, and method declarations uniformly
- [ ] [2026-02-21] Macro composition ordering for cross-cutting concerns — when multiple body-wrapping macros are applied (`@traced @retry @timeout`), the nesting order matters; document the convention and validate via `expandAfter`
- [ ] [2026-02-21] Expansion depth limit / cycle detection — the transformer recursively re-visits macro expansion results but has no documented termination guarantee; cross-cutting macros that generate calls to other macros make this more likely

### Call-Site Analysis Infrastructure

- [ ] [2026-02-21] `defineCallSiteMacro()` — infrastructure for macros that analyze _call sites_ rather than definitions (needed for `@deprecated`, `@mustUse`); requires post-expansion module graph traversal
- [ ] [2026-02-21] Module graph integration — `moduleIndex()` and `collectTypes()` exist but aren't used by the transformer for cross-cutting analysis; wire them into the expansion pipeline so macros can query callers/callees
