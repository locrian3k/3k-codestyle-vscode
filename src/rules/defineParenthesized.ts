import * as vscode from "vscode";
import { LpcContext } from "../lpcParser";
import { Config } from "../config";

/**
 * Rule: #define values using concatenation (+) should be parenthesized.
 *
 * The 3K Coding Primer states: "When stacking #define statements,
 * enclose in parentheses." For example:
 *   #define MY_AREAS (MY_PATH+"areas/")
 *
 * This ensures macro expansion doesn't break operator precedence.
 *
 * Skips simple literal defines, numeric defines, and function-like
 * macros (those with parenthesized parameter lists).
 */
export function defineParenthesized(
  document: vscode.TextDocument,
  contexts: LpcContext,
  _config: Config
): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];

  for (const ctx of contexts.lines) {
    if (!ctx.isPreprocessor) { continue; }

    const text = ctx.text;

    // Match: #define NAME value (skip function-like macros with parens
    // immediately after name)
    const match = text.match(
      /^#\s*define\s+([A-Za-z_]\w*)(\([^)]*\))?\s+(.+)$/
    );
    if (!match) { continue; }

    const macroParams = match[2]; // e.g. "(X)" for function-like
    const value = match[3].trim();

    // Skip function-like macros (they have their own precedence rules)
    if (macroParams) { continue; }

    // Only check values that contain + (string concatenation)
    if (!value.includes("+")) { continue; }

    // Skip if value is already wrapped in outer parentheses
    if (value.startsWith("(") && value.endsWith(")")) {
      // Verify the parens are balanced (the opening paren matches
      // the closing one, not just any inner paren)
      let depth = 0;
      let outerWrapped = true;
      for (let i = 0; i < value.length; i++) {
        if (value[i] === "(") { depth++; }
        if (value[i] === ")") { depth--; }
        // If depth hits 0 before the last char, outer parens
        // don't wrap the whole expression
        if (depth === 0 && i < value.length - 1) {
          outerWrapped = false;
          break;
        }
      }
      if (outerWrapped) { continue; }
    }

    // Skip line-continuation defines (backslash at end) — these are
    // complex multi-line macros better left to the developer
    if (value.endsWith("\\")) { continue; }

    const valueStart = text.indexOf(value, text.indexOf(match[1])
      + match[1].length);

    diagnostics.push(
      new vscode.Diagnostic(
        new vscode.Range(ctx.lineNumber, valueStart,
          ctx.lineNumber, valueStart + value.length),
        "#define value with concatenation (+) should be"
          + " wrapped in parentheses.",
        vscode.DiagnosticSeverity.Hint
      )
    );
  }

  return diagnostics;
}
