import * as vscode from "vscode";
import { LpcContext } from "../lpcParser";
import { Config } from "../config";

/**
 * Rule: If a .c file defines create() or init(), it should call
 * the parent version (::create(), ::init()) inside it.
 *
 * Forgetting these calls is a common bug:
 * - Missing ::create() means inherited properties don't initialize
 * - Missing ::init() means inherited actions/commands don't register
 *
 * reset() is intentionally NOT checked — on 3K, the base inherited
 * classes (/obj/monster, /room/dungeon/dr.c, etc.) don't define reset(),
 * so ::reset() is a no-op. Flagging it would be noise.
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
      const message = lf.name + "() should call ::" + lf.name
        + "() to " + lf.reason + ".";
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
