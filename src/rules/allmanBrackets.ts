import * as vscode from "vscode";
import { LpcContext } from "../lpcParser";
import { Config } from "../config";

// Control structure keywords that require Allman braces
const CONTROL_KEYWORDS = /\b(if|else|for|while|foreach|switch|do)\b/;

// Function signature pattern (type + name + parens)
const FUNC_SIG = /\b(?:static\s+|private\s+|public\s+|protected\s+|nosave\s+|nomask\s+|varargs\s+|virtual\s+)*(?:void|int|string|object|mapping|mixed|float|status|closure|symbol)\s+\*?\s*\w+\s*\(/;

/**
 * Rule: Allman bracket style — opening { must be on its own line.
 *
 * Exceptions:
 * - Single-line functions: int query_foo() { return foo; }
 * - Array literals: ({ ... })
 * - Mapping literals: ([ ... ])
 * - Closures: (: ... :)
 */
export function allmanBrackets(
  document: vscode.TextDocument,
  contexts: LpcContext,
  _config: Config
): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];

  for (const ctx of contexts.lines) {
    // Skip lines in block comments, strings, preprocessor
    if (ctx.isInBlockComment || ctx.isInString || ctx.isPreprocessor) {
      continue;
    }

    const text = ctx.text;
    const openPositions = ctx.blockBraceOpenPositions;

    for (const braceCol of openPositions) {
      // Get the text before the brace
      const before = text.substring(0, braceCol).trimEnd();

      // If brace is the first non-space char on the line, it's already Allman
      if (before.length === 0) {
        continue;
      }

      // Check for single-line function: has both { and } on same line
      // e.g., int query_foo() { return foo; }
      const afterBrace = text.substring(braceCol + 1);
      if (afterBrace.includes("}")) {
        continue; // Single-line block, allowed
      }

      // Check if this is after a control keyword or function signature
      const hasControl = CONTROL_KEYWORDS.test(before);
      const hasFuncSig = FUNC_SIG.test(before);
      // Also catch plain "else {" and ") {" patterns
      const isElse = /\belse\s*$/.test(before);
      const isCloseParen = /\)\s*$/.test(before);

      if (hasControl || hasFuncSig || isElse || isCloseParen) {
        diagnostics.push(
          new vscode.Diagnostic(
            new vscode.Range(ctx.lineNumber, braceCol, ctx.lineNumber, braceCol + 1),
            "Opening brace should be on its own line (Allman style).",
            vscode.DiagnosticSeverity.Error
          )
        );
      }
    }
  }

  return diagnostics;
}
