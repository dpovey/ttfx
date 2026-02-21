# Plan: Compile-Time Coordinate System Safety (Boost.Geometry-Style)

## Status: PHASE 1 IMPLEMENTED

Phase 1 (Cartesian/Polar/Spherical/Cylindrical types, operations, conversions, 2D/3D transform matrices) is implemented in `packages/geometry/`. Phase 2 (units integration, expression template fusion for transform chains) is future work.

## Inspiration

Boost.Geometry provides a geometry library where coordinate systems (Cartesian, polar, spherical), dimensions (2D, 3D), and units are tracked at the type level. You can't accidentally mix Cartesian and polar coordinates, or add a 2D point to a 3D point.

typesugar already has `@typesugar/units` for dimensional analysis on scalars. This plan extends that idea to **geometric spaces** — points, vectors, matrices, transforms — with compile-time coordinate system and dimensionality safety.

## Design

### Core Types

```typescript
import { Point, Vector, CoordSys, Cartesian, Polar, Spherical, Dim } from "@typesugar/geometry";

// Points and vectors are parameterized by coordinate system and dimension
type Point2D = Point<Cartesian, Dim<2>>;
type Point3D = Point<Cartesian, Dim<3>>;
type PolarPoint = Point<Polar, Dim<2>>;
type SpherePoint = Point<Spherical, Dim<3>>;

// Construction
const p1: Point2D = point(1, 2); // Cartesian 2D
const p2: Point3D = point(1, 2, 3); // Cartesian 3D
const p3: PolarPoint = polar(1.0, Math.PI); // Polar: r=1, θ=π
```

### Type-Safe Operations

```typescript
// Same coordinate system + dimension → OK
const sum = add(p1, point(3, 4)); // Point<Cartesian, Dim<2>>

// Different dimensions → Compile error
const bad1 = add(p1, p2);
// Error: Cannot add Point<Cartesian, Dim<2>> to Point<Cartesian, Dim<3>>

// Different coordinate systems → Compile error
const bad2 = add(p1, p3);
// Error: Cannot add Point<Cartesian, Dim<2>> to Point<Polar, Dim<2>>
// Hint: convert with toCartesian(p3) first
```

### Explicit Coordinate Conversion

```typescript
// Convert between coordinate systems (NOT implicit — this has a runtime cost)
const cartesian = toCartesian(p3); // Polar → Cartesian
const polar = toPolar(p1); // Cartesian → Polar
const spherical = toSpherical(p2); // Cartesian 3D → Spherical

// Conversions are type-safe:
const bad = toSpherical(p1);
// Error: toSpherical requires Dim<3>, got Dim<2>
```

### Integration with Units

Coordinate values can carry units from `@typesugar/units`:

```typescript
import { meters, degrees, radians } from "@typesugar/units";
import { GeoPoint, WGS84 } from "@typesugar/geometry";

// Geographic coordinates with units
type GeoCoord = Point<WGS84, Dim<2>, { lat: degrees; lon: degrees }>;

const sydney: GeoCoord = geo(-33.8688, 151.2093);
const london: GeoCoord = geo(51.5074, -0.1278);

// Great-circle distance — returns a value with unit
const dist = distance(sydney, london); // Quantity<Length> (in meters)
```

### Transform Types

```typescript
import { Transform, Rotation, Translation, Scale } from "@typesugar/geometry";

// Transforms are parameterized by from/to coordinate system and dimension
type Rotation2D = Transform<Cartesian, Cartesian, Dim<2>>;
type ProjectionMatrix = Transform<Cartesian, Cartesian, Dim<3>>;

const rot = rotate2D(Math.PI / 4); // 45° rotation
const scaled = scale2D(2, 3); // non-uniform scale

// Transform composition — types must be compatible
const combined = compose(rot, scaled); // Rotation then scale

// Apply transform
const rotated = apply(rot, p1); // Point<Cartesian, Dim<2>>

// Dimension mismatch → Compile error
const bad = apply(rot, p2);
// Error: Transform<..., Dim<2>> cannot be applied to Point<..., Dim<3>>
```

### Affine vs Linear Distinction

