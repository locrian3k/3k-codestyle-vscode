import * as vscode from "vscode";
import { LpcContext } from "../lpcParser";
import { Config } from "../config";

/**
 * Rule: Single-statement if/else should NOT use brackets.
 * Hint severity — style suggestion only.
 *
 * Detects patterns like:
 *   if (condition)
 *   {
 *     single_statement;
 *   }
 *
 * Where the block contains exactly one statement.
 */
export function singleStatementBrackets(
  document: vscode.TextDocument,
  contexts: LpcContext,
  _config: Config
): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];
  const lines = contexts.lines;

  for (let i = 0; i < lines.length; i++) {
    const ctx = lines[i];
    if (ctx.isInBlockComment || ctx.isInString || ctx.isPreprocessor) {
      continue;
    }

    const trimmed = ctx.text.trim();

    // Look for if (...) or else on a line by itself (Allman style)
    const isIf = /^\s*if\s*\(/.test(ctx.text);
    const isElseIf = /^\s*else\s+if\s*\(/.test(ctx.text);
    const isElse = /^\s*else\s*$/.test(ctx.text) || trimmed === "else";

    if (!isIf && !isElse) {
      continue;
    }

    // Skip else if — those are more complex
    if (isElseIf) {
      continue;
    }

    // Find the opening brace — could be on this line (K&R, caught by allman rule)
    // or the next line (Allman style, which is what we check here)
    let braceLine = -1;

    // Check if brace is on this line
    if (ctx.blockBraceOpenPositions.length > 0) {
      braceLine = i;
    }
    // Check next line for standalone brace
    else if (i + 1 < lines.length) {
      const nextCtx = lines[i + 1];
      if (nextCtx.text.trim() === "{") {
        braceLine = i + 1;
      }
    }

    if (braceLine < 0) {
      continue; // no brace found — already bracketless, good
    }

    // Find the matching closing brace
    let closeLine = -1;
    let depth = 0;
    for (let j = braceLine; j < lines.length; j++) {
      const jCtx = lines[j];
      for (const _pos of jCtx.blockBraceOpenPositions) {
        depth++;
      }
      for (const _pos of jCtx.blockBraceClosePositions) {
        depth--;
        if (depth === 0) {
          closeLine = j;
          break;
        }
      }
      if (closeLine >= 0) {
        break;
      }
    }

    if (closeLine < 0) {
      continue;
    }

    // Count non-empty, non-brace statement lines between open and close
    let statementCount = 0;
    for (let j = braceLine + 1; j < closeLine; j++) {
      const jTrimmed = lines[j].text.trim();
      if (jTrimmed.length === 0) {
        continue;
      }
      if (jTrimmed === "{" || jTrimmed === "}") {
        // Nested braces mean it's not a single statement
        statementCount = 99;
        break;
      }
      if (jTrimmed.startsWith("//") || jTrimmed.startsWith("/*")) {
        continue; // skip comments
      }
      statementCount++;
    }

    if (statementCount === 1) {
      // Don't suggest removing braces when the single statement is an
      // UPPERCASE macro call — macros can expand to if() statements,
      // causing dangling else bugs when used without braces.
      let isMacroCall = false;
      for (let j = braceLine + 1; j < closeLine; j++) {
        const jTrimmed = lines[j].text.trim();
        if (jTrimmed.length === 0 || jTrimmed.startsWith("//")
          || jTrimmed.startsWith("/*"))
        {
          continue;
        }
        if (/^[A-Z][A-Z_0-9]+\s*\(/.test(jTrimmed)) {
          isMacroCall = true;
        }
        break;
      }
      if (isMacroCall) {
        continue;
      }

      const keyword = isElse ? "else" : "if";
      diagnostics.push(
        new vscode.Diagnostic(
          new vscode.Range(braceLine, 0, closeLine, lines[closeLine].text.length),
          `Single-statement ${keyword} does not need brackets.`,
          vscode.DiagnosticSeverity.Hint
        )
      );
    }
  }

  return diagnostics;
}
