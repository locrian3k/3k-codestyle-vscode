import * as vscode from "vscode";
import { LpcContext, LpcFunction } from "../lpcParser";
import { Config } from "../config";

/**
 * Rule: Warn when a locally-defined function is called before it is
 * defined and no forward prototype declaration exists.
 *
 * In LPC, calling a function before its definition without a prototype
 * can cause issues. This rule checks each function body for calls to
 * other functions defined later in the file, and verifies a prototype
 * exists above the call site.
 */

// Same regex the parser uses for function signatures
const FUNC_SIG_REGEX = /^(?:(?:(?:static|private|public|protected|nosave|nomask|varargs|virtual)\s+)*)(void|int|string|object|mapping|mixed|float|status|closure|symbol)\s*\*?\s+(\*?\s*\w+)\s*\(/;

export function forwardReference(
  document: vscode.TextDocument,
  contexts: LpcContext,
  _config: Config
): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];
  const functions = contexts.functions;

  if (functions.length < 2) { return diagnostics; }

  // Build a map of locally-defined function names to their definition line
  const funcDefLines = new Map<string, number>();
  for (const fn of functions) {
    funcDefLines.set(fn.name, fn.signatureLine);
  }

  // Find prototype declarations — function signatures at top level ending
  // with ; (no body). These appear before any function definition.
  const prototypes = new Set<string>();
  findPrototypes(document, contexts, prototypes);

  // For each function, scan its body for calls to other local functions
  for (const caller of functions) {
    const bodyStart = caller.openBraceLine;
    const bodyEnd = caller.closeBraceLine;

    for (let lineNum = bodyStart; lineNum <= bodyEnd; lineNum++) {
      const ctx = contexts.lines[lineNum];
      if (ctx.isInBlockComment || ctx.isPreprocessor) { continue; }

      const line = ctx.text;

      // Check each locally-defined function name
      for (const [calledName, defLine] of funcDefLines) {
        // Skip self-references (recursion is fine)
        if (calledName === caller.name) { continue; }

        // Only warn if the called function is defined AFTER the caller
        if (defLine <= caller.signatureLine) { continue; }

        // Skip if a prototype exists
        if (prototypes.has(calledName)) { continue; }

        // Search for the function call pattern on this line
        const callPositions = findCallsOnLine(line, calledName, ctx);
        for (const col of callPositions) {
          diagnostics.push(
            new vscode.Diagnostic(
              new vscode.Range(lineNum, col, lineNum, col + calledName.length),
              calledName + "() is called before it is defined. " +
              "Add a forward prototype declaration or move it above " +
              caller.name + "().",
              vscode.DiagnosticSeverity.Warning
            )
          );
        }
      }
    }
  }

  return diagnostics;
}

/**
 * Find forward prototype declarations in the file.
 * A prototype looks like a function signature followed by ); at
 * top-level (braceDepth 0), with no opening brace.
 */
function findPrototypes(
  document: vscode.TextDocument,
  contexts: LpcContext,
  prototypes: Set<string>
): void {
  for (let i = 0; i < document.lineCount; i++) {
    const ctx = contexts.lines[i];
    if (ctx.isInBlockComment || ctx.isInString || ctx.isPreprocessor) {
      continue;
    }
    // Prototypes are at top level
    if (ctx.braceDepth !== 0) { continue; }

    const trimmed = ctx.text.trim();

    // Must end with ); to be a prototype (not a definition)
    if (!trimmed.endsWith(");")) { continue; }

    // Must not contain { (not a one-liner function)
    if (trimmed.includes("{")) { continue; }

    // Try to match a function signature
    const match = trimmed.match(FUNC_SIG_REGEX);
    if (match) {
      const name = match[2].replace(/^\*\s*/, "").trim();
      prototypes.add(name);
    }
  }
}

/**
 * Find all positions where a function name is called on a given line.
 * Returns column indices. Ensures word boundaries and skips strings,
 * comments, and non-call references.
 */
function findCallsOnLine(
  line: string,
  funcName: string,
  ctx: { isInBlockComment: boolean; isInString: boolean }
): number[] {
  const positions: number[] = [];
  if (ctx.isInBlockComment || ctx.isInString) { return positions; }

  let pos = 0;
  while (pos < line.length) {
    const idx = line.indexOf(funcName, pos);
    if (idx === -1) { break; }

    // Check word boundary before — must not be preceded by a word char or ::
    if (idx > 0) {
      const before = line[idx - 1];
      if (/\w/.test(before) || before === ":") {
        pos = idx + 1;
        continue;
      }
    }

    // Check that ( follows the name (possibly with whitespace)
    const afterIdx = idx + funcName.length;
    const afterSlice = line.substring(afterIdx).trimStart();
    if (!afterSlice.startsWith("(")) {
      pos = idx + 1;
      continue;
    }

    // Check we're not inside a string or comment at this position
    if (isInsideStringOrComment(line, idx)) {
      pos = idx + 1;
      continue;
    }

    positions.push(idx);
    pos = afterIdx;
  }

  return positions;
}

/**
 * Simple check if a column position is inside a string or line comment.
 * Scans from the start of the line to the given column.
 */
function isInsideStringOrComment(line: string, col: number): boolean {
  let inStr = false;

  for (let i = 0; i < col; i++) {
    const ch = line[i];

    if (inStr) {
      if (ch === "\\") { i++; continue; }
      if (ch === "\"") { inStr = false; }
      continue;
    }

    if (ch === "\"") { inStr = true; continue; }

    // Line comment — everything after is comment
    if (ch === "/" && i + 1 < line.length && line[i + 1] === "/") {
      return true;
    }
  }

  return inStr;
}
