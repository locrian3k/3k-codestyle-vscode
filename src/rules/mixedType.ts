import * as vscode from "vscode";
import { LpcContext } from "../lpcParser";
import { Config } from "../config";

/**
 * Rule: Avoid using the "mixed" type unless truly necessary.
 *
 * The 3K Coding Primer states: "Avoid mixed types unless truly
 * necessary." Using mixed defeats the purpose of #pragma strong_types
 * and can hide bugs.
 *
 * Checks function return types and global/local variable declarations.
 */
export function mixedType(
  document: vscode.TextDocument,
  contexts: LpcContext,
  _config: Config
): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];

  // Check function return types
  for (const func of contexts.functions) {
    if (func.returnType === "mixed") {
      const lineText = document.lineAt(func.signatureLine).text;
      const col = lineText.indexOf("mixed");
      if (col >= 0) {
        diagnostics.push(
          new vscode.Diagnostic(
            new vscode.Range(func.signatureLine, col,
              func.signatureLine, col + 5),
            "Avoid \"mixed\" return type on \""
              + func.name + "()\" unless truly necessary.",
            vscode.DiagnosticSeverity.Hint
          )
        );
      }
    }
  }

  // Check variable declarations for "mixed" type
  for (const ctx of contexts.lines) {
    if (ctx.isInBlockComment || ctx.isInString) { continue; }
    if (ctx.isPreprocessor) { continue; }

    const text = ctx.text;
    const trimmed = text.trim();

    // Skip comments
    if (trimmed.startsWith("//") || trimmed.startsWith("/*")) {
      continue;
    }

    // Look for "mixed" as a type in variable declarations
    // Match patterns like: mixed var; mixed *arr; mixed var, var2;
    const match = trimmed.match(
      /^(?:private\s+|protected\s+|public\s+|nosave\s+|static\s+)*mixed\s+\*?\s*[a-zA-Z_]\w*/
    );
    if (!match) { continue; }

    // Skip function signatures (already handled above)
    if (contexts.functions.some(
      f => f.signatureLine === ctx.lineNumber)) { continue; }

    const col = text.indexOf("mixed");
    if (col >= 0) {
      diagnostics.push(
        new vscode.Diagnostic(
          new vscode.Range(ctx.lineNumber, col,
            ctx.lineNumber, col + 5),
          "Avoid \"mixed\" type unless truly necessary.",
          vscode.DiagnosticSeverity.Hint
        )
      );
    }
  }

  return diagnostics;
}
