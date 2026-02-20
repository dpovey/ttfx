/**
 * @module @typesugar/validate/types
 */

/**
 * Represents a validation error at a specific path.
 */
export interface ValidationError {
  /** The path to the invalid field (e.g., "user.address.zipCode") */
  readonly path: string;
  /** The error message describing the validation failure */
  readonly message: string;
}
