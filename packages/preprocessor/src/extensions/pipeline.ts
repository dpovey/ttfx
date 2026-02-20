/**
 * Pipeline operator extension: |>
 *
 * Transforms: expr |> f |> g
 * To: __binop__(__binop__(expr, "|>", f), "|>", g)
 *
 * The __binop__ function is resolved by the macro transformer based on the
 * left operand's type:
 * - If the type has @operator('|>') → rewrite to method call (e.g., expr.pipe(f))
 * - Default fallback: f(expr) (standard pipeline semantics)
 *
 * Precedence: 1 (lowest custom operator)
 * Associativity: left (a |> b |> c = (a |> b) |> c)
 */

import type { CustomOperatorExtension } from "./types.js";

export const pipelineExtension: CustomOperatorExtension = {
  name: "pipeline",
  symbol: "|>",
  precedence: 1,
  associativity: "left",

  transform(left: string, right: string): string {
    return `__binop__(${left}, "|>", ${right})`;
  },
};

export default pipelineExtension;
