import * as vscode from "vscode";

/**
 * Per-line context computed by parsing the full document.
 * Used by lint rules and the formatter to understand LPC syntax.
 */
export interface LpcLineContext {
  lineNumber: number;
  text: string;
  /** Line starts inside a block comment from a previous line */
  isInBlockComment: boolean;
  /** Line is a preprocessor directive (#pragma, #include, etc.) */
  isPreprocessor: boolean;
  /** Number of array literal ({ }) nestings active at line start */
  arrayLiteralDepth: number;
  /** Number of mapping literal ([ ]) nestings active at line start */
  mappingLiteralDepth: number;
  /** Number of closure (: :) nestings active at line start */
  closureDepth: number;
  /** Code-block brace depth at line start (excludes array/mapping braces) */
  braceDepth: number;
  /** Parenthesis depth at line start */
  parenDepth: number;
  /** Line starts inside a string literal from a previous line */
  isInString: boolean;
  /** Positions of code-block opening braces on this line */
  blockBraceOpenPositions: number[];
  /** Positions of code-block closing braces on this line */
  blockBraceClosePositions: number[];
}

/**
 * Represents a parsed function found in the document.
 */
export interface LpcFunction {
  /** Function name */
  name: string;
  /** Return type (void, int, string, etc.) */
  returnType: string;
  /** Line number of the function signature */
  signatureLine: number;
  /** Line number of the opening brace */
  openBraceLine: number;
  /** Column of the opening brace */
  openBraceCol: number;
  /** Line number of the closing brace */
  closeBraceLine: number;
  /** Column of the closing brace */
  closeBraceCol: number;
  /** Whether the entire function is on one line */
  isOneLiner: boolean;
}

/**
 * Full parse result for a document.
 */
export interface LpcContext {
  lines: LpcLineContext[];
  functions: LpcFunction[];
}

// LPC type keywords used in function signatures
const LPC_TYPES = new Set([
  "void", "int", "string", "object", "mapping", "mixed",
  "float", "status", "closure", "symbol",
]);

// Modifiers that can precede a type in function signatures
const LPC_MODIFIERS = new Set([
  "static", "private", "public", "protected",
  "nosave", "nomask", "varargs", "virtual",
]);

/**
 * Parse a document into per-line contexts and function boundaries.
 * Single forward pass, character by character.
 */
