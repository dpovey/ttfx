/**
 * Scanner wrapper for ttfx preprocessor
 *
 * Wraps TypeScript's scanner and adds multi-character token merging for custom
 * operators like |>, ::, <|. Uses source-position adjacency (t2.start === t1.end)
 * to detect merged tokens.
 */

import * as ts from "typescript";

export interface Token {
  kind: ts.SyntaxKind;
  text: string;
  start: number;
  end: number;
  isCustomOperator?: boolean;
}

export interface CustomOperatorDef {
  symbol: string;
  chars: string[];
}

const DEFAULT_CUSTOM_OPERATORS: CustomOperatorDef[] = [
  { symbol: "|>", chars: ["|", ">"] },
  { symbol: "::", chars: [":", ":"] },
];

export interface ScannerOptions {
  customOperators?: CustomOperatorDef[];
  /**
   * File name used to determine JSX vs Standard language variant.
   * Files ending in .tsx or .jsx use JSX mode.
   */
  fileName?: string;
}

/**
 * Determine the language variant based on file extension.
 */
function getLanguageVariant(fileName?: string): ts.LanguageVariant {
  if (fileName) {
    const lowerName = fileName.toLowerCase();
    if (lowerName.endsWith(".tsx") || lowerName.endsWith(".jsx")) {
      return ts.LanguageVariant.JSX;
    }
  }
  return ts.LanguageVariant.Standard;
}

/**
 * Tokenize source code using TypeScript's scanner, then merge adjacent tokens
 * that form custom operators.
 */
export function tokenize(
  source: string,
  options: ScannerOptions = {},
): Token[] {
  const customOperators = options.customOperators ?? DEFAULT_CUSTOM_OPERATORS;
  const languageVariant = getLanguageVariant(options.fileName);

  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    languageVariant,
    source,
  );

  const rawTokens: Token[] = [];

  while (scanner.scan() !== ts.SyntaxKind.EndOfFileToken) {
    const kind = scanner.getToken();
    const start = scanner.getTokenStart();
    const text = scanner.getTokenText();
    const end = start + text.length;

    if (
      kind !== ts.SyntaxKind.WhitespaceTrivia &&
      kind !== ts.SyntaxKind.NewLineTrivia
    ) {
      rawTokens.push({ kind, text, start, end });
    }
  }

  return mergeCustomOperators(rawTokens, customOperators);
}

/**
 * Merge adjacent tokens that form custom operators.
 * Uses source-position adjacency: t2.start === t1.end
 */
function mergeCustomOperators(
  tokens: Token[],
  customOperators: CustomOperatorDef[],
): Token[] {
  const result: Token[] = [];
  let i = 0;

  while (i < tokens.length) {
    let merged = false;

    for (const op of customOperators) {
      if (i + op.chars.length > tokens.length) continue;

      let matches = true;
      for (let j = 0; j < op.chars.length; j++) {
        const token = tokens[i + j];
        if (token.text !== op.chars[j]) {
          matches = false;
          break;
        }
        if (j > 0) {
          const prevToken = tokens[i + j - 1];
          if (token.start !== prevToken.end) {
            matches = false;
            break;
          }
        }
      }

      if (matches) {
        const firstToken = tokens[i];
        const lastToken = tokens[i + op.chars.length - 1];
        result.push({
          kind: ts.SyntaxKind.Unknown,
          text: op.symbol,
          start: firstToken.start,
          end: lastToken.end,
          isCustomOperator: true,
        });
        i += op.chars.length;
        merged = true;
        break;
      }
    }

    if (!merged) {
      result.push(tokens[i]);
      i++;
    }
  }

  return result;
}

/**
 * Tokens that delimit expression boundaries for custom operator parsing.
 * This includes statement terminators, assignment operators, and declaration keywords.
 * Note: Open brackets are handled separately by bracket-depth tracking logic.
 */
const BOUNDARY_KINDS = new Set([
  ts.SyntaxKind.SemicolonToken,
  ts.SyntaxKind.CommaToken,
  ts.SyntaxKind.EqualsToken,
  ts.SyntaxKind.PlusEqualsToken,
  ts.SyntaxKind.MinusEqualsToken,
  ts.SyntaxKind.AsteriskEqualsToken,
  ts.SyntaxKind.SlashEqualsToken,
  ts.SyntaxKind.PercentEqualsToken,
  ts.SyntaxKind.AsteriskAsteriskEqualsToken,
  ts.SyntaxKind.AmpersandEqualsToken,
  ts.SyntaxKind.BarEqualsToken,
  ts.SyntaxKind.CaretEqualsToken,
  ts.SyntaxKind.LessThanLessThanEqualsToken,
  ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
  ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
  ts.SyntaxKind.EqualsGreaterThanToken,
  ts.SyntaxKind.ReturnKeyword,
  ts.SyntaxKind.ThrowKeyword,
  ts.SyntaxKind.YieldKeyword,
  ts.SyntaxKind.CaseKeyword,
  ts.SyntaxKind.DefaultKeyword,
  ts.SyntaxKind.ConstKeyword,
  ts.SyntaxKind.LetKeyword,
  ts.SyntaxKind.VarKeyword,
]);

/**
 * Check if a token is a boundary token (expression delimiter).
 * Boundaries stop operand extraction for custom operators.
 */
export function isBoundaryToken(token: Token): boolean {
  if (BOUNDARY_KINDS.has(token.kind)) {
    return true;
  }

  if (token.kind === ts.SyntaxKind.ColonToken && !token.isCustomOperator) {
    return true;
  }

  return false;
}

/**
 * Check if a token is an opening bracket/brace/paren
 */
export function isOpenBracket(token: Token): boolean {
  return (
    token.kind === ts.SyntaxKind.OpenBraceToken ||
    token.kind === ts.SyntaxKind.OpenParenToken ||
    token.kind === ts.SyntaxKind.OpenBracketToken ||
    token.kind === ts.SyntaxKind.LessThanToken
  );
}

/**
 * Check if a token is a closing bracket/brace/paren
 */
export function isCloseBracket(token: Token): boolean {
  return (
    token.kind === ts.SyntaxKind.CloseBraceToken ||
    token.kind === ts.SyntaxKind.CloseParenToken ||
    token.kind === ts.SyntaxKind.CloseBracketToken ||
    token.kind === ts.SyntaxKind.GreaterThanToken
  );
}

/**
 * Get the matching close bracket for an open bracket
 */
export function getMatchingClose(
  openKind: ts.SyntaxKind,
): ts.SyntaxKind | null {
  switch (openKind) {
    case ts.SyntaxKind.OpenBraceToken:
      return ts.SyntaxKind.CloseBraceToken;
    case ts.SyntaxKind.OpenParenToken:
      return ts.SyntaxKind.CloseParenToken;
    case ts.SyntaxKind.OpenBracketToken:
      return ts.SyntaxKind.CloseBracketToken;
    case ts.SyntaxKind.LessThanToken:
      return ts.SyntaxKind.GreaterThanToken;
    default:
      return null;
  }
}
