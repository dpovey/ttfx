# Package Reference

All typesugar packages with their exports.

## Core

### @typesugar/transformer

The TypeScript transformer that expands macros.

```bash
npm install --save-dev @typesugar/transformer
```

**Exports:**

- Default export: transformer factory
- CLI: `typesugar` command

### @typesugar/core

Macro registration and types.

```bash
npm install @typesugar/core
```

**Exports:**

```typescript
// Registration
defineExpressionMacro;
defineAttributeMacro;
defineDeriveMacro;
defineTaggedTemplateMacro;
defineTypeMacro;
defineLabeledBlockMacro;

// Types
MacroContext;
MacroDefinition;
DeriveTypeInfo;
ComptimeValue;

// Configuration
config;
cfg;
cfgAttr;
```

### unplugin-typesugar

Bundler plugins for Vite, Webpack, esbuild, Rollup.

```bash
npm install --save-dev unplugin-typesugar
```

**Exports:**

```typescript
import typesugar from "unplugin-typesugar/vite";
import typesugar from "unplugin-typesugar/webpack";
import typesugar from "unplugin-typesugar/esbuild";
import typesugar from "unplugin-typesugar/rollup";
```

### typesugar

Umbrella package including all common packages.

```bash
npm install typesugar
```

Includes: core, comptime, derive, reflect, operators, typeclass, specialize.

## Macros

### @typesugar/comptime

Compile-time evaluation.

```bash
npm install @typesugar/comptime
```

**Exports:**

```typescript
comptime;
```

### @typesugar/derive

Auto-derive implementations.

```bash
npm install @typesugar/derive
```

**Exports:**

```typescript
derive;
(Eq, Ord, Clone, Debug, Hash, Default, Json, Builder, TypeGuard);
(deriveIgnore, deriveWith);
```

### @typesugar/reflect

Type reflection.

```bash
npm install @typesugar/reflect
```

**Exports:**

```typescript
reflect(decorator);
typeInfo<T>();
fieldNames<T>();
validator<T>();
```

### @typesugar/operators

Operator overloading.

```bash
npm install @typesugar/operators
```

**Exports:**

```typescript
operators(decorator);
ops();
pipe();
compose();
```

### @typesugar/typeclass

Scala 3-style typeclasses.

```bash
npm install @typesugar/typeclass
```

**Exports:**

```typescript
typeclass (decorator)
instance (decorator)
deriving (decorator)
summon<T>()
summonAll<...>()
extend()
implicits (decorator)
```

### @typesugar/specialize

Zero-cost specialization.

```bash
npm install @typesugar/specialize
```

**Exports:**

```typescript
specialize();
```

## Domain-Specific

### @typesugar/sql

Type-safe SQL.

```bash
npm install @typesugar/sql
```

**Exports:**

```typescript
sql (tagged template)
raw()
```

### @typesugar/strings

String validation macros.

```bash
npm install @typesugar/strings
```

**Exports:**

```typescript
regex (tagged template)
html (tagged template)
json (tagged template)
```

### @typesugar/units

Physical units.

```bash
npm install @typesugar/units
```

**Exports:**

```typescript
units (tagged template)
```

### @typesugar/contracts

Design by contract.

```bash
npm install @typesugar/contracts
```

**Exports:**

```typescript
requires (labeled block)
ensures (labeled block)
invariant (decorator)
old()
assert()
configure()
```

### @typesugar/contracts-z3

Z3 SMT solver integration.

```bash
npm install @typesugar/contracts-z3
```

**Exports:**

```typescript
prove();
```

### @typesugar/contracts-refined

Refinement types.

```bash
npm install @typesugar/contracts-refined
```

**Exports:**

```typescript
Refined<T, P>;
(Positive, Negative, NonZero);
(NonEmpty, MaxLength, MinLength);
// ... more predicates
```

## Functional Programming

### @typesugar/fp

FP utilities.

```bash
npm install @typesugar/fp
```

**Exports:**

```typescript
// Option
(Option, Some, None);

// Result
(Result, Ok, Err);

// Either
(Either, Left, Right);

// Validated
(Validated, Valid, Invalid);

// IO
IO;

// List
(List, Cons, Nil);

// Pattern matching
match;

// Typeclasses
(Functor, Applicative, Monad);
(Semigroup, Monoid);
(Eq, Ord, Show);
```

### @typesugar/std

Standard library extensions.

```bash
npm install @typesugar/std
```

**Exports:**

```typescript
// Extension methods
(NumberExt, StringExt, ArrayExt);
extend();
registerExtensions();

// FlatMap for do-notation
FlatMap;
registerFlatMap();
```

### @typesugar/type-system

Advanced types.

```bash
npm install @typesugar/type-system
```

**Exports:**

```typescript
// HKT
($, Kind);

// Newtype
(Newtype, newtype);

// Phantom types
Phantom;

// Refinement
Refined;
```

## Adapters

### @typesugar/effect

Effect-TS integration.

```bash
npm install @typesugar/effect
```

### @typesugar/kysely

Kysely integration.

```bash
npm install @typesugar/kysely
```

**Exports:**

```typescript
kyselySql;
```

### @typesugar/react

React macros.

```bash
npm install @typesugar/react
```

## Tooling

### @typesugar/testing

Testing utilities.

```bash
npm install --save-dev @typesugar/testing
```

**Exports:**

```typescript
expandCode();
expandMacro();
assertExpands();
```

### @typesugar/eslint-plugin

ESLint plugin.

```bash
npm install --save-dev @typesugar/eslint-plugin
```

**Exports:**

```typescript
configs.recommended;
configs.full;
configs.strict;
```

### @typesugar/vscode

VSCode extension (install from marketplace).

### @typesugar/preprocessor

Lexical preprocessor for custom syntax.

```bash
npm install --save-dev @typesugar/preprocessor
```

**Exports:**

```typescript
preprocess();
```

## Peer Dependencies

Most packages have:

- `typescript: >=5.0.0`
- `@typesugar/transformer: >=0.1.0` (peer)

Check each package's package.json for specifics.
