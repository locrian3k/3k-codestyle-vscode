import * as vscode from "vscode";
import { LpcContext } from "../lpcParser";
import { Config } from "../config";

// Rule: LPC closure references (#'function) leave an unmatched quote
// that confuses most IDEs/syntax highlighters. Adding //' at end of
// line closes the quote for the IDE without affecting LPC compilation.
//
// Bad (IDE sees open quote):
//   sort_array(arr, #'sort_alpha);
//
// Good (IDE happy):
//   sort_array(arr, #'sort_alpha); //'

const CLOSURE_REF = /#'/;

export function closureQuoteFix(
  document: vscode.TextDocument,
  contexts: LpcContext,
  _config: Config
): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];
  const lines = contexts.lines;

  for (let i = 0; i < lines.length; i++) {
    const ctx = lines[i];
    if (ctx.isInBlockComment || ctx.isPreprocessor) continue;

    const text = ctx.text;

    // Check if line contains #' closure reference
    if (!CLOSURE_REF.test(text)) continue;

    // Check if line already has //' or /*'*/ fix
    if (/\/\/'/.test(text) || /\/\*'?\*\//.test(text)) continue;

    diagnostics.push(
      new vscode.Diagnostic(
        new vscode.Range(i, 0, i, text.length),
        "#' closure leaves unmatched quote — add //' at end of "
          + "line to fix IDE syntax highlighting.",
        vscode.DiagnosticSeverity.Hint
      )
    );
  }

  return diagnostics;
}
