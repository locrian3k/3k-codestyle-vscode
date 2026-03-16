import * as vscode from "vscode";
import { LpcContext } from "../lpcParser";
import { Config } from "../config";

/**
 * Rule: Prefer sprintf()/printf() over string concatenation with +.
 *
 * The 3K Coding Primer states: "Use sprintf()/printf() instead of
 * concatenation with +." String concatenation in output functions is
 * less efficient and harder to read than formatted strings.
 *
 * Only flags simple, direct cases like:
 *   write("Hello " + name + "!\n");
 *
 * Skips:
 *   - Lines inside create()/reset() (compile-time context)
 *   - Lines with wrapper functions (to_ansi, word_wrap, WWRAP, etc.)
 *   - ANSI color concatenation ("@color:" + var + "@")
 *   - Lines where the + is nested inside other function calls
 */

const OUTPUT_FUNCS =
  /\b(?:write|tell_object|tell_room|ansi_write|ansi_tell_object|ansi_tell_room)\s*\(/;

// Wrapper functions where sprintf wouldn't simplify anything
const WRAPPER_FUNCS =
  /\b(?:to_ansi|word_wrap|WWRAP|WRAPP|PWRAP|SWRAPP|WRAP|sprintf)\s*\(/;

// ANSI color concatenation: "@color:" + var or var + "@\n"
const ANSI_CONCAT = /@\w*:?\s*"\s*\+|"\s*\+\s*"@|\+\s*"@/;

export function sprintfPreference(
  document: vscode.TextDocument,
  contexts: LpcContext,
  _config: Config
): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];

  // Build set of line ranges inside create()/reset() to skip
  const skipRanges: { start: number; end: number }[] = [];
  for (const func of contexts.functions) {
    if (func.name === "create" || func.name === "reset") {
      skipRanges.push({
        start: func.openBraceLine,
        end: func.closeBraceLine,
      });
    }
  }

  for (const ctx of contexts.lines) {
    if (ctx.isInBlockComment || ctx.isInString) { continue; }
    if (ctx.isPreprocessor) { continue; }

    // Skip lines inside create()/reset()
    const inSkip = skipRanges.some(
      r => ctx.lineNumber >= r.start && ctx.lineNumber <= r.end
    );
    if (inSkip) { continue; }

    const text = ctx.text;
    const trimmed = text.trim();

    // Skip comment lines
    if (trimmed.startsWith("//") || trimmed.startsWith("/*")) {
      continue;
    }

    // Must have an output function call on this line
    if (!OUTPUT_FUNCS.test(trimmed)) { continue; }

    // Skip lines with wrapper functions — the + is nested deep
    // and sprintf wouldn't simplify the expression
    if (WRAPPER_FUNCS.test(trimmed)) { continue; }

    // Skip ANSI color concatenation patterns
    if (ANSI_CONCAT.test(trimmed)) { continue; }

    // Look for simple string concatenation: "text" + var or var + "text"
    if (/"\s*\+\s*[^"()]/.test(trimmed)
      || /[^"(]\s*\+\s*"/.test(trimmed))
    {
      const funcMatch = trimmed.match(OUTPUT_FUNCS);
      const funcName = funcMatch
        ? trimmed.substring(0, trimmed.indexOf("(")).trim()
        : "output function";
      const col = text.indexOf(trimmed[0]);

      diagnostics.push(
        new vscode.Diagnostic(
          new vscode.Range(ctx.lineNumber, col,
            ctx.lineNumber, text.length),
          "Consider using sprintf() instead of string"
            + " concatenation (+) in " + funcName + "().",
          vscode.DiagnosticSeverity.Hint
        )
      );
    }
  }

  return diagnostics;
}
