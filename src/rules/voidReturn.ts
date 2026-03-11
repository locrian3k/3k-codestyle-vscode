import * as vscode from "vscode";
import { LpcContext } from "../lpcParser";
import { Config } from "../config";

/**
 * Rule: Void functions must end with explicit return;
 * Also flags return 0; or return 1; inside void functions.
 */
export function voidReturn(
  document: vscode.TextDocument,
  contexts: LpcContext,
  _config: Config
): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];

  for (const func of contexts.functions) {
    if (func.returnType !== "void") {
      continue;
    }

    // Skip one-liners — they're handled inline
    if (func.isOneLiner) {
      continue;
    }

    // Check for return 0; or return 1; inside the function body
    for (let lineNum = func.openBraceLine; lineNum <= func.closeBraceLine; lineNum++) {
      const lineCtx = contexts.lines[lineNum];
      if (!lineCtx || lineCtx.isInBlockComment || lineCtx.isInString) {
        continue;
      }

      const trimmed = lineCtx.text.trim();
      if (/^return\s+(0|1)\s*;/.test(trimmed)) {
        diagnostics.push(
          new vscode.Diagnostic(
            new vscode.Range(lineNum, 0, lineNum, lineCtx.text.length),
            `return ${trimmed.includes("0") ? "0" : "1"}; in void function "${func.name}". Use plain return; instead.`,
            vscode.DiagnosticSeverity.Error
          )
        );
      }
    }

    // Check that the last statement before closing } is return;
    let lastStatementLine = -1;
    for (let lineNum = func.closeBraceLine - 1; lineNum > func.openBraceLine; lineNum--) {
      const lineCtx = contexts.lines[lineNum];
      if (!lineCtx) {
        continue;
      }
      const trimmed = lineCtx.text.trim();
      // Skip blank lines, comment-only lines, and closing braces of inner blocks
      if (trimmed.length === 0 || trimmed.startsWith("//") || trimmed.startsWith("/*")
          || trimmed === "*/" || trimmed === "}") {
        continue;
      }
      lastStatementLine = lineNum;
      break;
    }

    if (lastStatementLine >= 0) {
      const lastTrimmed = contexts.lines[lastStatementLine].text.trim();
      if (lastTrimmed !== "return;") {
        diagnostics.push(
          new vscode.Diagnostic(
            new vscode.Range(
              func.closeBraceLine, func.closeBraceCol,
              func.closeBraceLine, func.closeBraceCol + 1
            ),
            `Void function "${func.name}" must end with return;`,
            vscode.DiagnosticSeverity.Warning
          )
        );
      }
    }
  }

  return diagnostics;
}
