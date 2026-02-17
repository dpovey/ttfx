/**
 * Doobie-like SQL DSL for TypeScript
 *
 * A composable, type-safe SQL query builder inspired by Scala's Doobie.
 * Uses typemacro's compile-time transformation to provide a tagged template
 * literal syntax that compiles to efficient Fragment construction.
 *
 * ## Quick Start
 *
 * ```typescript
 * import { sql, Fragment, Query, Update } from "typemacro/sql";
 *
 * // Basic parameterised query
 * const name = "Alice";
 * const q = sql`SELECT * FROM users WHERE name = ${name}`;
 * q.text;   // "SELECT * FROM users WHERE name = $1"
 * q.values; // ["Alice"]
 *
 * // Compose fragments
 * const base   = sql`SELECT * FROM users`;
 * const cond   = sql`WHERE active = ${true}`;
 * const order  = sql`ORDER BY created_at DESC`;
 * const query  = base.append(cond).append(order);
 *
 * // Dynamic WHERE with optional conditions
 * const filters = Fragment.whereAnd([
 *   Fragment.when(!!nameFilter, () => sql`name ILIKE ${`%${nameFilter}%`}`),
 *   Fragment.when(minAge > 0,   () => sql`age >= ${minAge}`),
 *   Fragment.when(isActive,     () => sql`active = ${true}`),
 * ]);
 *
 * // IN lists
 * const ids = [1, 2, 3];
 * const inQuery = sql`SELECT * FROM users`.append(
 *   Fragment.raw("WHERE").appendNoSpace(Fragment.raw(" ")).appendNoSpace(
 *     Fragment.inList("id", ids)
 *   )
 * );
 *
 * // Bulk insert
 * const insert = sql`INSERT INTO users (name, age)`.append(
 *   Fragment.values([
 *     ["Alice", 30],
 *     ["Bob", 25],
 *   ])
 * );
 *
 * // Typed queries
 * interface User { id: number; name: string; age: number }
 * const typedQuery = query.toQuery<User>();
 * // typedQuery: Query<User>
 *
 * // Updates
 * const upd = sql`UPDATE users`.append(
 *   Fragment.set({ name: "Bob", age: 31 })
 * ).append(sql`WHERE id = ${42}`);
 * const typedUpdate = upd.toUpdate();
 * ```
 *
 * ## Fragment Composition
 *
 * Fragments can be interpolated into other fragments:
 *
 * ```typescript
 * const where = sql`WHERE id = ${id}`;
 * const full  = sql`SELECT * FROM users ${where}`;
 * // Parameters are flattened correctly
 * ```
 *
 * ## ConnectionIO (Pure Database Programs)
 *
 * ```typescript
 * import { ConnectionIO, Transactor } from "typemacro/sql";
 *
 * const program = ConnectionIO.flatMap(
 *   ConnectionIO.query(typedQuery, row => ({
 *     id: row.id as number,
 *     name: row.name as string,
 *     age: row.age as number,
 *   })),
 *   users => ConnectionIO.pure(users.filter(u => u.age > 21))
 * );
 *
 * const xa = new Transactor(pgPool);
 * const result = await xa.run(program);
 * ```
 */

// Re-export types
export {
  Fragment,
  Query,
  Update,
  ConnectionIO,
  Transactor,
  type SqlParam,
  type DbConnection,
} from "./types.js";

// Re-export macro (side-effect: registers with globalRegistry)
export { sqlMacro } from "./macro.js";

// Import for runtime helpers
import { Fragment, Query, Update, type SqlParam } from "./types.js";

// ============================================================================
// Runtime Helpers (used by macro-expanded code)
// ============================================================================

/**
 * Runtime builder called by macro-expanded sql`` expressions.
 *
 * Handles mixed interpolations: Fragment values are inlined (their SQL and
 * params merged), while plain values become bound parameters.
 *
 * @internal — called by generated code, not intended for direct use.
 */
export function __sql_build(
  segments: readonly string[],
  interpolations: readonly (SqlParam | Fragment)[],
): Fragment {
  if (interpolations.length === 0) {
    return new Fragment(segments, []);
  }

  // Fast path: no Fragment interpolations
  const hasFragments = interpolations.some((v) => v instanceof Fragment);
  if (!hasFragments) {
    return new Fragment(segments, interpolations as SqlParam[]);
  }

  // Slow path: merge Fragment interpolations into the segment/param arrays
  const newSegments: string[] = [];
  const newParams: SqlParam[] = [];

  for (let i = 0; i < segments.length; i++) {
    if (i === 0) {
      newSegments.push(segments[i]);
    }

    if (i < interpolations.length) {
      const interp = interpolations[i];

      if (interp instanceof Fragment) {
        // Merge the fragment's segments and params
        // The last segment we pushed gets the first segment of the fragment appended
        newSegments[newSegments.length - 1] += interp.segments[0];

        for (let j = 0; j < interp.params.length; j++) {
          newParams.push(interp.params[j]);
          newSegments.push(interp.segments[j + 1]);
        }

        // Append the next outer segment to the last merged segment
        if (i + 1 < segments.length) {
          newSegments[newSegments.length - 1] += segments[i + 1];
        }
      } else {
        // Plain parameter
        newParams.push(interp);
        if (i + 1 < segments.length) {
          newSegments.push(segments[i + 1]);
        }
      }
    }
  }

  return new Fragment(newSegments, newParams);
}

// ============================================================================
// Convenience Extensions on Fragment
// ============================================================================

// Extend Fragment prototype with query/update conversion methods

declare module "./types.js" {
  interface Fragment {
    /** Convert to a typed Query */
    toQuery<R>(): Query<R>;

    /** Convert to an Update */
    toUpdate(): Update;
  }
}

Fragment.prototype.toQuery = function <R>(): Query<R> {
  return new Query<R>(this);
};

Fragment.prototype.toUpdate = function (): Update {
  return new Update(this);
};

// ============================================================================
// Marker function (for non-macro usage / type checking)
// ============================================================================

/**
 * Tagged template literal for SQL fragments.
 *
 * When processed by the typemacro transformer, this is replaced with
 * optimised Fragment construction. When used without the transformer,
 * it falls back to the runtime implementation.
 *
 * @example
 * ```typescript
 * const name = "Alice";
 * const q = sql`SELECT * FROM users WHERE name = ${name}`;
 * ```
 */
export function sql(
  strings: TemplateStringsArray,
  ...values: (SqlParam | Fragment)[]
): Fragment {
  // Runtime fallback (when not processed by the macro transformer)
  return __sql_build(Array.from(strings), values);
}
