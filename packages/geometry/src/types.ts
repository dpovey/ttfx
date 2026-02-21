/** Cartesian coordinate system (x, y [, z]) */
export interface Cartesian {
  readonly __coord__: "cartesian";
}

/** Polar coordinate system (r, theta) */
export interface Polar {
  readonly __coord__: "polar";
}

/** Spherical coordinate system (r, theta, phi) */
export interface Spherical {
  readonly __coord__: "spherical";
}

/** Cylindrical coordinate system (r, theta, z) */
export interface Cylindrical {
  readonly __coord__: "cylindrical";
}

/** Union of all coordinate system brands */
export type CoordSys = Cartesian | Polar | Spherical | Cylindrical;

/** Dimension brand — `N` is the number of components */
export interface Dim<N extends number> {
  readonly __dim__: N;
}

/** Two-dimensional */
export type Dim2 = Dim<2>;

/** Three-dimensional */
export type Dim3 = Dim<3>;

/**
 * A point in coordinate system `CS` with dimensionality `D`.
 *
 * At runtime this is a plain `number[]` — brands exist only in the type system.
 */
export type Point<CS extends CoordSys, D extends Dim<number>> = number[] & {
  readonly __point__: true;
  readonly __cs__: CS;
  readonly __dim__: D;
};

/**
 * A displacement vector in coordinate system `CS` with dimensionality `D`.
 *
 * Same runtime representation as `Point`, but distinguished at the type level
 * so that point-vs-vector semantics (e.g. translation invariance) are enforced.
 */
export type Vector<CS extends CoordSys, D extends Dim<number>> = number[] & {
  readonly __vector__: true;
  readonly __cs__: CS;
  readonly __dim__: D;
};

/** Cartesian 2D point */
export type Point2D = Point<Cartesian, Dim2>;

/** Cartesian 3D point */
export type Point3D = Point<Cartesian, Dim3>;

/** Cartesian 2D vector */
export type Vec2 = Vector<Cartesian, Dim2>;

/** Cartesian 3D vector */
export type Vec3 = Vector<Cartesian, Dim3>;

/** Polar 2D point (r, theta) */
export type PolarPoint = Point<Polar, Dim2>;

/** Spherical 3D point (r, theta, phi) */
export type SphericalPoint = Point<Spherical, Dim3>;

/** Cylindrical 3D point (r, theta, z) */
export type CylindricalPoint = Point<Cylindrical, Dim3>;

/**
 * An affine transform from coordinate system `FromCS` to `ToCS` in dimension `D`.
 *
 * At runtime: a flat `number[]` storing a homogeneous matrix in row-major order.
 * - 2D: 3x3 → 9 elements
 * - 3D: 4x4 → 16 elements
 */
export type Transform<
  FromCS extends CoordSys,
  ToCS extends CoordSys,
  D extends Dim<number>,
> = number[] & {
  readonly __transform__: true;
  readonly __fromCS__: FromCS;
  readonly __toCS__: ToCS;
  readonly __dim__: D;
};
