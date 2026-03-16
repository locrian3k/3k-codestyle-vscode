/**
 * Re-indent code based on brace, paren, LPC literal, and case depth.
 *
 * Tracks code-block brace depth for primary indentation, paren depth
 * for continuation lines (e.g., multi-line function call arguments),
 * LPC literal depth for array ({, mapping ([, and closure (: nesting,
 * and case/default labels inside switch statements.
 *
 * LPC literals get their own depth counter so items inside ({ }) are
 * indented one level deeper than the ({ itself, and }) aligns with ({.
 * Regular paren nesting contributes +1 per literal context that has
 * open parens (so chained calls like ansi_tell_object(to_ansi(WWRAP(
 * stay flat, but a function call inside a literal gets its own +1).
 *
 * Detects bracketless control flow (if/else/while/for without braces)
 * and indents the body statement one level deeper.
 *
 * Skips preprocessor directives, respects strings and comments.
 */
export function fixIndentation(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];

  let depth = 0;
  let parenDepth = 0;
  let literalDepth = 0;
  // Stack of parenDepth at each literal entry, for per-context paren indent
  const parenAtLiteralEntry: number[] = [];
  let pendingBodyIndent = 0;
  let inBlockComment = false;
  let inString = false;
  // Track whether we're inside a case body (for +1 indent after case label)
  let inCaseBody = false;
  // Track switch brace depth so we know when a } exits a switch
  const switchBraceDepths: number[] = [];

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

    // If we're in a block comment, preserve content exactly as-is.
    // Only adjust leading indentation to match current depth.
    // Do NOT add or remove * characters — commented-out code should stay clean.
    if (inBlockComment) {
      result.push("  ".repeat(depth) + trimmed);
      updateState(line);
      continue;
    }

    // Check if } at start is a code brace close (not LPC literal like }))
    const startsWithCodeBraceClose = trimmed.startsWith("}")
      && !trimmed.startsWith("})");

    // If line starts with a code-block closing brace, reduce depth first
    if (startsWithCodeBraceClose && depth > 0) {
      // If this } closes a switch, clear case body state
      if (switchBraceDepths.length > 0
          && switchBraceDepths[switchBraceDepths.length - 1] === depth - 1) {
        switchBraceDepths.pop();
        inCaseBody = false;
      }
      depth--;
    }

    // Detect case/default labels — they go at the same depth as the switch body
    // (one level inside the switch braces), NOT deeper
    const isCaseLabel = !inString && !inBlockComment && isCaseLine(trimmed);
    const isDefaultLabel = !inString && !inBlockComment
      && /^default\s*:/.test(trimmed);

    // If this is a case/default label and we were in a case body, drop back
    if ((isCaseLabel || isDefaultLabel) && inCaseBody) {
      inCaseBody = false;
    }

    // Count leading closes (LPC literals and regular parens) for indent
    const closes = countLeadingCloses(trimmed);
    const effectiveLitDepth = Math.max(0, literalDepth - closes.literals);
    const hasLeadingRegularClose = closes.regulars > 0;
    const parenComponent = calcParenContribution(
      parenDepth, parenAtLiteralEntry, hasLeadingRegularClose
    );
    const parenIndent = parenComponent + effectiveLitDepth;

    // Apply pending body indent from bracketless control flow
    // (if/else/while/for without braces). Reset if line opens a brace.
    // Comment lines (// ...) receive the indent but don't consume it —
    // comments aren't statements, so the actual body comes after them.
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

    // Calculate total indentation
    const caseIndent = inCaseBody ? 1 : 0;
    const totalDepth = depth + parenIndent + caseIndent + bodyIndent;
    const indented = "  ".repeat(totalDepth) + trimmed;
    result.push(indented);

    // After outputting a case/default label line, enter case body mode
    // (unless it's a one-liner like "case 0: return;")
    if ((isCaseLabel || isDefaultLabel) && !inCaseBody) {
      // Check if the case has a statement on the same line after the label
      const afterLabel = trimmed.replace(/^(case\s+.*?|default)\s*:\s*/, "");
      if (afterLabel.length === 0 || afterLabel === "{") {
        // No inline statement — next lines are case body
        inCaseBody = true;
      }
      // If there IS an inline statement (like "case 0: return;"), don't enter case body
    }

    // Detect switch statement — next { opens a switch block
    if (/^switch\s*\(/.test(trimmed) || trimmed === "switch") {
      // The opening { will be on this line or next; record the depth
      // when we see the { for the switch
      switchBraceDepths.push(depth);
    }

    // Count net depth changes on this line (excluding LPC literals and strings)
    const changes = countDepthChanges(line, literalDepth);

    // Handle brace depth
    if (startsWithCodeBraceClose) {
      depth += changes.braces + 1; // +1 to compensate for the close we already handled
    } else {
      depth += changes.braces;
    }
    if (depth < 0) {
      depth = 0;
    }

    // Handle paren and literal depth
    const newParenDepth = Math.max(0, parenDepth + changes.parens);

    // Update literal entry stack: record parenDepth when entering literals
    if (changes.literals > 0) {
      for (let i = 0; i < changes.literals; i++) {
        parenAtLiteralEntry.push(newParenDepth);
      }
    } else if (changes.literals < 0) {
      for (let i = 0; i < -changes.literals; i++) {
        if (parenAtLiteralEntry.length > 0) parenAtLiteralEntry.pop();
      }
    }

    parenDepth = newParenDepth;
    literalDepth = Math.max(0, literalDepth + changes.literals);

    // Detect bracketless control flow headers for next-line body indent.
    // When if/else if/while/for has a complete condition (parenDepth == 0)
    // and doesn't end with { or ; or }, the next line is a bracketless body.
    // Lines ending with } are one-liner braced statements (already complete).
    if (!inBlockComment && !inString
        && parenDepth === 0 && literalDepth === 0) {
      const codePart = stripTrailingComment(trimmed).trimEnd();
      const lastChar = codePart.length > 0
        ? codePart[codePart.length - 1] : '';
      if (lastChar !== '{' && lastChar !== ';' && lastChar !== '}'
          && codePart.length > 0) {
        if (/^(if|else\s+if|while|for)\s*\(/.test(trimmed)) {
          pendingBodyIndent = 1;
        } else if (/^else\b/.test(trimmed)
                   && !/^else\s+if\b/.test(trimmed)) {
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

  function countDepthChanges(
    line: string,
    currentLiteralDepth: number
  ): { braces: number; parens: number; literals: number } {
    let braces = 0;
    let parens = 0;
    let literals = 0;
    // Track local literal depth so we only recognize }) ]) :) as literal
    // closers when we're actually inside a literal. Without this, patterns
    // like array[i]) are misidentified as ]) literal closers.
    let localLitDepth = currentLiteralDepth;
    let localInString = false;
    let localInComment = false;

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

      // LPC literal openers: ({ ([ (: — tracked as literal depth
      // Guard against (:: which is paren + scope-resolution, not a closure literal.
      if (ch === "(" && (next === "{" || next === "[" ||
          (next === ":" && (i + 2 >= line.length || line[i + 2] !== ":")))) {
        literals++;
        localLitDepth++;
        i++; // skip the {/[/:
        continue;
      }
      // LPC literal closers: }) ]) :) — only when inside a literal.
      // Without the depth check, array[i]) would be misread as ]).
      if (localLitDepth > 0
          && (ch === "}" || ch === "]" || ch === ":")
          && next === ")") {
        literals--;
        localLitDepth--;
        i++; // skip the )
        continue;
      }

      if (ch === "{") { braces++; }
      if (ch === "}") { braces--; }
      if (ch === "(") { parens++; }
      if (ch === ")") { parens--; }
    }

    return { braces, parens, literals };
  }
}

/**
 * Calculate paren contribution to indentation, accounting for literal
 * boundaries. Each "context" (base level, and each literal nesting level)
 * contributes at most +1 if it has open parens. This prevents
 * over-indentation for deeply nested function calls (like
 * ansi_tell_object(to_ansi(WWRAP(...)))) while correctly indenting
 * function calls inside LPC literals.
 *
 * When skipInnermost is true (leading close paren), the innermost
 * context's parens are not counted, aligning the close with its opener.
 */
function calcParenContribution(
  parenDepth: number,
  parenAtLiteralEntry: number[],
  skipInnermost: boolean
): number {
  if (parenDepth === 0) return 0;

  let contribution = 0;
  let prevBoundary = 0;

  for (let i = 0; i < parenAtLiteralEntry.length; i++) {
    const parensAtLevel = parenAtLiteralEntry[i] - prevBoundary;
    if (parensAtLevel > 0) contribution++;
    prevBoundary = parenAtLiteralEntry[i];
  }

  if (!skipInnermost) {
    const parensInCurrent = parenDepth - prevBoundary;
    if (parensInCurrent > 0) contribution++;
  }

  return contribution;
}

/**
 * Count leading paren-level closes at the start of a trimmed line.
 * Returns separate counts for LPC literal closes (}), ]), :)) and
 * regular paren closes ()). Skips whitespace, semicolons, and commas
 * between close constructs.
 */
function countLeadingCloses(
  trimmed: string
): { literals: number; regulars: number } {
  let literals = 0;
  let regulars = 0;
  let i = 0;

  while (i < trimmed.length) {
    // LPC literal closers: }) ]) :)
    if (i + 1 < trimmed.length) {
      const pair = trimmed[i] + trimmed[i + 1];
      if (pair === "})" || pair === "])" || pair === ":)") {
        literals++;
        i += 2;
        continue;
      }
    }
    // Regular close paren
    if (trimmed[i] === ")") {
      regulars++;
      i++;
      continue;
    }
    // Skip whitespace, semicolons, and commas between closes
    if (trimmed[i] === " " || trimmed[i] === "\t"
        || trimmed[i] === ";" || trimmed[i] === ",") {
      i++;
      continue;
    }
    // Stop at first non-close character
    break;
  }

  return { literals, regulars };
}

/**
 * Strip a trailing // comment from a line, respecting strings.
 * Returns everything before the comment (or the full line if none).
 */
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

/**
 * Detect if a trimmed line is a case label.
 * Matches: case 0:, case 1..24:, case "foo":, etc.
 * Must not confuse with "default:" or code containing "case" as a substring.
 */
function isCaseLine(trimmed: string): boolean {
  return /^case\s+.+:/.test(trimmed);
}
