/**
 * Geometry Bridge
 *
 * Makes Vec2/Vec3 from @typesugar/geometry work with the
 * VectorSpace, InnerProduct, and Normed typeclasses from @typesugar/math.
 */

import type { Vec2, Vec3 } from "@typesugar/geometry";
import { vec2, vec3, addVec, scale, dot, magnitude } from "@typesugar/geometry";
import type { VectorSpace, InnerProduct, Normed } from "../typeclasses/index.js";

// ============================================================================
// Vec2 Instances
// ============================================================================

/**
 * VectorSpace instance for 2D Cartesian vectors.
 *
 * Treats Vec2 as vectors over the real numbers (number).
 *
 * @example
 * ```typescript
 * const a = vec2(1, 2);
 * const b = vec2(3, 4);
 *
 * vectorSpaceVec2.vAdd(a, b); // vec2(4, 6)
 * vectorSpaceVec2.vScale(2, a); // vec2(2, 4)
 * ```
 */
export const vectorSpaceVec2: VectorSpace<Vec2, number> = {
  vAdd: (a, b) => addVec(a, b),
  vScale: (scalar, v) => scale(v, scalar),
  vZero: () => vec2(0, 0),
};

/**
 * InnerProduct instance for 2D Cartesian vectors.
 *
 * Provides the standard Euclidean dot product.
 *
 * @example
 * ```typescript
 * const a = vec2(1, 0);
 * const b = vec2(0, 1);
 *
 * innerProductVec2.dot(a, b); // 0 (orthogonal)
 * innerProductVec2.dot(a, a); // 1 (unit vector)
 * ```
 */
export const innerProductVec2: InnerProduct<Vec2, number> = {
  ...vectorSpaceVec2,
  dot: (a, b) => dot(a, b),
};

/**
 * Normed instance for 2D Cartesian vectors.
 *
 * Provides the Euclidean norm (length).
 *
 * @example
 * ```typescript
 * const v = vec2(3, 4);
 * normedVec2.norm(v); // 5
 * ```
 */
export const normedVec2: Normed<Vec2, number> = {
  norm: (v) => magnitude(v),
};

// ============================================================================
// Vec3 Instances
// ============================================================================

/**
 * VectorSpace instance for 3D Cartesian vectors.
 *
 * @example
 * ```typescript
 * const a = vec3(1, 2, 3);
 * const b = vec3(4, 5, 6);
 *
 * vectorSpaceVec3.vAdd(a, b); // vec3(5, 7, 9)
 * vectorSpaceVec3.vScale(2, a); // vec3(2, 4, 6)
 * ```
 */
export const vectorSpaceVec3: VectorSpace<Vec3, number> = {
  vAdd: (a, b) => addVec(a, b),
  vScale: (scalar, v) => scale(v, scalar),
  vZero: () => vec3(0, 0, 0),
};

/**
 * InnerProduct instance for 3D Cartesian vectors.
 *
 * @example
 * ```typescript
 * const a = vec3(1, 0, 0);
 * const b = vec3(0, 1, 0);
 *
 * innerProductVec3.dot(a, b); // 0 (orthogonal)
 * ```
 */
export const innerProductVec3: InnerProduct<Vec3, number> = {
  ...vectorSpaceVec3,
  dot: (a, b) => dot(a, b),
};

/**
 * Normed instance for 3D Cartesian vectors.
 *
 * @example
 * ```typescript
 * const v = vec3(1, 2, 2);
 * normedVec3.norm(v); // 3
 * ```
 */
export const normedVec3: Normed<Vec3, number> = {
  norm: (v) => magnitude(v),
};

// ============================================================================
// Derived Operations
// ============================================================================

/**
 * Normalize a Vec2 to unit length.
 * Returns the zero vector if input is zero.
 */
export function normalizeVec2(v: Vec2): Vec2 {
  const n = normedVec2.norm(v);
  if (n === 0) return vectorSpaceVec2.vZero();
  return vectorSpaceVec2.vScale(1 / n, v);
}

/**
 * Normalize a Vec3 to unit length.
 * Returns the zero vector if input is zero.
 */
export function normalizeVec3(v: Vec3): Vec3 {
  const n = normedVec3.norm(v);
  if (n === 0) return vectorSpaceVec3.vZero();
  return vectorSpaceVec3.vScale(1 / n, v);
}

/**
 * Distance between two Vec2 points.
 */
export function distanceVec2(a: Vec2, b: Vec2): number {
  const diff = vectorSpaceVec2.vAdd(a, vectorSpaceVec2.vScale(-1, b));
  return normedVec2.norm(diff);
}

/**
 * Distance between two Vec3 points.
 */
export function distanceVec3(a: Vec3, b: Vec3): number {
  const diff = vectorSpaceVec3.vAdd(a, vectorSpaceVec3.vScale(-1, b));
  return normedVec3.norm(diff);
}

/**
 * Check if two Vec2 vectors are orthogonal.
 */
export function isOrthogonalVec2(a: Vec2, b: Vec2, epsilon: number = 1e-10): boolean {
  return Math.abs(innerProductVec2.dot(a, b)) < epsilon;
}

/**
 * Check if two Vec3 vectors are orthogonal.
 */
export function isOrthogonalVec3(a: Vec3, b: Vec3, epsilon: number = 1e-10): boolean {
  return Math.abs(innerProductVec3.dot(a, b)) < epsilon;
}

/**
 * Project Vec2 a onto Vec2 b.
 */
export function projectVec2(a: Vec2, b: Vec2): Vec2 {
  const dotAB = innerProductVec2.dot(a, b);
  const dotBB = innerProductVec2.dot(b, b);
  if (dotBB === 0) return vectorSpaceVec2.vZero();
  return vectorSpaceVec2.vScale(dotAB / dotBB, b);
}

/**
 * Project Vec3 a onto Vec3 b.
 */
export function projectVec3(a: Vec3, b: Vec3): Vec3 {
  const dotAB = innerProductVec3.dot(a, b);
  const dotBB = innerProductVec3.dot(b, b);
  if (dotBB === 0) return vectorSpaceVec3.vZero();
  return vectorSpaceVec3.vScale(dotAB / dotBB, b);
}
