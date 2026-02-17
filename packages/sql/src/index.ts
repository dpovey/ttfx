/**
 * @ttfx/sql - Doobie-like Type-Safe SQL DSL
 *
 * This module provides:
 * - Fragment class for composable SQL building
 * - Query and Update wrappers with type branding
 * - ConnectionIO for pure database operation descriptions
 * - Transactor for interpreting ConnectionIO programs
 * - sql`` macro for compile-time SQL validation
 *
 * @example
 * ```typescript
 * import { sql, Fragment, Query, Transactor } from "@ttfx/sql";
 *
 * const name = "Alice";
 * const age = 30;
 *
 * const query = sql`SELECT * FROM users WHERE name = ${name} AND age > ${age}`;
 * console.log(query.text);   // "SELECT * FROM users WHERE name = $1 AND age > $2"
 * console.log(query.params); // ["Alice", 30]
 * ```
 */

// Re-export types and classes
export type { SqlParam, DbConnection } from "./types.js";
export { Fragment, Query, Update, ConnectionIO, Transactor } from "./types.js";

// Re-export macro
export { sqlMacro, register } from "./macro.js";

// ============================================================================
// Runtime Helper (used by the sql macro)
// ============================================================================

import { Fragment, SqlParam } from "./types.js";

/**
 * Runtime helper for sql`` macro.
 *
 * Handles both Fragment interpolations (which get inlined) and
 * plain values (which become bound parameters).
 */
export function __sql_build(
  segments: string[],
  interpolations: unknown[],
): Fragment {
  const resultSegments: string[] = [];
  const resultParams: SqlParam[] = [];

  for (let i = 0; i < segments.length; i++) {
    if (i === 0) {
      resultSegments.push(segments[i]);
    } else {
      const interp = interpolations[i - 1];

      if (interp instanceof Fragment) {
        // Inline the fragment
        const lastIdx = resultSegments.length - 1;
        resultSegments[lastIdx] += interp.segments[0];
        for (let j = 1; j < interp.segments.length; j++) {
          resultSegments.push(interp.segments[j]);
        }
        resultParams.push(...interp.params);
        // Append the next segment to the last one
        resultSegments[resultSegments.length - 1] += segments[i];
      } else {
        // It's a plain parameter
        resultParams.push(interp as SqlParam);
        resultSegments.push(segments[i]);
      }
    }
  }

  return new Fragment(resultSegments, resultParams);
}

// ============================================================================
// Prototype Extensions for Fragment
// ============================================================================

declare module "./types.js" {
  interface Fragment {
    /** Convert this fragment to a typed Query */
    toQuery<R>(): Query<R>;
    /** Convert this fragment to an Update */
    toUpdate(): Update;
  }
}

import { Query, Update } from "./types.js";

Fragment.prototype.toQuery = function <R>(): Query<R> {
  return new Query<R>(this);
};

Fragment.prototype.toUpdate = function (): Update {
  return new Update(this);
};

// ============================================================================
// Fallback sql function for non-macro usage
// ============================================================================

/**
 * Tagged template function for SQL - fallback when macro transform isn't applied.
 *
 * This allows the same code to work even without the macro transformer,
 * though you lose compile-time validation.
 */
export function sql(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Fragment {
  return __sql_build([...strings], values);
}
