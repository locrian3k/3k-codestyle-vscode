/**
 * Re-indent LPC code using a stack-based approach.
 *
 * Every syntactic opener ({, (, ({, ([, (:) pushes a frame onto the
 * stack recording the opener's indent level and the content indent for
 * lines inside it. Every closer pops the matching frame, and closing
 * lines align to the opener's indent — no special pre-calculation needed.
 *
 * Paren capping: multiple nested ( in the same context contribute only
 * +1 total indent, so ansi_tell_object(to_ansi(WWRAP( stays flat.
 * A new context starts after any literal or brace frame.
 *
 * Also handles: bracketless control flow bodies (if/else/while/for),
 * switch/case indentation, block comments, strings, preprocessor
 * directives, and LPC-specific (:: vs (: distinction.
 */

type FrameKind = "brace" | "array" | "mapping" | "closure" | "paren" | "switch";

interface StackFrame {
  kind: FrameKind;
  openerIndent: number;
  contentIndent: number;
  contributesIndent: boolean;
}

// ---------------------------------------------------------------------------
// Stack helpers
// ---------------------------------------------------------------------------

function getIndent(stack: StackFrame[]): number {
  return stack.length > 0 ? stack[stack.length - 1].contentIndent : 0;
}

/**
 * Push a new frame onto the stack.
 * @param lineIndent - the computed indent of the LINE containing the opener
 *   (used for openerIndent so closers align with the line, not the stack)
 * contentIndent is always based on getIndent(stack) so nesting works correctly.
 */
function pushFrame(
  stack: StackFrame[], kind: FrameKind, lineIndent: number
): void {
  const contentBase = getIndent(stack);
  if (kind === "paren") {
    // Paren capping: walk top-down to nearest non-paren frame.
    // If a paren already exists in this context, don't add +1.
    let hasParenInContext = false;
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].kind === "paren") {
        hasParenInContext = true;
        break;
      }
      // Non-paren frame = context boundary — stop looking
      break;
    }
    if (hasParenInContext) {
      stack.push({
        kind, openerIndent: lineIndent,
        contentIndent: contentBase, contributesIndent: false,
      });
    } else {
      stack.push({
        kind, openerIndent: lineIndent,
        contentIndent: contentBase + 1, contributesIndent: true,
      });
    }
  } else {
    // When a literal ({, ([, (: immediately follows a function-call paren
    // on the same line, the paren's +1 and literal's +1 should not stack.
    // The literal subsumes the paren — items indent one level from the
    // function call line, not two.
    // e.g. set_attack_pattern(({ → items at indent 2, not 3
    let effectiveContent = contentBase + 1;
    if (isLiteralFrame(kind) && stack.length > 0) {
      const top = stack[stack.length - 1];
      if (top.kind === "paren" && top.openerIndent === lineIndent) {
        effectiveContent = lineIndent + 1;
      }
    }
    stack.push({
      kind, openerIndent: lineIndent,
      contentIndent: effectiveContent, contributesIndent: false,
    });
  }
}

function popFrame(
  stack: StackFrame[], expectedKind: FrameKind
): StackFrame | null {
  if (stack.length === 0) return null;
  const top = stack[stack.length - 1];
  // For literal closers, accept any literal kind defensively
  if (expectedKind === "array" || expectedKind === "mapping"
    || expectedKind === "closure")
  {
    if (top.kind === "array" || top.kind === "mapping"
      || top.kind === "closure")
    {
      return stack.pop()!;
    }
  }
  if (expectedKind === "brace" || expectedKind === "switch") {
    if (top.kind === "brace" || top.kind === "switch") {
      return stack.pop()!;
    }
  }
  if (top.kind === expectedKind) {
    return stack.pop()!;
  }
  return null;
}

function isLiteralFrame(kind: FrameKind): boolean {
  return kind === "array" || kind === "mapping" || kind === "closure";
}

