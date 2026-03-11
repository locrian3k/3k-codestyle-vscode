import * as vscode from "vscode";
import { LpcContext } from "../lpcParser";
import { Config } from "../config";

/**
 * Rule: Lines should be under the configured max length (default 80).
 * Severity: Warning (not error — this is a guideline).
 */
export function lineLength(
  document: vscode.TextDocument,
  contexts: LpcContext,
  config: Config
): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];
  const maxLen = config.lint.lineLengthMax;

  for (const ctx of contexts.lines) {
    const len = ctx.text.length;
    if (len > maxLen) {
      diagnostics.push(
        new vscode.Diagnostic(
          new vscode.Range(ctx.lineNumber, maxLen, ctx.lineNumber, len),
          `Line is ${len} characters (max ${maxLen}).`,
          vscode.DiagnosticSeverity.Warning
        )
      );
    }
  }

  return diagnostics;
}