export function parseDocument(document: vscode.TextDocument): LpcContext {
  const lineCount = document.lineCount;
  const lines: LpcLineContext[] = [];

  // State carried across lines
  let inBlockComment = false;
  let inString = false;
  let braceDepth = 0;
  let parenDepth = 0;
  let arrayLiteralDepth = 0;
  let mappingLiteralDepth = 0;
  let closureDepth = 0;

  // Track potential function signatures for Phase 3 voidReturn rule
  const functions: LpcFunction[] = [];
  const pendingFunctions: {
    name: string;
    returnType: string;
    signatureLine: number;
    targetBraceDepth: number;
  }[] = [];

  for (let lineNum = 0; lineNum < lineCount; lineNum++) {
    const lineText = document.lineAt(lineNum).text;

    // Record state at line start
    const ctx: LpcLineContext = {
      lineNumber: lineNum,
      text: lineText,
      isInBlockComment: inBlockComment,
      isPreprocessor: false,
      arrayLiteralDepth,
      mappingLiteralDepth,
      closureDepth,
      braceDepth,
      parenDepth,
      isInString: inString,
      blockBraceOpenPositions: [],
      blockBraceClosePositions: [],
    };

    // Check for preprocessor (only if not in block comment or string)
    if (!inBlockComment && !inString) {
      const trimmed = lineText.trimStart();
      if (trimmed.startsWith("#")) {
        ctx.isPreprocessor = true;
      }
    }

    // Character-by-character scan
    const len = lineText.length;
    for (let i = 0; i < len; i++) {
      const ch = lineText[i];
      const next = i + 1 < len ? lineText[i + 1] : "";

      // Inside a block comment — look for */
      if (inBlockComment) {
        if (ch === "*" && next === "/") {
          inBlockComment = false;
          i++; // skip the /
        }
        continue;
      }

      // Inside a string literal — look for closing " or escape
      if (inString) {
        if (ch === "\\") {
          i++; // skip escaped character
        } else if (ch === "\"") {
          inString = false;
        }
        continue;
      }

      // Start of block comment
      if (ch === "/" && next === "*") {
        inBlockComment = true;
        i++; // skip the *
        continue;
      }

      // Line comment — skip rest of line
      if (ch === "/" && next === "/") {
        break;
      }

      // String literal start
      if (ch === "\"") {
        inString = true;
        continue;
      }

      // Character literal — skip contents (e.g., '{' inside '\'')
      if (ch === "'") {
        // Simple char literal: skip to closing '
        const closeQuote = lineText.indexOf("'", i + 1);
        if (closeQuote > i) {
          i = closeQuote;
        }
        continue;
      }

      // Opening paren — check for LPC composite literal starts
      if (ch === "(") {
        parenDepth++;
        // Look ahead for ({, ([, (:
        if (next === "{") {
          arrayLiteralDepth++;
          i++; // skip the {
          continue;
        }
        if (next === "[") {
          mappingLiteralDepth++;
          i++; // skip the [
          continue;
        }
        if (next === ":") {
          closureDepth++;
          i++; // skip the :
          continue;
        }
        continue;
      }

      // Closing composite literals: }), ]), :)
      if (ch === "}" && next === ")") {
        if (arrayLiteralDepth > 0) {
          arrayLiteralDepth--;
          parenDepth--;
          i++; // skip the )
          continue;
        }
      }
      if (ch === "]" && next === ")") {
        if (mappingLiteralDepth > 0) {
          mappingLiteralDepth--;
          parenDepth--;
          i++; // skip the )
          continue;
        }
      }
      if (ch === ":" && next === ")") {
        if (closureDepth > 0) {
          closureDepth--;
          parenDepth--;
          i++; // skip the )
          continue;
        }
      }

      // Closing paren (standalone)
      if (ch === ")") {
        if (parenDepth > 0) {
          parenDepth--;
        }
        continue;
      }

      // Code block braces (not part of array/mapping/closure)
      if (ch === "{") {
        ctx.blockBraceOpenPositions.push(i);
        // Check if any pending function is waiting for this brace
        for (const pf of pendingFunctions) {
          if (pf.targetBraceDepth === braceDepth) {
            // This opening brace starts the function body
            // Will be completed when matching close brace is found
            break;
          }
        }
        braceDepth++;
        continue;
      }
      if (ch === "}") {
        braceDepth--;
        ctx.blockBraceClosePositions.push(i);
        // Check if this closes any tracked function
        for (let fi = pendingFunctions.length - 1; fi >= 0; fi--) {
          if (pendingFunctions[fi].targetBraceDepth === braceDepth) {
            const pf = pendingFunctions[fi];
            functions.push({
              name: pf.name,
              returnType: pf.returnType,
              signatureLine: pf.signatureLine,
              openBraceLine: pf.signatureLine, // will be refined below
              openBraceCol: 0,
              closeBraceLine: lineNum,
              closeBraceCol: i,
              isOneLiner: false, // computed after
            });
            pendingFunctions.splice(fi, 1);
            break;
          }
        }
        continue;
      }
    }

    lines.push(ctx);

    // After processing the line, try to detect function signatures
    // Only at top-level brace depth (0) or if not inside composites
    if (!ctx.isInBlockComment && !ctx.isInString && !ctx.isPreprocessor
        && arrayLiteralDepth === 0 && mappingLiteralDepth === 0 && closureDepth === 0) {
      const funcMatch = detectFunctionSignature(lineText, lineNum, ctx.braceDepth);
      if (funcMatch) {
        // Check if the opening brace is on this line
        if (ctx.blockBraceOpenPositions.length > 0 && funcMatch.targetBraceDepth === ctx.braceDepth) {
          // Brace was already opened on this line — check if also closed
          if (ctx.blockBraceClosePositions.length > 0) {
            // One-liner function
            functions.push({
              name: funcMatch.name,
              returnType: funcMatch.returnType,
              signatureLine: lineNum,
              openBraceLine: lineNum,
              openBraceCol: ctx.blockBraceOpenPositions[0],
              closeBraceLine: lineNum,
              closeBraceCol: ctx.blockBraceClosePositions[ctx.blockBraceClosePositions.length - 1],
              isOneLiner: true,
            });
          } else {
            pendingFunctions.push(funcMatch);
          }
        } else {
          pendingFunctions.push(funcMatch);
        }
      }
    }
  }

  // Refine function open brace lines
  for (const func of functions) {
    if (!func.isOneLiner) {
      // Find the actual open brace line by scanning from signature
      for (let l = func.signatureLine; l <= func.closeBraceLine; l++) {
        const lctx = lines[l];
        if (lctx && lctx.blockBraceOpenPositions.length > 0) {
          func.openBraceLine = l;
          func.openBraceCol = lctx.blockBraceOpenPositions[0];
          break;
        }
      }
      // Check if open and close brace are on same line
      if (func.openBraceLine === func.closeBraceLine) {
        func.isOneLiner = true;
      }
    }
  }

  return { lines, functions };
}

