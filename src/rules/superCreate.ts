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

const LIFECYCLE_FUNCTIONS: { name: string; reason: string }[] = [
  { name: "create", reason: "initialize inherited properties" },
  { name: "init", reason: "register inherited actions and commands" },
  { name: "reset", reason: "run inherited reset behavior" },
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
      diagnostics.push(
        new vscode.Diagnostic(
          new vscode.Range(sigLine, 0, sigLine, document.lineAt(sigLine).text.length),
          lf.name + "() should call ::" + lf.name + "() to " + lf.reason + ".",
          vscode.DiagnosticSeverity.Warning
        )
      );
    }
  }

  return diagnostics;
}
