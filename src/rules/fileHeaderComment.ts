import * as vscode from "vscode";
import { LpcContext } from "../lpcParser";
import { Config } from "../config";

// Rule: Every .c file should start with a comment block.
//
// The 3K Coding Primer template shows files beginning with:
//   /* filename.c
//      Author YYMMDD
//      Description */
//
// This rule checks that the first non-blank line is a comment
// (either // or /*). It does not enforce a specific format.
export function fileHeaderComment(
  document: vscode.TextDocument,
  contexts: LpcContext,
  _config: Config
): vscode.Diagnostic[] {
  // Only check .c files
  if (!document.fileName.endsWith(".c")) {
    return [];
  }

  // Find the first non-blank line
  for (let i = 0; i < document.lineCount; i++) {
    const text = document.lineAt(i).text.trim();
    if (text.length === 0) { continue; }

    // First non-blank line should be a comment
    if (text.startsWith("//") || text.startsWith("/*")) {
      return [];
    }

    // Not a comment — flag it
    return [
      new vscode.Diagnostic(
        new vscode.Range(i, 0, i, text.length),
        "File should start with a comment block"
          + " (filename, author, date, description).",
        vscode.DiagnosticSeverity.Hint
      ),
    ];
  }

  return [];
}