function countLiteralFrames(stack: StackFrame[]): number {
  let n = 0;
  for (const f of stack) {
    if (isLiteralFrame(f.kind)) n++;
  }
  return n;
}

function hasOpenParensOrLiterals(stack: StackFrame[]): boolean {
  for (const f of stack) {
    if (f.kind === "paren" || isLiteralFrame(f.kind)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Determine line indent from leading close tokens (read-only peek)
// ---------------------------------------------------------------------------

/**
 * Peek at leading close tokens in trimmed line to determine what indent
 * level this line should have. Does NOT modify the stack — just reads it.
 *
 * Uses firstIndent (innermost closer's opener) when more content follows
 * the closes (e.g., }), 0, ({...})); aligns with the inner ({).
 * Uses lastIndent (outermost closer's opener) when the line is ONLY
 * closes and semicolons (e.g., })); aligns with the function call, not ({).
 */
function peekLineIndent(
  trimmed: string, stack: StackFrame[]
): { indent: number; isCloseLeading: boolean } {
  // Check if line starts with code brace close (not LPC literal)
  if (trimmed.startsWith("}") && !trimmed.startsWith("})")) {
    if (stack.length > 0) {
      const top = stack[stack.length - 1];
      if (top.kind === "brace" || top.kind === "switch") {
        return { indent: top.openerIndent, isCloseLeading: true };
      }
    }
    return { indent: Math.max(0, getIndent(stack) - 1), isCloseLeading: true };
  }

  // Check for LPC literal closes and paren closes
  let i = 0;
  let stackIdx = stack.length - 1;
  let firstIndent = -1;
  let lastIndent = -1;
  let foundAny = false;

  while (i < trimmed.length) {
    // LPC literal closers: }) ]) :)
    if (i + 1 < trimmed.length) {
      const pair = trimmed[i] + trimmed[i + 1];
      const isLitClose = pair === "})" || pair === "])" || pair === ":)";
      if (isLitClose) {
        // Find matching literal frame on stack
        while (stackIdx >= 0 && !isLiteralFrame(stack[stackIdx].kind)) {
          stackIdx--;
        }
        if (stackIdx >= 0) {
          if (firstIndent < 0) firstIndent = stack[stackIdx].openerIndent;
          lastIndent = stack[stackIdx].openerIndent;
          stackIdx--;
        }
        foundAny = true;
        i += 2;
        continue;
      }
    }
    // Regular close paren
    if (trimmed[i] === ")") {
      // Find matching paren frame
      while (stackIdx >= 0 && stack[stackIdx].kind !== "paren") {
        stackIdx--;
      }
      if (stackIdx >= 0) {
        if (firstIndent < 0) firstIndent = stack[stackIdx].openerIndent;
        lastIndent = stack[stackIdx].openerIndent;
        stackIdx--;
      }
      foundAny = true;
      i++;
      continue;
    }
    // Skip whitespace, semicolons, commas
    if (trimmed[i] === " " || trimmed[i] === "\t"
      || trimmed[i] === ";" || trimmed[i] === ",")
    {
      i++;
      continue;
    }
    break;
  }

  if (foundAny && firstIndent >= 0) {
    // Check if remaining content after closes is only whitespace/semicolons.
    // If so, line fully terminates the expression → align with outermost
    // opener (lastIndent). Otherwise, more content follows → align with
    // innermost opener (firstIndent).
    let onlyTerminators = true;
    for (let j = i; j < trimmed.length; j++) {
      const c = trimmed[j];
      if (c !== " " && c !== "\t" && c !== ";") {
        onlyTerminators = false;
        break;
      }
    }
    const indent = onlyTerminators ? lastIndent : firstIndent;
    return { indent, isCloseLeading: true };
  }
  return { indent: getIndent(stack), isCloseLeading: false };
}

// ---------------------------------------------------------------------------
// Full-line scanner — processes all opens/closes and updates stack
// ---------------------------------------------------------------------------

function scanFullLine(
  line: string, stack: StackFrame[], switchPending: boolean,
  lineIndent: number
): boolean {
  let localInString = false;
  let localInComment = false;
  let litCount = countLiteralFrames(stack);
  let foundBrace = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = i + 1 < line.length ? line[i + 1] : "";

    if (localInComment) {
      if (ch === "*" && next === "/") { localInComment = false; i++; }
      continue;
    }
    if (localInString) {
      if (ch === "\\") { i++; continue; }
      if (ch === "\"") { localInString = false; }
      continue;
    }
    if (ch === "/" && next === "*") { localInComment = true; i++; continue; }
    if (ch === "/" && next === "/") { break; }
    if (ch === "\"") { localInString = true; continue; }
    if (ch === "'") {
      const close = line.indexOf("'", i + 1);
      if (close > i) { i = close; }
      continue;
    }

    // LPC literal openers: ({ ([ (:
    // Guard: (:: is paren + scope-resolution, not closure literal.
    if (ch === "(" && (next === "{" || next === "["
      || (next === ":" && (i + 2 >= line.length || line[i + 2] !== ":"))))
    {
      const kind: FrameKind = next === "{"
        ? "array" : next === "[" ? "mapping" : "closure";
      pushFrame(stack, kind, lineIndent);
      litCount++;
      i++; // skip the {/[/:
      continue;
    }

    // LPC literal closers: }) ]) :) — only when inside a literal
    if (litCount > 0
      && (ch === "}" || ch === "]" || ch === ":")
      && next === ")")
    {
      const kind: FrameKind = ch === "}"
        ? "array" : ch === "]" ? "mapping" : "closure";
      const frame = popFrame(stack, kind);
      if (frame) litCount--;
      i++; // skip the )
      continue;
    }

    // Code braces
    if (ch === "{") {
      if (switchPending) {
        stack.push({
          kind: "switch",
          openerIndent: lineIndent,
          contentIndent: getIndent(stack) + 1,
          contributesIndent: false,
        });
        switchPending = false;
      } else {
        pushFrame(stack, "brace", lineIndent);
      }
      foundBrace = true;
      continue;
    }
    if (ch === "}") {
      popFrame(stack, "brace");
      continue;
    }

    // Regular parens
    if (ch === "(") {
      pushFrame(stack, "paren", lineIndent);
      continue;
    }
    if (ch === ")") {
      popFrame(stack, "paren");
      continue;
    }
  }

  return foundBrace;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function fixIndentation(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];

  const stack: StackFrame[] = [];
  let pendingBodyIndent = 0;
  let inBlockComment = false;
  let inString = false;
  let inCaseBody = false;
  let switchPending = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Empty lines stay empty
    if (trimmed.length === 0) {
      result.push("");
      updateState(line);
      continue;
    }

    // Preprocessor directives always at column 0
    if (!inBlockComment && !inString && trimmed.startsWith("#")) {
      result.push(trimmed);
      updateState(line);
      continue;
    }

    // Block comments: adjust leading indent to match brace depth
    if (inBlockComment) {
      let braceDepth = 0;
      for (const f of stack) {
        if (f.kind === "brace" || f.kind === "switch") braceDepth++;
      }
      result.push("  ".repeat(braceDepth) + trimmed);
      updateState(line);
      continue;
    }

    // ---------------------------------------------------------------
    // Compute indent for this line (read-only peek at stack)
    // ---------------------------------------------------------------

    const peek = peekLineIndent(trimmed, stack);
    let baseIndent = peek.indent;

    // If closing a switch brace, clear case body state before indent calc
    if (peek.isCloseLeading && trimmed.startsWith("}")
      && !trimmed.startsWith("})") && inCaseBody)
    {
      if (stack.length > 0 && stack[stack.length - 1].kind === "switch") {
        inCaseBody = false;
      }
    }

    // case/default label handling — drop back from case body indent
    const isCaseLabel_ = !inString && !inBlockComment && isCaseLine(trimmed);
    const isDefaultLabel = !inString && !inBlockComment
      && /^default\s*:/.test(trimmed);

    if ((isCaseLabel_ || isDefaultLabel) && inCaseBody) {
      inCaseBody = false;
    }

    // Bracketless control flow body indent
    let bodyIndent = 0;
    if (pendingBodyIndent > 0) {
      if (trimmed.startsWith("{")) {
        pendingBodyIndent = 0;
      } else if (trimmed.startsWith("//")) {
        bodyIndent = pendingBodyIndent;
      } else {
        bodyIndent = pendingBodyIndent;
        pendingBodyIndent = 0;
      }
    }

    // Total indent
    const caseIndent = inCaseBody ? 1 : 0;
    const totalIndent = baseIndent + caseIndent + bodyIndent;
    result.push("  ".repeat(totalIndent) + trimmed);

    // ---------------------------------------------------------------
    // Post-output: case body entry
    // ---------------------------------------------------------------

    if ((isCaseLabel_ || isDefaultLabel) && !inCaseBody) {
      const afterLabel = trimmed.replace(/^(case\s+.*?|default)\s*:\s*/, "");
      if (afterLabel.length === 0 || afterLabel === "{") {
        inCaseBody = true;
      }
    }

    // ---------------------------------------------------------------
    // Post-output: detect switch for next brace
    // ---------------------------------------------------------------

    if (/^switch\s*\(/.test(trimmed) || trimmed === "switch") {
      switchPending = true;
    }

    // ---------------------------------------------------------------
    // Scan full line to update stack state for next line
    // ---------------------------------------------------------------

    // If closing a switch brace, clear case body state
    if (peek.isCloseLeading && trimmed.startsWith("}")
      && !trimmed.startsWith("})"))
    {
      if (stack.length > 0) {
        const top = stack[stack.length - 1];
        if (top.kind === "switch") {
          inCaseBody = false;
        }
      }
    }

    const foundBrace = scanFullLine(line, stack, switchPending, totalIndent);
    if (foundBrace) switchPending = false;

    // ---------------------------------------------------------------
    // Detect bracketless control flow for next line
    // ---------------------------------------------------------------

    if (!inBlockComment && !inString && !hasOpenParensOrLiterals(stack)) {
      const codePart = stripTrailingComment(trimmed).trimEnd();
      const lastChar = codePart.length > 0
        ? codePart[codePart.length - 1] : '';
      if (lastChar !== '{' && lastChar !== ';' && lastChar !== '}'
        && codePart.length > 0)
      {
        if (/^(if|else\s+if|while|for)\s*\(/.test(trimmed)) {
          pendingBodyIndent = 1;
        } else if (/^else\b/.test(trimmed)
          && !/^else\s+if\b/.test(trimmed))
        {
          pendingBodyIndent = 1;
        }
      }
    }

    updateState(line);
  }

  return result.join("\n");

  function updateState(line: string): void {
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      const next = i + 1 < line.length ? line[i + 1] : "";

      if (inBlockComment) {
        if (ch === "*" && next === "/") {
          inBlockComment = false;
          i++;
        }
        continue;
      }
      if (inString) {
        if (ch === "\\") { i++; continue; }
        if (ch === "\"") { inString = false; }
        continue;
      }
      if (ch === "/" && next === "*") { inBlockComment = true; i++; continue; }
      if (ch === "/" && next === "/") { break; }
      if (ch === "\"") { inString = true; continue; }
    }
  }
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

function stripTrailingComment(line: string): string {
  let inStr = false;
  for (let i = 0; i < line.length; i++) {
    if (inStr) {
      if (line[i] === '\\') { i++; continue; }
      if (line[i] === '"') { inStr = false; }
      continue;
    }
    if (line[i] === '"') { inStr = true; continue; }
    if (line[i] === '/' && i + 1 < line.length && line[i + 1] === '/') {
      return line.substring(0, i);
    }
  }
  return line;
}

function isCaseLine(trimmed: string): boolean {
  return /^case\s+.+:/.test(trimmed);
}
