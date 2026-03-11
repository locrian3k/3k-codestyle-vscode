import * as vscode from "vscode";
import { LpcContext } from "../lpcParser";
import { Config } from "../config";

// Function name prefixes that typically return boolean values
const BOOLEAN_PREFIXES = /^(is_|has_|can_|query_|check_)/;

/**
 * Rule: Functions that only return 0 or 1 should use status type, not int.
 * Hint severity — suggestion only.
 */
export function statusType(
  document: vscode.TextDocument,
  contexts: LpcContext,
  _config: Config
): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];

  for (const func of contexts.functions) {
    // Only flag int functions with boolean-suggestive names
    if (func.returnType !== "int") {
      continue;
    }

    if (!BOOLEAN_PREFIXES.test(func.name)) {
      continue;
    }

    // Skip one-liners for simplicity — check their return value
    if (func.isOneLiner) {
      const lineText = contexts.lines[func.signatureLine].text;
      const returnMatch = lineText.match(/return\s+(\S+?)\s*;/);
      if (returnMatch) {
        const val = returnMatch[1];
        if (val === "0" || val === "1") {
          diagnostics.push(
            new vscode.Diagnostic(
              new vscode.Range(func.signatureLine, 0, func.signatureLine, 3),
              `Consider using "status" instead of "int" for boolean function "${func.name}".`,
              vscode.DiagnosticSeverity.Hint
            )
          );
        }
      }
      continue;
    }

    // For multi-line functions, scan for return statements
    let allReturnsBoolean = true;
    let hasReturn = false;

    for (let lineNum = func.openBraceLine; lineNum <= func.closeBraceLine; lineNum++) {
      const lineCtx = contexts.lines[lineNum];
      if (!lineCtx || lineCtx.isInBlockComment || lineCtx.isInString) {
        continue;
      }

      const trimmed = lineCtx.text.trim();
      const returnMatch = trimmed.match(/^return\s+(.+?)\s*;$/);
      if (returnMatch) {
        hasReturn = true;
        const val = returnMatch[1].trim();
        if (val !== "0" && val !== "1") {
          allReturnsBoolean = false;
          break;
        }
      }
    }

    if (hasReturn && allReturnsBoolean) {
      diagnostics.push(
        new vscode.Diagnostic(
          new vscode.Range(func.signatureLine, 0, func.signatureLine, 3),
          `Consider using "status" instead of "int" for boolean function "${func.name}".`,
          vscode.DiagnosticSeverity.Hint
        )
      );
    }
  }

  return diagnostics;
}
