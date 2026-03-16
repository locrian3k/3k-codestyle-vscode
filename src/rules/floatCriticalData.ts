import * as vscode from "vscode";
import { LpcContext } from "../lpcParser";
import { Config } from "../config";

/**
 * Rule: Don't use float for critical game data.
 *
 * The 3K Coding Primer states: "Don't use float for precise large
 * values like experience; use integers instead." Floating point
 * precision loss can cause points to be lost during math or
 * conversions.
 *
 * Checks for float variable declarations where the variable name
 * suggests critical data (experience, gold, score, etc.).
 */

const CRITICAL_NAMES =
  /\b(?:exp|experience|guild|score|points|gold|money|coins|currency|xp)\b/i;

export function floatCriticalData(
  document: vscode.TextDocument,
  contexts: LpcContext,
  _config: Config
): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];

  // Check function return types
  for (const func of contexts.functions) {
    if (func.returnType !== "float") { continue; }
    if (!CRITICAL_NAMES.test(func.name)) { continue; }

    const lineText = document.lineAt(func.signatureLine).text;
    const col = lineText.indexOf("float");
    if (col >= 0) {
      diagnostics.push(
        new vscode.Diagnostic(
          new vscode.Range(func.signatureLine, col,
            func.signatureLine, col + 5),
          "Avoid \"float\" for \"" + func.name
            + "()\"; use \"int\" for critical game data"
            + " to prevent precision loss.",
          vscode.DiagnosticSeverity.Hint
        )
      );
    }
  }

  // Check variable declarations
  for (const ctx of contexts.lines) {
    if (ctx.isInBlockComment || ctx.isInString) { continue; }
    if (ctx.isPreprocessor) { continue; }

    const text = ctx.text;
    const trimmed = text.trim();

    // Skip comments
    if (trimmed.startsWith("//") || trimmed.startsWith("/*")) {
      continue;
    }

    // Skip function signatures (already handled)
    if (contexts.functions.some(
      f => f.signatureLine === ctx.lineNumber)) { continue; }

    // Match float variable declarations
    const match = trimmed.match(
      /^(?:private\s+|protected\s+|public\s+|nosave\s+|static\s+)*float\s+(.+);$/
    );
    if (!match) { continue; }

    // Check if any declared variable name matches critical keywords
    const varPart = match[1];
    if (!CRITICAL_NAMES.test(varPart)) { continue; }

    const col = text.indexOf("float");
    if (col >= 0) {
      diagnostics.push(
        new vscode.Diagnostic(
          new vscode.Range(ctx.lineNumber, col,
            ctx.lineNumber, col + 5),
          "Avoid \"float\" for critical game data"
            + " (experience, gold, etc.); use \"int\""
            + " to prevent precision loss.",
          vscode.DiagnosticSeverity.Hint
        )
      );
    }
  }

  return diagnostics;
}
