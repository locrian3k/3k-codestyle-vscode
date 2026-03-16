import * as vscode from "vscode";
import { LpcContext } from "../lpcParser";
import { Config } from "../config";

// Rule: Braceless if/else with UPPERCASE macro calls need braces.
//
// Macros like REPORT() expand to if(...) statements. When used as
// a single statement inside an if/else without braces, the else
// binds to the macro's inner if — not the outer if. This is the
// classic "dangling else" problem.
//
// Bad:
//   if (condition)
//     REPORT("found it");
//   else
//     REPORT("not found");
//
// The else binds to REPORT's inner if(find_player("mimic")),
// not to the outer if(condition).
//
// Good:
//   if (condition)
//   { REPORT("found it"); }
//   else
//   { REPORT("not found"); }

// Matches an UPPERCASE identifier followed by ( at start of trimmed line.
// Requires at least 2 uppercase letters to avoid matching single-char vars.
const MACRO_CALL = /^[A-Z][A-Z_0-9]+\s*\(/;

export function bracesAroundMacro(
  document: vscode.TextDocument,
  contexts: LpcContext,
  _config: Config
): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];
  const lines = contexts.lines;

  for (let i = 0; i < lines.length; i++)
  {
    const ctx = lines[i];
    if (ctx.isInBlockComment || ctx.isInString || ctx.isPreprocessor)
      continue;

    const trimmed = ctx.text.trim();

    // Look for if (...) or else on a line by itself (Allman style)
    const isIf = /^\s*if\s*\(/.test(ctx.text);
    const isElseIf = /^\s*else\s+if\s*\(/.test(ctx.text);
    const isElse = /^\s*else\s*$/.test(ctx.text) || trimmed === "else";

    if (!isIf && !isElse)
      continue;

    // Skip else if — those are more complex
    if (isElseIf)
      continue;

    // Check if the next non-blank line is a brace (already braced — skip)
    let bodyLine = -1;
    for (let j = i + 1; j < lines.length; j++)
    {
      const jTrimmed = lines[j].text.trim();
      if (jTrimmed.length === 0)
        continue;

      // If next non-blank line is { then it's already braced
      if (jTrimmed === "{" || jTrimmed.startsWith("{"))
      {
        bodyLine = -1;
        break;
      }

      bodyLine = j;
      break;
    }

    if (bodyLine < 0)
      continue;

    // Check if the body line starts with an UPPERCASE macro call
    const bodyTrimmed = lines[bodyLine].text.trim();
    if (MACRO_CALL.test(bodyTrimmed))
    {
      const macroName = bodyTrimmed.match(/^([A-Z][A-Z_0-9]+)/)?.[1] || "MACRO";
      const keyword = isElse ? "else" : "if";
      diagnostics.push(
        new vscode.Diagnostic(
          new vscode.Range(
            bodyLine, 0, bodyLine,
            lines[bodyLine].text.length
          ),
          macroName + "() is a macro — wrap in braces inside "
            + keyword + "/else to avoid dangling else bugs.",
          vscode.DiagnosticSeverity.Warning
        )
      );
    }
  }

  return diagnostics;
}
