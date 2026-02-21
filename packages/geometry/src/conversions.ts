import type {
  CylindricalPoint,
  Dim2,
  Point2D,
  Point3D,
  Polar,
  PolarPoint,
  SphericalPoint,
  Vec2,
  Vec3,
  Vector,
} from "./types.js";

// ---------------------------------------------------------------------------
// Cartesian <-> Polar (2D)
// ---------------------------------------------------------------------------

/** Convert a Cartesian 2D point to polar coordinates (r, theta) */
export function cartesianToPolar(p: Point2D): PolarPoint {
  const r = Math.sqrt(p[0] * p[0] + p[1] * p[1]);
  const theta = Math.atan2(p[1], p[0]);
  return [r, theta] as PolarPoint;
}

/** Convert a polar point (r, theta) to Cartesian 2D */
export function polarToCartesian(p: PolarPoint): Point2D {
  return [p[0] * Math.cos(p[1]), p[0] * Math.sin(p[1])] as Point2D;
}

// ---------------------------------------------------------------------------
// Cartesian <-> Spherical (3D)
// Convention: (r, theta=inclination from +z, phi=azimuth from +x in xy-plane)
// ---------------------------------------------------------------------------

/** Convert a Cartesian 3D point to spherical coordinates (r, theta, phi) */
export function cartesianToSpherical(p: Point3D): SphericalPoint {
  const r = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
  const theta = r === 0 ? 0 : Math.acos(Math.max(-1, Math.min(1, p[2] / r)));
  const phi = Math.atan2(p[1], p[0]);
  return [r, theta, phi] as SphericalPoint;
}

/** Convert a spherical point (r, theta, phi) to Cartesian 3D */
export function sphericalToCartesian(p: SphericalPoint): Point3D {
  const sinTheta = Math.sin(p[1]);
  return [
    p[0] * sinTheta * Math.cos(p[2]),
    p[0] * sinTheta * Math.sin(p[2]),
    p[0] * Math.cos(p[1]),
  ] as Point3D;
}

// ---------------------------------------------------------------------------
// Cartesian <-> Cylindrical (3D)
// Convention: (r, theta=azimuth from +x in xy-plane, z)
// ---------------------------------------------------------------------------

/** Convert a Cartesian 3D point to cylindrical coordinates (r, theta, z) */
export function cartesianToCylindrical(p: Point3D): CylindricalPoint {
  const r = Math.sqrt(p[0] * p[0] + p[1] * p[1]);
  const theta = Math.atan2(p[1], p[0]);
  return [r, theta, p[2]] as CylindricalPoint;
}

/** Convert a cylindrical point (r, theta, z) to Cartesian 3D */
export function cylindricalToCartesian(p: CylindricalPoint): Point3D {
  return [p[0] * Math.cos(p[1]), p[0] * Math.sin(p[1]), p[2]] as Point3D;
}

// ---------------------------------------------------------------------------
// Vector conversions (same math, different branding)
// ---------------------------------------------------------------------------

/** Convert a Cartesian 2D vector to polar representation */
export function vecCartesianToPolar(v: Vec2): Vector<Polar, Dim2> {
  const r = Math.sqrt(v[0] * v[0] + v[1] * v[1]);
  const theta = Math.atan2(v[1], v[0]);
  return [r, theta] as Vector<Polar, Dim2>;
}

/** Convert a polar 2D vector to Cartesian representation */
export function vecPolarToCartesian(v: Vector<Polar, Dim2>): Vec2 {
  return [v[0] * Math.cos(v[1]), v[0] * Math.sin(v[1])] as Vec2;
}
