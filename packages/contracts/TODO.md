# TODO

## Roadmap

### Cross-Cutting Concern Infrastructure

- [ ] [2026-02-21] `@traced` attribute macro — wraps functions in OpenTelemetry spans with type-aware attribute extraction (inspect parameter types at compile time, auto-extract `.id`, `.name`, etc. as span attributes)
- [ ] [2026-02-21] `@profiled` attribute macro — wraps function bodies with `performance.now()` timing, strippable via `cfg("profile")` for zero-cost in production
- [ ] [2026-02-21] `@logged` attribute macro (production-grade) — the docs tutorial shows a basic `@logged`, but a real version should: use structured logging, extract argument types via `Show` typeclass, handle async functions, be strippable via `cfg()`
- [ ] [2026-02-21] `@timeout` attribute macro — wraps async functions with `Promise.race` deadline, strippable in test environments
- [ ] [2026-02-21] `@retry` attribute macro — wraps async functions with configurable retry logic (count, backoff, exception filter), strippable via `cfg()`

### Compile-Time-Only Analysis (Zero Runtime Cost)

- [ ] [2026-02-21] `@deprecated` attribute macro — beyond JSDoc, emit compile-time errors/warnings at _call sites_ by scanning the module graph; auto-suggest replacement; enforceable as error in CI
- [ ] [2026-02-21] `@mustUse` attribute macro (Rust `#[must_use]`) — emit compile-time warning when return value is discarded, particularly for `Result`/`Option` types
- [ ] [2026-02-21] Capability tracking — `@requires("database")` / `@provides("database")` macros that build a compile-time capability graph and emit errors when capabilities are used without being provided

### Security / Taint Tracking

- [ ] [2026-02-21] `@tainted` / `@sanitized` attribute macros — use branded types (`Refined`) to track tainted data through the program; compile-time error when tainted values reach sensitive sinks (SQL queries, `innerHTML`, etc.)
- [ ] [2026-02-21] Taint propagation rules — define which operations preserve/clear taint (e.g., string concatenation preserves taint, `escapeHtml()` clears it)
- [ ] [2026-02-21] Integration with `@typesugar/sql` — taint tracking should compose with the SQL macro to prevent injection

### Contract System Improvements

- [ ] [2026-02-21] Cross-function contract propagation — if `f` calls `g` and `g` has a precondition, verify that `f`'s context satisfies it (inter-procedural analysis)
- [ ] [2026-02-21] `@transactional` attribute macro — wraps database operations in transactions, rolls back on exception; compose with `@contract` so postconditions are checked before commit