```typescript
import { AffinePoint, LinearVector } from "@typesugar/geometry";

// Points live in affine space — can be translated
// Vectors live in linear space — can be scaled, added
type Pos = AffinePoint<Cartesian, Dim<2>>;
type Dir = LinearVector<Cartesian, Dim<2>>;

const pos: Pos = point(1, 2);
const dir: Dir = vector(3, 4);

// Point + Vector → Point (translation)
const moved = add(pos, dir); // AffinePoint

// Vector + Vector → Vector
const combined = add(dir, dir); // LinearVector

// Point + Point → Compile error
const bad = add(pos, pos);
// Error: Cannot add two affine points. Did you mean subtract (to get a vector)?

// Point - Point → Vector
const displacement = sub(pos, point(0, 0)); // LinearVector
```

## Implementation

### Phase 1: Core Types + Cartesian Operations

**Package:** `@typesugar/geometry`

**Core types:**

```typescript
// Coordinate system brands
interface Cartesian {
  readonly __coord__: "cartesian";
}
interface Polar {
  readonly __coord__: "polar";
}
interface Spherical {
  readonly __coord__: "spherical";
}

// Dimension brand (reuse type-level arithmetic from @typesugar/type-system)
type Dim<N extends number> = { readonly __dim__: N };

// Point — branded array
type Point<CS, D extends Dim<number>> = number[] & {
  readonly __cs__: CS;
  readonly __dim__: D;
};
```

**Runtime:** Points are plain `number[]` arrays. Brands exist only in types.

**Operations:** `add`, `sub`, `scale`, `dot`, `cross`, `normalize`, `distance`, `magnitude` — all check coordinate system and dimension at compile time.

### Phase 2: Coordinate Conversions

- `toCartesian`, `toPolar`, `toSpherical` — generate conversion formulas
- `toCylindrical` for 3D
- Conversions produce compile-time type changes and runtime math

### Phase 3: Transforms + Matrices

- `Transform<From, To, D>` type for transformations
- Rotation, translation, scale, shear constructors
- Matrix representation for D=2,3,4 (homogeneous coordinates)
- Composition via matrix multiplication
- Integration with expression templates (PLAN-expression-templates) for fused transform chains

### Phase 4: Units Integration

- Coordinate values carry units from `@typesugar/units`
- `distance()` returns `Quantity<Length>`
- `angle()` returns `Quantity<Angle>`
- Geographic coordinate systems (WGS84, UTM) with lat/lon in degrees

### Phase 5: Affine vs Linear

- Separate `AffinePoint` and `LinearVector` types
- Enforce affine space rules at compile time
- Barycentric coordinates for triangle interpolation

## Zero-Cost Verification

```typescript
// add(point(1, 2), point(3, 4))
// Compiles to:
[1 + 3, 2 + 4]; // direct element-wise arithmetic

// distance(point(1, 2), point(4, 6))
// Compiles to:
Math.sqrt((4 - 1) ** 2 + (6 - 2) ** 2); // direct formula, no function call
```

All coordinate system and dimension checks are compile-time only. Runtime is pure arithmetic on `number[]`.

## Inspirations

- **Boost.Geometry** — generic geometry with coordinate system concepts
- **CGAL** — computational geometry library with kernel/representation separation
- **glam (Rust)** — zero-cost geometric types (Vec2, Vec3, Mat4)
- **nalgebra (Rust)** — dimension-generic linear algebra
- **@typesugar/units** — dimensional analysis (we extend this to geometric spaces)

## Dependencies

- `@typesugar/core` — expression macros, extension methods
- `@typesugar/type-system` — type-level arithmetic for dimensions
- `@typesugar/units` — unit tracking for coordinate values
- `@typesugar/fusion` — (optional) expression template fusion for transform chains

## Open Questions

1. Should this be a separate package (`@typesugar/geometry`) or part of `@typesugar/units`? Geometry is a superset of units, but units is useful without geometry.
2. How to handle 4D homogeneous coordinates? They're essential for 3D graphics (perspective projection) but `Dim<4>` seems wrong for 3D transforms.
3. Should we provide GLSL/WGSL codegen for WebGPU shaders? Same type safety, but targeting GPU instead of CPU.
4. How much linear algebra should be included? Just geometric operations, or full matrix decomposition (SVD, eigenvalues)?
