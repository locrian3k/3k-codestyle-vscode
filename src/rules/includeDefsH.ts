import * as vscode from "vscode";
import { LpcContext } from "../lpcParser";
import { Config } from "../config";

/**
 * Rule: Every .c file must have at least one local #include "..." that
 * pulls in the linked header chain — typically defs.h or an intermediate
 * header like power_inc.h that itself includes defs.h.
 *
 * Skips .h files entirely — headers are partials meant to be included
 * by .c files that already have the defs chain pulled in.
 *
 * Accepts any quoted include ("...") as part of the chain. System
 * includes (<...>) don't count because they're not project headers.
 */
export function includeDefsH(
  document: vscode.TextDocument,
  contexts: LpcContext,
  _config: Config
): vscode.Diagnostic[] {
  // Skip all .h files — they're inheritable partials, not standalone files
  if (document.fileName.endsWith(".h")) {
    return [];
  }

  for (const ctx of contexts.lines) {
    if (ctx.isPreprocessor) {
      const trimmed = ctx.text.trim();
      // Match any local #include "..." — part of the linked header chain
      if (/^#\s*include\s+"[^"]+"/.test(trimmed)) {
        return []; // found it
      }
    }
  }

  // No local include found — emit warning at top of file
  return [
    new vscode.Diagnostic(
      new vscode.Range(0, 0, 0, 0),
      'Missing #include "defs.h" or an intermediate header '
      + 'that pulls in the linked header chain.',
      vscode.DiagnosticSeverity.Warning
    ),
  ];
}
