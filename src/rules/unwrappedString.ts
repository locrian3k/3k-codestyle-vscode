import * as vscode from "vscode";
import { LpcContext, LpcFunction } from "../lpcParser";
import { Config } from "../config";

/**
 * Rule: Output functions (write, tell_object, ansi_write, ansi_tell_object,
 * tell_room, ansi_tell_room) with long string arguments (>80 chars combined)
 * should use word_wrap() for proper line wrapping.
 *
 * Context-aware:
 *   - Skips calls inside create() or reset() where word_wrap() cannot be
 *     used (compile-time storage, no active player).
 *   - Single-target functions suggest word_wrap().
 *   - Multi-target functions (tell_room, etc.) note that word_wrap() cannot
 *     be used and suggest manual wrapping.
 *
 * Handles multi-line calls and juxtaposed string literals:
 *   tell_object(TP,
 *     "Part one of a long string "
 *     "part two continues here.\n"
 *   );
 *
 * The juxtaposed strings are combined and their total length is checked.
 */

const MIN_STRING_LENGTH = 80;

// Single-target output functions — word_wrap() is safe
const SINGLE_TARGET = [
  "write",
  "tell_object",
  "ansi_write",
  "ansi_tell_object",
];

// Multi-target output functions — word_wrap() CANNOT be used
const MULTI_TARGET = [
  "tell_room",
  "ansi_tell_room",
];

const ALL_OUTPUT_FUNCTIONS = [...SINGLE_TARGET, ...MULTI_TARGET];

/**
 * Find which function encloses a given line number.
 * Returns the LpcFunction or null if the line is top-level.
 */
function getEnclosingFunction(
  lineNum: number,
  functions: LpcFunction[]
): LpcFunction | null {
  for (const fn of functions) {
    if (lineNum >= fn.openBraceLine && lineNum <= fn.closeBraceLine) {
      return fn;
    }
  }
  return null;
}

export function unwrappedString(
  document: vscode.TextDocument,
  contexts: LpcContext,
  _config: Config
): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];
  const lineCount = document.lineCount;

  for (let lineNum = 0; lineNum < lineCount; lineNum++) {
    const ctx = contexts.lines[lineNum];
    if (ctx.isInBlockComment || ctx.isInString || ctx.isPreprocessor) {
      continue;
    }

    const line = ctx.text;
    const trimmed = line.trim();
    if (trimmed.startsWith("//")) { continue; }

    // Find output function calls on this line
    for (const func of ALL_OUTPUT_FUNCTIONS) {
      let searchFrom = 0;
      while (searchFrom < line.length) {
        const callIdx = findFunctionCall(line, func, searchFrom);
        if (callIdx === -1) { break; }

        // Find the opening paren
        const parenIdx = line.indexOf("(", callIdx + func.length);
        if (parenIdx === -1) { searchFrom = callIdx + func.length; continue; }

        // Skip calls inside create() or reset() — word_wrap() cannot be
        // used at compile-time (wraps to whoever loaded the room)
        const enclosing = getEnclosingFunction(lineNum, contexts.functions);
        if (enclosing && (enclosing.name === "create" || enclosing.name === "reset")) {
          searchFrom = callIdx + func.length;
          continue;
        }

        // Extract the full call text across multiple lines
        const callSpan = extractCallSpan(document, lineNum, parenIdx);
        if (!callSpan) { searchFrom = callIdx + func.length; continue; }

        // Check if already wrapped in word_wrap()
        if (isWrapped(callSpan.text)) {
          searchFrom = callIdx + func.length;
          continue;
        }

        // Find string groups (juxtaposed strings combined)
        const isAnsiFunc = func.startsWith("ansi_");
        const issue = checkForUnwrapped(callSpan.text, isAnsiFunc);
        if (issue) {
          const isSingleTarget = SINGLE_TARGET.includes(func);
          const message = isSingleTarget
            ? "Long string in " + func + "() should be wrapped in " +
              "word_wrap() for proper line wrapping."
            : "Long string in " + func + "() may need manual word " +
              "wrapping (word_wrap() cannot be used for multi-target output).";
          const code = isSingleTarget
            ? "unwrapped-string"
            : "unwrapped-string-multi";

          const diag = new vscode.Diagnostic(
            new vscode.Range(lineNum, callIdx, lineNum, parenIdx + 1),
            message,
            vscode.DiagnosticSeverity.Warning
          );
          diag.code = code;
          diagnostics.push(diag);
        }

        searchFrom = callIdx + func.length;
      }
    }
  }

  return diagnostics;
}

/**
 * Find a function call by name, ensuring it's a whole-word match
 * followed by '(' and not preceded by a word character or '::'.
 */
function findFunctionCall(
  line: string,
  name: string,
  from: number
): number {
  let pos = from;
  while (pos < line.length) {
    const idx = line.indexOf(name, pos);
    if (idx === -1) { return -1; }

    // Check word boundary before
    if (idx > 0) {
      const before = line[idx - 1];
      if (/\w/.test(before) || before === ":") {
        pos = idx + 1;
        continue;
      }
    }

    // Check '(' follows the name (possibly with whitespace)
    const afterName = line.substring(idx + name.length).trimStart();
    if (afterName.startsWith("(")) {
      return idx;
    }

    pos = idx + 1;
  }
  return -1;
}

