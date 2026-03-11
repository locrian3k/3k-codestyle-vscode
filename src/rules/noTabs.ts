import * as vscode from "vscode";
import { LpcContext } from "../lpcParser";
import { Config } from "../config";

/**
 * Rule: No tab characters allowed (spaces only).
 * Tabs inside string literals are ignored.
 */
export function noTabs(
  document: vscode.TextDocument,
  contexts: LpcContext,
  _config: Config
): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];

  for (const ctx of contexts.lines) {
    // Skip lines that start inside a string (tab may be in string content)
    if (ctx.isInString) {
      continue;
    }

    const text = ctx.text;
    let inStr = false;
    let inBlockComment = ctx.isInBlockComment;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = i + 1 < text.length ? text[i + 1] : "";

      if (inBlockComment) {
        if (ch === "*" && next === "/") {
          inBlockComment = false;
          i++;
        }
        continue;
      }
      if (inStr) {
        if (ch === "\\") { i++; continue; }
        if (ch === "\"") { inStr = false; }
        continue;
      }
      if (ch === "/" && next === "*") { inBlockComment = true; i++; continue; }
      if (ch === "/" && next === "/") { break; }
      if (ch === "\"") { inStr = true; continue; }

      if (ch === "\t") {
        diagnostics.push(
          new vscode.Diagnostic(
            new vscode.Range(ctx.lineNumber, i, ctx.lineNumber, i + 1),
            "Tab character found. Use spaces (2-space indent).",
            vscode.DiagnosticSeverity.Error
          )
        );
      }
    }
  }

  return diagnostics;
}
