import * as vscode from "vscode";
import { LpcContext } from "../lpcParser";
import { Config } from "../config";

/**
 * Rule: Indentation must be 2-space multiples.
 * Flags lines where leading whitespace is not a multiple of 2 spaces.
 * Skips blank lines, preprocessor lines, and lines inside block comments.
 */
export function indentation(
  document: vscode.TextDocument,
  contexts: LpcContext,
  _config: Config
): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];

  for (const ctx of contexts.lines) {
    // Skip lines that are inside block comments or strings
    if (ctx.isInBlockComment || ctx.isInString) {
      continue;
    }

    // Skip preprocessor directives (they go at column 0)
    if (ctx.isPreprocessor) {
      continue;
    }

    const text = ctx.text;

    // Skip blank lines
    if (text.trim().length === 0) {
      continue;
    }

    // Count leading spaces
    const leadingMatch = text.match(/^( *)\S/);
    if (!leadingMatch) {
      continue; // line is all whitespace, already caught by blank check
    }

    const spaceCount = leadingMatch[1].length;

    // Skip lines with 0 indentation (they're fine)
    if (spaceCount === 0) {
      continue;
    }

    // Check for odd indentation
    if (spaceCount % 2 !== 0) {
      diagnostics.push(
        new vscode.Diagnostic(
          new vscode.Range(ctx.lineNumber, 0, ctx.lineNumber, spaceCount),
          `Indentation is ${spaceCount} spaces. Use 2-space multiples.`,
          vscode.DiagnosticSeverity.Warning
        )
      );
    }
  }

  return diagnostics;
}
