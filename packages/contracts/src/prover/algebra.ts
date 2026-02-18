/**
 * Algebraic Proof Rules
 *
 * Pattern-matching rules that can prove simple arithmetic and logical
 * properties from known type facts. Each rule encodes a theorem like
 * "if x > 0 and y > 0, then x + y > 0".
 *
 * Rules operate on normalized predicate strings (from predicate.ts).
 */

import type { TypeFact } from "./type-facts.js";
import type { ProofResult } from "./index.js";
import type { ProofStep } from "./certificate.js";

/**
 * Match result with used facts for proof certificates.
 */
interface MatchResult {
  matched: boolean;
  usedFacts: TypeFact[];
}

/**
 * An algebraic proof rule.
 */
export interface AlgebraicRule {
  name: string;
  description: string;
  /** Simple match check for backwards compatibility */
  match: (goal: string, facts: TypeFact[]) => boolean;
  /** Extended match that returns used facts for proof certificates */
  matchWithFacts?: (goal: string, facts: TypeFact[]) => MatchResult;
}

/**
 * Check if a fact set contains a specific predicate for a variable.
 */
function hasFact(
  facts: TypeFact[],
  variable: string,
  predicate: string,
): boolean {
  return facts.some(
    (f) => f.variable === variable && f.predicate.includes(predicate),
  );
}

/**
 * Get the fact matching a variable and predicate pattern.
 */
function getFact(
  facts: TypeFact[],
  variable: string,
  predicate: string,
): TypeFact | undefined {
  return facts.find(
    (f) => f.variable === variable && f.predicate.includes(predicate),
  );
}

function hasFactMatching(facts: TypeFact[], pattern: RegExp): boolean {
  return facts.some((f) => pattern.test(f.predicate));
}

/**
 * Extended result with proof step information.
 */
export interface AlgebraicProofResult extends ProofResult {
  /** Detailed proof step for certificates */
  step?: ProofStep;
}

/**
 * Built-in algebraic proof rules.
 */
const RULES: AlgebraicRule[] = [
  // --- Positivity propagation ---
  {
    name: "sum_of_positives",
    description: "x > 0 ∧ y > 0 → x + y > 0",
    match(goal, facts) {
      const m = goal.match(/^(\w+)\s*\+\s*(\w+)\s*>\s*0$/);
      if (!m) return false;
      return hasFact(facts, m[1], "> 0") && hasFact(facts, m[2], "> 0");
    },
  },
  {
    name: "sum_of_non_negatives",
    description: "x >= 0 ∧ y >= 0 → x + y >= 0",
    match(goal, facts) {
      const m = goal.match(/^(\w+)\s*\+\s*(\w+)\s*>=\s*0$/);
      if (!m) return false;
      return hasFact(facts, m[1], ">= 0") && hasFact(facts, m[2], ">= 0");
    },
  },
  {
    name: "positive_implies_non_negative",
    description: "x > 0 → x >= 0",
    match(goal, facts) {
      const m = goal.match(/^(\w+)\s*>=\s*0$/);
      if (!m) return false;
      return hasFact(facts, m[1], "> 0");
    },
  },

  // --- Multiplication ---
  {
    name: "double_positive",
    description: "x > 0 → 2 * x > x",
    match(goal, facts) {
      const m = goal.match(/^2\s*\*\s*(\w+)\s*>\s*(\w+)$/);
      if (!m) return false;
      return m[1] === m[2] && hasFact(facts, m[1], "> 0");
    },
  },
  {
    name: "product_of_positives",
    description: "x > 0 ∧ y > 0 → x * y > 0",
    match(goal, facts) {
      const m = goal.match(/^(\w+)\s*\*\s*(\w+)\s*>\s*0$/);
      if (!m) return false;
      return hasFact(facts, m[1], "> 0") && hasFact(facts, m[2], "> 0");
    },
  },

  // --- Comparison transitivity ---
  {
    name: "positive_greater_than_negative",
    description: "x > 0 ∧ y < 0 → x > y",
    match(goal, facts) {
      const m = goal.match(/^(\w+)\s*>\s*(\w+)$/);
      if (!m) return false;
      return hasFact(facts, m[1], "> 0") && hasFact(facts, m[2], "< 0");
    },
  },

  // --- Bounds ---
  {
    name: "byte_in_range",
    description: "Byte → x >= 0 && x <= 255",
    match(goal, facts) {
      const m = goal.match(/^(\w+)\s*>=\s*0\s*&&\s*\1\s*<=\s*255$/);
      if (!m) return false;
      return hasFact(facts, m[1], ">= 0") && hasFact(facts, m[1], "<= 255");
    },
  },
  {
    name: "port_in_range",
    description: "Port → x >= 1 && x <= 65535",
    match(goal, facts) {
      const m = goal.match(/^(\w+)\s*>=\s*1\s*&&\s*\1\s*<=\s*65535$/);
      if (!m) return false;
      return hasFact(facts, m[1], ">= 1") && hasFact(facts, m[1], "<= 65535");
    },
  },

  // --- Trivial ---
  {
    name: "tautology_true",
    description: "true is always true",
    match(goal, _facts) {
      return goal.trim() === "true";
    },
  },
  {
    name: "identity_positive",
    description: "x > 0 when we know x > 0",
    match(goal, facts) {
      const m = goal.match(/^(\w+)\s*>\s*0$/);
      if (!m) return false;
      return hasFact(facts, m[1], "> 0");
    },
  },
  {
    name: "identity_non_negative",
    description: "x >= 0 when we know x >= 0",
    match(goal, facts) {
      const m = goal.match(/^(\w+)\s*>=\s*0$/);
      if (!m) return false;
      return hasFact(facts, m[1], ">= 0");
    },
  },
];

/**
 * Try to prove a goal using algebraic rules.
 * Returns extended result with proof step information for certificates.
 */
export function tryAlgebraicProof(
  goal: string,
  facts: TypeFact[],
): AlgebraicProofResult {
  for (const rule of RULES) {
    // Try extended match first for proof certificate support
    if (rule.matchWithFacts) {
      const result = rule.matchWithFacts(goal, facts);
      if (result.matched) {
        return {
          proven: true,
          method: "algebra",
          reason: `${rule.name}: ${rule.description}`,
          step: {
            rule: rule.name,
            description: rule.description,
            justification: `Applied algebraic rule: ${rule.description}`,
            usedFacts: result.usedFacts,
            subgoals: [],
          },
        };
      }
    } else if (rule.match(goal, facts)) {
      // Fall back to simple match
      return {
        proven: true,
        method: "algebra",
        reason: `${rule.name}: ${rule.description}`,
        step: {
          rule: rule.name,
          description: rule.description,
          justification: `Applied algebraic rule: ${rule.description}`,
          usedFacts: [],
          subgoals: [],
        },
      };
    }
  }
  return { proven: false };
}

/**
 * Register a custom algebraic rule.
 */
export function registerAlgebraicRule(rule: AlgebraicRule): void {
  RULES.push(rule);
}

/**
 * Get all registered algebraic rules.
 */
export function getAllAlgebraicRules(): readonly AlgebraicRule[] {
  return RULES;
}