/**
 * Extract the full text of a function call's arguments, spanning
 * multiple lines if needed. Tracks paren depth to find the closing paren.
 * Returns the concatenated text and the end line number.
 */
function extractCallSpan(
  document: vscode.TextDocument,
  startLine: number,
  parenCol: number
): { text: string; endLine: number } | null {
  let depth = 0;
  let text = "";
  const maxLines = Math.min(startLine + 20, document.lineCount);

  for (let l = startLine; l < maxLines; l++) {
    const lineText = l === startLine
      ? document.lineAt(l).text.substring(parenCol)
      : document.lineAt(l).text;

    for (let i = 0; i < lineText.length; i++) {
      const ch = lineText[i];
      const next = i + 1 < lineText.length ? lineText[i + 1] : "";

      // Skip line comments
      if (ch === "/" && next === "/") { break; }

      // Skip strings (but include them in text)
      if (ch === "\"") {
        text += ch;
        i++;
        while (i < lineText.length) {
          text += lineText[i];
          if (lineText[i] === "\\") { i++; if (i < lineText.length) { text += lineText[i]; } }
          else if (lineText[i] === "\"") { break; }
          i++;
        }
        continue;
      }

      // Skip char literals
      if (ch === "'") {
        const close = lineText.indexOf("'", i + 1);
        if (close > i) {
          text += lineText.substring(i, close + 1);
          i = close;
          continue;
        }
      }

      if (ch === "(") { depth++; }
      if (ch === ")") {
        depth--;
        if (depth === 0) {
          text += ch;
          return { text, endLine: l };
        }
      }

      text += ch;
    }
    text += " "; // Join lines with space
  }

  return null; // Couldn't find matching close paren
}

/**
 * Check if the call arguments already contain word_wrap().
 */
function isWrapped(callText: string): boolean {
  // Check if word_wrap appears anywhere as a direct call in the arguments
  if (callText.indexOf("word_wrap(") !== -1) { return true; }
  if (callText.indexOf("word_wrap (") !== -1) { return true; }
  return false;
}

/**
 * Check if the call has unwrapped long string arguments.
 * Combines juxtaposed string literals and checks total length.
 * For ansi functions, skips the first string (color tag).
 */
function checkForUnwrapped(callText: string, isAnsiFunc: boolean): boolean {
  // Parse all string groups from the call text
  const groups = findStringGroups(callText);

  if (groups.length === 0) { return false; }

  // For ansi functions, skip the first string group (color tag)
  const startIdx = isAnsiFunc ? 1 : 0;

  for (let i = startIdx; i < groups.length; i++) {
    if (groups[i].length > MIN_STRING_LENGTH) {
      return true;
    }
  }

  return false;
}

/**
 * Find groups of juxtaposed string literals in a call's argument text.
 * Adjacent strings separated only by whitespace are combined.
 * Returns the combined content length of each group.
 */
function findStringGroups(
  text: string
): { length: number }[] {
  const groups: { length: number }[] = [];
  let i = 0;
  let depth = 0;
  let currentGroup = -1; // -1 means no active group
  let lastStringEnd = -1;

  while (i < text.length) {
    const ch = text[i];

    // Track paren depth (skip nested calls)
    if (ch === "(") { depth++; i++; continue; }
    if (ch === ")") { depth--; i++; continue; }

    // Skip comments
    if (ch === "/" && i + 1 < text.length && text[i + 1] === "/") { break; }

    // String literal
    if (ch === "\"" && depth === 1) {
      const start = i;
      i++;
      let content = "";
      while (i < text.length) {
        if (text[i] === "\\") {
          content += text[i] + (i + 1 < text.length ? text[i + 1] : "");
          i += 2;
          continue;
        }
        if (text[i] === "\"") { break; }
        content += text[i];
        i++;
      }
      i++; // skip closing quote

      // Check if this string is juxtaposed with the previous one
      // (only whitespace between them at the same depth)
      const gapText = lastStringEnd >= 0
        ? text.substring(lastStringEnd, start).trim()
        : "X"; // force new group if first string

      if (gapText === "" && currentGroup >= 0) {
        // Juxtaposed — add to current group
        groups[currentGroup].length += content.length;
      } else {
        // New group
        groups.push({ length: content.length });
        currentGroup = groups.length - 1;
      }

      lastStringEnd = i;
      continue;
    }

    // Non-string, non-whitespace resets juxtaposition tracking
    if (ch !== " " && ch !== "\t" && ch !== "\n" && ch !== "\r") {
      if (ch === ",") {
        // Comma separates arguments — next string starts a new group
        currentGroup = -1;
        lastStringEnd = -1;
      }
    }

    i++;
  }

  return groups;
}
