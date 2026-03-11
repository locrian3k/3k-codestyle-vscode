import * as vscode from "vscode";
import { LpcContext } from "../lpcParser";
import { Config } from "../config";

/**
 * Rule: #pragma strong_types must be the first non-comment line of every .c file.
 * File header comments (line or block) are allowed before it.
 */
export function pragmaStrongTypes(
  document: vscode.TextDocument,
  _contexts: LpcContext,
  _config: Config
): vscode.Diagnostic[] {
  // Only check .c files, not .h
  if (!document.fileName.endsWith(".c")) {
    return [];
  }

  if (document.lineCount === 0) {
    return [
      new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 0),
        "Missing #pragma strong_types (first non-comment line).",
        vscode.DiagnosticSeverity.Error
      ),
    ];
  }

  // Walk lines, skipping blank lines and comments, to find the first code line
  let inBlockComment = false;

  for (let i = 0; i < document.lineCount; i++) {
    const text = document.lineAt(i).text;
    const trimmed = text.trim();

    // Handle block comment state
    if (inBlockComment) {
      if (trimmed.includes("*/")) {
        inBlockComment = false;
      }
      continue;
    }

    // Skip blank lines
    if (trimmed.length === 0) {
      continue;
    }

    // Skip line comments
    if (trimmed.startsWith("//")) {
      continue;
    }

    // Start of block comment
    if (trimmed.startsWith("/*")) {
      // Check if it closes on the same line
      if (!trimmed.includes("*/") || trimmed.endsWith("/*")) {
        inBlockComment = true;
      }
      continue;
    }

    // This is the first non-comment, non-blank line — it must be #pragma
    if (trimmed === "#pragma strong_types") {
      return [];
    }

    // First real line is NOT #pragma strong_types
    return [
      new vscode.Diagnostic(
        new vscode.Range(i, 0, i, text.length),
        "#pragma strong_types must be the first non-comment line.",
        vscode.DiagnosticSeverity.Error
      ),
    ];
  }

  // Reached end of file without finding it
  return [
    new vscode.Diagnostic(
      new vscode.Range(0, 0, 0, 0),
      "Missing #pragma strong_types (first non-comment line).",
      vscode.DiagnosticSeverity.Error
    ),
  ];
}
