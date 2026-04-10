import * as vscode from "vscode";
import { LpcContext } from "../lpcParser";
import { Config } from "../config";

/**
 * Rule: Every .c file must have an #include that ends with defs.h
 * (e.g., "defs.h", "../defs.h", "../../defs.h").
 *
 * Skips .h files entirely — headers are partials meant to be included
 * by .c files that already have the defs chain pulled in, so requiring
 * them to re-include defs.h is redundant.
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
      // Match #include "...defs.h" or #include <...defs.h>
      if (/^#\s*include\s+["<].*defs\.h[">]/.test(trimmed)) {
        return []; // found it
      }
    }
  }

  // Not found — emit warning at top of file
  return [
    new vscode.Diagnostic(
      new vscode.Range(0, 0, 0, 0),
      'Missing #include "defs.h" (or variant like "../defs.h").',
      vscode.DiagnosticSeverity.Warning
    ),
  ];
}