/**
 * Attempt to detect a function signature on the given line.
 * Returns metadata if found, null otherwise.
 */
function detectFunctionSignature(
  lineText: string,
  lineNum: number,
  currentBraceDepth: number
): { name: string; returnType: string; signatureLine: number; targetBraceDepth: number } | null {
  // Only detect functions at brace depth 0 (top-level) or 1 (inside a single namespace)
  if (currentBraceDepth > 1) {
    return null;
  }

  // Pattern: [modifiers] type [*] name ( ... )
  // The line may or may not end with { (K&R vs Allman)
  const trimmed = lineText.trim();

  // Skip preprocessor, inherit, comments
  if (trimmed.startsWith("#") || trimmed.startsWith("//") || trimmed.startsWith("/*")
      || trimmed.startsWith("*") || trimmed.startsWith("inherit ")) {
    return null;
  }

  // Regex to match function signatures
  // Captures: optional modifiers, return type, optional * (on either side), function name, parens
  // Handles both "string *func" and "string* func" pointer return styles
  const funcRegex = /^(?:((?:(?:static|private|public|protected|nosave|nomask|varargs|virtual)\s+)*))(void|int|string|object|mapping|mixed|float|status|closure|symbol)\s*\*?\s+(\*?\s*\w+)\s*\(/;
  const match = trimmed.match(funcRegex);
  if (!match) {
    return null;
  }

  const returnType = match[2];
  const name = match[3].replace(/^\*\s*/, "").trim();

  // Verify the line has closing paren (possibly multi-line params, but we handle simple case)
  // For multi-line params, we rely on the pending function mechanism
  return {
    name,
    returnType,
    signatureLine: lineNum,
    targetBraceDepth: currentBraceDepth,
  };
}

/**
 * Check if a position in a line is inside a string, comment, or LPC literal.
 * Uses the pre-computed line context plus a local scan.
 */
export function isInNonCodeContext(
  ctx: LpcLineContext,
  col: number
): boolean {
  if (ctx.isInBlockComment || ctx.isInString) {
    return true;
  }
  if (ctx.arrayLiteralDepth > 0 || ctx.mappingLiteralDepth > 0 || ctx.closureDepth > 0) {
    return true;
  }

  // Local scan to check if col is inside a string or comment on this line
  let inStr: boolean = ctx.isInString;
  let inComment: boolean = ctx.isInBlockComment;

  for (let i = 0; i < col && i < ctx.text.length; i++) {
    const ch = ctx.text[i];
    const next = i + 1 < ctx.text.length ? ctx.text[i + 1] : "";

    if (inComment) {
      if (ch === "*" && next === "/") {
        inComment = false;
        i++;
      }
      continue;
    }
    if (inStr) {
      if (ch === "\\") { i++; continue; }
      if (ch === "\"") { inStr = false; }
      continue;
    }
    if (ch === "/" && next === "*") { inComment = true; i++; continue; }
    if (ch === "/" && next === "/") { return true; } // rest of line is comment
    if (ch === "\"") { inStr = true; continue; }
  }

  return inStr || inComment;
}
