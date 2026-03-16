import * as vscode from "vscode";
import { LpcContext } from "../lpcParser";
import { Config } from "../config";

/**
 * Rule: The "static" modifier is deprecated in the new driver.
 *
 * The 3K Coding Primer states: "static is not recommended in the
 * new-driver." Use "protected" for functions and "nosave" for
 * variables instead.
 */
export function staticDeprecated(
  document: vscode.TextDocument,
  contexts: LpcContext,
  _config: Config
): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];

  // Check function signatures
  for (const func of contexts.functions) {
    const lineText = document.lineAt(func.signatureLine).text;
    const match = lineText.match(/\bstatic\b/);
    if (!match) { continue; }

    const col = lineText.indexOf("static");
    diagnostics.push(
      new vscode.Diagnostic(
        new vscode.Range(func.signatureLine, col,
          func.signatureLine, col + 6),
        "\"static\" is deprecated on functions; use"
          + " \"protected\" instead.",
        vscode.DiagnosticSeverity.Hint
      )
    );
  }

  // Check variable declarations (lines at brace depth 0 that aren't
  // function signatures, preprocessor, comments, or inherit lines)
  for (const ctx of contexts.lines) {
    if (ctx.braceDepth !== 0) { continue; }
    if (ctx.isPreprocessor) { continue; }
    if (ctx.isInBlockComment) { continue; }
    if (ctx.isInString) { continue; }

    const text = ctx.text.trim();
    if (!text.startsWith("static ")) { continue; }

    // Skip if this is a function signature (already handled above)
    const isFunc = contexts.functions.some(
      f => f.signatureLine === ctx.lineNumber
    );
    if (isFunc) { continue; }

    // Skip inherit, preprocessor, or comment lines
    if (text.startsWith("//") || text.startsWith("/*")) { continue; }
    if (text.startsWith("inherit ")) { continue; }

    // Must look like a variable declaration (has a semicolon)
    if (!text.includes(";")) { continue; }

    const col = ctx.text.indexOf("static");
    diagnostics.push(
      new vscode.Diagnostic(
        new vscode.Range(ctx.lineNumber, col,
          ctx.lineNumber, col + 6),
        "\"static\" is deprecated on variables; use"
          + " \"nosave\" instead.",
        vscode.DiagnosticSeverity.Hint
      )
    );
  }

  return diagnostics;
}
