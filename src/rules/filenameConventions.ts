import * as vscode from "vscode";
import { LpcContext } from "../lpcParser";
import { Config } from "../config";

/**
 * Rule: Filenames should not contain spaces or capital letters.
 *
 * The 3K Coding Primer states:
 * - "Avoid capital letters and symbols in folder/file names."
 * - "Do not upload files with spaces in filenames."
 *
 * Only checks the basename (not the full path, since the user may
 * not control parent directory names).
 */
export function filenameConventions(
  document: vscode.TextDocument,
  _contexts: LpcContext,
  _config: Config
): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];

  // Extract just the filename (basename)
  const fullPath = document.fileName;
  const sep = fullPath.includes("\\") ? "\\" : "/";
  const basename = fullPath.split(sep).pop() || "";

  if (/\s/.test(basename)) {
    diagnostics.push(
      new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 0),
        "Filename \"" + basename
          + "\" contains spaces. Use underscores instead.",
        vscode.DiagnosticSeverity.Warning
      )
    );
  }

  if (/[A-Z]/.test(basename)) {
    diagnostics.push(
      new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 0),
        "Filename \"" + basename
          + "\" contains uppercase letters. Use lowercase.",
        vscode.DiagnosticSeverity.Warning
      )
    );
  }

  return diagnostics;
}
