/**
 * Split single-line LPC array literals that exceed 80 characters.
 *
 * Transforms:
 *   set_alias(({"swamp shadow", "shadow", "beast"}));
 * Into:
 *   set_alias(({
 *       "swamp shadow",
 *       "shadow",
 *       "beast",
 *     }));
 *
 * Only splits when:
 * - The line exceeds 80 characters
 * - A complete ({ ... }) literal exists on the line
 * - The array has more than one element
 *
 * Respects strings, comments, nested literals, and parens.
 */
export function splitLongArrays(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (inBlockComment) {
      if (trimmed.includes("*/")) { inBlockComment = false; }
      result.push(line);
      continue;
    }
    if (trimmed.startsWith("/*")) {
      if (!trimmed.includes("*/")) { inBlockComment = true; }
      result.push(line);
      continue;
    }

    if (line.length <= 80 || trimmed.startsWith("//") || trimmed.startsWith("#")) {
      result.push(line);
      continue;
    }

    const split = trySplitArrayLine(line);
    if (split) {
      result.push(...split);
    } else {
      result.push(line);
    }
  }

  return result.join("\n");
}

/**
 * Try to split a long line containing a single-line array literal.
 * Returns the split lines, or null if no split is possible.
 */
function trySplitArrayLine(line: string): string[] | null {
  const arraySpan = findArrayLiteral(line);
  if (!arraySpan) { return null; }

  const { openIdx, closeIdx } = arraySpan;

  // Extract the content between ({ and })
  const content = line.substring(openIdx + 2, closeIdx).trim();
  if (content.length === 0) { return null; }

  // Parse elements
  const elements = parseElements(content);
  if (elements.length < 2) { return null; }

  // Build the split output
  const originalIndent = line.match(/^(\s*)/)?.[1] ?? "";
  const prefix = line.substring(0, openIdx + 2); // everything through ({
  const suffix = line.substring(closeIdx + 2);   // everything after })
  const elemIndent = originalIndent + "    ";     // +4 for element lines
  const closeIndent = originalIndent + "  ";      // +2 for }) line

  const resultLines: string[] = [];
  resultLines.push(prefix.trimEnd());

  for (let i = 0; i < elements.length; i++) {
    const elem = elements[i].trim();
    // Add trailing comma if missing
    const needsComma = !elem.endsWith(",");
    resultLines.push(elemIndent + elem + (needsComma ? "," : ""));
  }

  resultLines.push(closeIndent + "})" + suffix.trimStart());

  return resultLines;
}

/**
 * Find a complete ({ ... }) array literal on a single line.
 * Returns the indices of ({ and }), or null.
 * Scans character-by-character, respecting strings and comments.
 */
function findArrayLiteral(
  line: string
): { openIdx: number; closeIdx: number } | null {
  let inStr = false;
  let depth = 0;
  let openIdx = -1;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = i + 1 < line.length ? line[i + 1] : "";

    if (inStr) {
      if (ch === "\\") { i++; continue; }
      if (ch === "\"") { inStr = false; }
      continue;
    }

    if (ch === "\"") { inStr = true; continue; }
    if (ch === "/" && next === "/") { break; }
    if (ch === "/" && next === "*") { break; }
    if (ch === "'") {
      const close = line.indexOf("'", i + 1);
      if (close > i) { i = close; }
      continue;
    }

    // LPC array literal opener
    if (ch === "(" && next === "{") {
      depth++;
      if (depth === 1) { openIdx = i; }
      i++; // skip {
      continue;
    }

    // LPC array literal closer
    if (ch === "}" && next === ")") {
      depth--;
      if (depth === 0 && openIdx >= 0) {
        return { openIdx, closeIdx: i };
      }
      i++; // skip )
      continue;
    }
  }

  return null;
}

/**
 * Parse array elements from the content between ({ and }).
 * Splits at commas at depth 0, respecting strings, parens, and nested literals.
 */
function parseElements(content: string): string[] {
  const elements: string[] = [];
  let current = "";
  let inStr = false;
  let parenDepth = 0;
  let litDepth = 0;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const next = i + 1 < content.length ? content[i + 1] : "";

    if (inStr) {
      if (ch === "\\") { current += ch + next; i++; continue; }
      if (ch === "\"") { inStr = false; }
      current += ch;
      continue;
    }

    if (ch === "\"") { inStr = true; current += ch; continue; }
    if (ch === "'") {
      const close = content.indexOf("'", i + 1);
      if (close > i) {
        current += content.substring(i, close + 1);
        i = close;
        continue;
      }
    }

    // Nested literal openers
    // Guard against (:: which is paren + scope-resolution, not (: closure
    if (ch === "(" && (next === "{" || next === "[" ||
        (next === ":" && (i + 2 >= content.length || content[i + 2] !== ":")))) {
      litDepth++;
      current += ch + next;
      i++;
      continue;
    }
    // Nested literal closers
    if ((ch === "}" || ch === "]" || ch === ":") && next === ")") {
      litDepth--;
      current += ch + next;
      i++;
      continue;
    }

    if (ch === "(") { parenDepth++; current += ch; continue; }
    if (ch === ")") { parenDepth--; current += ch; continue; }

    // Split at commas only at top level
    if (ch === "," && parenDepth === 0 && litDepth === 0) {
      elements.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  // Don't forget the last element
  const last = current.trim();
  if (last.length > 0) {
    elements.push(last);
  }

  return elements;
}
