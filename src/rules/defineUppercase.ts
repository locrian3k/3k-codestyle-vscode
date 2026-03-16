import * as vscode from "vscode";
import { LpcContext } from "../lpcParser";
import { Config } from "../config";

/**
 * Rule: #define macro names must be UPPERCASE.
 *
 * The 3K Coding Primer states: "Use UPPERCASE for #define macros to
 * distinguish from variables." Lowercase or mixed-case macro names
 * can be confused with regular variables and violate convention.
 *
 * Skips function-like macros that are already uppercase, include
 * guards, and lines without a proper name token.
 */
export function defineUppercase(
  document: vscode.TextDocument,
  contexts: LpcContext,
  _config: Config
): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];

  for (const ctx of contexts.lines) {
    if (!ctx.isPreprocessor) { continue; }

    const text = ctx.text;
    const match = text.match(/^#\s*define\s+([A-Za-z_]\w*)/);
    if (!match) { continue; }

    const macroName = match[1];

    // Check if name has any lowercase letters
    if (!/[a-z]/.test(macroName)) { continue; }

    // Find the column where the macro name starts
    const nameStart = text.indexOf(macroName, text.indexOf("define") + 6);
    const nameEnd = nameStart + macroName.length;

    diagnostics.push(
      new vscode.Diagnostic(
        new vscode.Range(ctx.lineNumber, nameStart,
          ctx.lineNumber, nameEnd),
        "#define name \"" + macroName
          + "\" should be UPPERCASE.",
        vscode.DiagnosticSeverity.Warning
      )
    );
  }

  return diagnostics;
}
