/**
 * Convert K&R bracket style to Allman style.
 *
 * Moves opening braces that appear on the same line as a control structure
 * or function definition to their own line.
 *
 * Skips:
 * - Array literals: ({ ... })
 * - Mapping literals: ([ ... ])
 * - Closures: (: ... :)
 * - Single-line blocks: { ... } all on one line
 * - Braces inside strings and comments
 */
export function convertToAllman(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];

  let inBlockComment = false;
  let inString = false;

  for (const line of lines) {
    // Fast path: if line doesn't contain {, pass through
    if (!line.includes("{")) {
      // Still track comment/string state
      updateState(line);
      result.push(line);
      continue;
    }

    // If we're in a block comment or string at the start of this line, pass through
    if (inBlockComment || inString) {
      updateState(line);
      result.push(line);
      continue;
    }

    // Try to find a code-block brace that should be on its own line
    const converted = convertLine(line);
    if (converted !== null) {
      for (const cl of converted) {
        result.push(cl);
      }
    } else {
      result.push(line);
    }

    // Update state after processing
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

  function convertLine(line: string): string[] | null {
    // Find the last { on the line that is a code-block brace
    let braceIdx = -1;
    let localInString = false;
    let localInComment = false;
    let parenDepth = 0;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      const next = i + 1 < line.length ? line[i + 1] : "";

      if (localInComment) {
        if (ch === "*" && next === "/") {
          localInComment = false;
          i++;
        }
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
        const closeQuote = line.indexOf("'", i + 1);
        if (closeQuote > i) { i = closeQuote; }
        continue;
      }

      if (ch === "(") {
        parenDepth++;
        // Check for LPC literal: ({, ([, (:
        // Guard against (:: which is paren + scope-resolution, not (:
        if (next === "{" || next === "[" ||
            (next === ":" && (i + 2 >= line.length || line[i + 2] !== ":"))) {
          i++; // skip the literal opener
          continue;
        }
        continue;
      }
      if (ch === ")") {
        if (parenDepth > 0) { parenDepth--; }
        continue;
      }
      // Skip }) ]( :) — literal closers
      if ((ch === "}" || ch === "]" || ch === ":") && next === ")") {
        if (parenDepth > 0) { parenDepth--; }
        i++;
        continue;
      }

      if (ch === "{") {
        // This is a code-block brace — record it
        braceIdx = i;
      }
    }

    if (braceIdx < 0) {
      return null; // no code-block brace found
    }

    // Check if there's content before the brace
    const before = line.substring(0, braceIdx).trimEnd();
    if (before.length === 0) {
      return null; // brace is already on its own (or only) position
    }

    // Check for single-line block: has matching } on same line after the {
    const afterBrace = line.substring(braceIdx + 1);
    if (afterBrace.includes("}")) {
      return null; // single-line block, allowed
    }

    // Check if the before-text looks like a control structure or function sig
    const isControl = /\b(if|else|for|while|foreach|switch|do)\b/.test(before)
      || /\)\s*$/.test(before)
      || /\belse\s*$/.test(before);
    const isFuncSig = /\b(?:void|int|string|object|mapping|mixed|float|status|closure|symbol)\s+\*?\s*\w+\s*\(.*\)\s*$/.test(before);

    if (!isControl && !isFuncSig) {
      return null; // not a recognized pattern, leave it alone
    }

    // Split: move brace to new line
    const indent = line.match(/^(\s*)/)?.[1] ?? "";
    const afterContent = afterBrace.trim();
    const lines: string[] = [before, indent + "{"];
    if (afterContent.length > 0) {
      lines.push(indent + "  " + afterContent);
    }
    return lines;
  }
}
