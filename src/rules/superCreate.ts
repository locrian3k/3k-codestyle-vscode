import * as vscode from "vscode";
import { LpcContext } from "../lpcParser";
import { Config } from "../config";

/**
 * Rule: If a .c file defines create(), init(), or reset(), it should call
 * the parent version (::create(), ::init(), ::reset()) inside it.
 *
 * Forgetting these calls is a common bug:
 * - Missing ::create() means inherited properties don't initialize
 * - Missing ::init() means inherited actions/commands don't register
 * - Missing ::reset() means inherited reset behavior is skipped
 *
 * Only applies to .c files (not .h headers).
 */

const LIFECYCLE_FUNCTIONS: {
  name: string;
  reason: string;
  severity: vscode.DiagnosticSeverity;
}[] = [
  { name: "create", reason: "initialize inherited properties",
    severity: vscode.DiagnosticSeverity.Warning },
  { name: "init", reason: "register inherited actions and commands",
    severity: vscode.DiagnosticSeverity.Warning },
  // reset() is a Hint because many parent classes don't define it —
  // the linter can't trace the inheritance chain to verify.
  { name: "reset", reason: "run inherited reset behavior",
    severity: vscode.DiagnosticSeverity.Hint },
];

export function superCreate(
  document: vscode.TextDocument,
  contexts: LpcContext,
  _config: Config
): vscode.Diagnostic[] {
  // Only check .c files
  if (!document.fileName.endsWith(".c")) {
    return [];
  }

  const diagnostics: vscode.Diagnostic[] = [];

  // Extract inherit paths for actionable hint messages
  const inherits: string[] = [];
  for (let i = 0; i < document.lineCount; i++) {
    const match = document.lineAt(i).text.trim().match(/^inherit\s+(.+?)\s*;$/);
    if (match) {
      inherits.push(match[1].trim());
    }
  }

  for (const lf of LIFECYCLE_FUNCTIONS) {
    const func = contexts.functions.find(f => f.name === lf.name);
    if (!func) { continue; }

    const startLine = func.openBraceLine;
    const endLine = func.closeBraceLine;
    const pattern = new RegExp("::" + lf.name + "\\s*\\(");

    let found = false;
    for (let i = startLine; i <= endLine; i++) {
      if (pattern.test(document.lineAt(i).text)) {
        found = true;
        break;
      }
    }

    if (!found) {
      const sigLine = func.signatureLine;
      let message = lf.name + "() should call ::" + lf.name
        + "() to " + lf.reason + ".";

      // For hints, tell the user which parent to check
      if (lf.severity === vscode.DiagnosticSeverity.Hint
        && inherits.length > 0)
      {
        message = lf.name + "() should call ::" + lf.name
          + "() if " + inherits.join(", ") + " defines "
          + lf.name + "().";
      }

      diagnostics.push(
        new vscode.Diagnostic(
          new vscode.Range(sigLine, 0, sigLine, document.lineAt(sigLine).text.length),
          message,
          lf.severity
        )
      );
    }
  }

  return diagnostics;
}
