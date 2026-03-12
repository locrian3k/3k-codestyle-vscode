/**
 * Collapse multi-line LPC array literals that would fit on a single line
 * (under 80 characters). Long arrays that can't fit are left as-is.
 *
 * Handles two patterns:
 *
 * Pattern A — ({  at end of a line:
 *   set_alias(({
 *       "ring",
 *       "ring of spite",
 *     }));
 *
 * Pattern B — ({  on its own line after prefix:
 *   set_alias(
 *     ({
 *       "ring",
 *       "ring of spite",
 *     }));
 *
 * Both become:
 *   set_alias(({"ring", "ring of spite"}));
 */
export function collapseShortArrays(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let inBlockComment = false;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Track block comments
    if (inBlockComment) {
      if (trimmed.includes("*/")) { inBlockComment = false; }
      result.push(line);
      i++;
      continue;
    }
    if (trimmed.startsWith("/*")) {
      if (!trimmed.includes("*/")) { inBlockComment = true; }
      result.push(line);
      i++;
      continue;
    }

    // Skip preprocessor and line comments
    if (trimmed.startsWith("//") || trimmed.startsWith("#")) {
      result.push(line);
      i++;
      continue;
    }

    // Look for ({  on this line where }) is NOT on the same line
    const openInfo = findArrayOpen(line);
    if (openInfo && !hasMatchingCloseOnSameLine(line, openInfo.openIdx)) {
      // Check if ({ has elements on the same line (skip those)
      const afterOpen = line.substring(openInfo.openIdx + 2).trim();
      if (afterOpen.length > 0 && !afterOpen.startsWith("//")) {
        result.push(line);
        i++;
        continue;
      }

      // Scan forward for matching })
      const closeInfo = findMatchingClose(lines, i, openInfo.openIdx);
      if (closeInfo) {
        const collapsed = tryCollapse(lines, i, openInfo, closeInfo, result);
        if (collapsed) {
          // collapsed.replacedLines tells us how many source lines were consumed
          // collapsed.outputLines are what we emit
          for (const cl of collapsed.outputLines) {
            result.push(cl);
          }
          i += collapsed.replacedLines;
          continue;
        }
      }
    }

    result.push(line);
    i++;
  }

  return result.join("\n");
}

/**
 * Find ({  on a line, outside of strings and comments.
 * Returns the index of the ( in ({ or null.
 */
function findArrayOpen(
  line: string
): { openIdx: number } | null {
  let inStr = false;

  for (let j = 0; j < line.length; j++) {
    const ch = line[j];
    const next = j + 1 < line.length ? line[j + 1] : "";

    if (inStr) {
      if (ch === "\\") { j++; continue; }
      if (ch === "\"") { inStr = false; }
      continue;
    }

    if (ch === "\"") { inStr = true; continue; }
    if (ch === "/" && next === "/") { break; }
    if (ch === "/" && next === "*") { break; }
    if (ch === "'") {
      const close = line.indexOf("'", j + 1);
      if (close > j) { j = close; }
      continue;
    }

    if (ch === "(" && next === "{") {
      return { openIdx: j };
    }
  }

  return null;
}

/**
 * Check if the line has a matching }) for the ({ at openIdx.
 */
function hasMatchingCloseOnSameLine(
  line: string,
  openIdx: number
): boolean {
  let inStr = false;
  let depth = 0;

  for (let j = openIdx; j < line.length; j++) {
    const ch = line[j];
    const next = j + 1 < line.length ? line[j + 1] : "";

    if (inStr) {
      if (ch === "\\") { j++; continue; }
      if (ch === "\"") { inStr = false; }
      continue;
    }

    if (ch === "\"") { inStr = true; continue; }
    if (ch === "/" && next === "/") { break; }

    if (ch === "(" && next === "{") { depth++; j++; continue; }
    if (ch === "}" && next === ")") {
      depth--;
      if (depth === 0) { return true; }
      j++;
      continue;
    }
  }

  return false;
}

/**
 * Scan forward from the ({ line to find the matching }) line.
 * Returns the line index and column of }) , or null.
 */
function findMatchingClose(
  lines: string[],
  startLine: number,
  openIdx: number
): { closeLine: number; closeIdx: number } | null {
  let depth = 0;
  let inStr = false;
  const maxSearch = Math.min(startLine + 30, lines.length);

  for (let l = startLine; l < maxSearch; l++) {
    const line = lines[l];
    const startCol = (l === startLine) ? openIdx : 0;

    for (let j = startCol; j < line.length; j++) {
      const ch = line[j];
      const next = j + 1 < line.length ? line[j + 1] : "";

      if (inStr) {
        if (ch === "\\") { j++; continue; }
        if (ch === "\"") { inStr = false; }
        continue;
      }

      if (ch === "\"") { inStr = true; continue; }
      if (ch === "/" && next === "/") { break; }
      if (ch === "'") {
        const close = line.indexOf("'", j + 1);
        if (close > j) { j = close; }
        continue;
      }

      if (ch === "(" && next === "{") { depth++; j++; continue; }
      if (ch === "}" && next === ")") {
        depth--;
        if (depth === 0) {
          return { closeLine: l, closeIdx: j };
        }
        j++;
        continue;
      }
    }
  }

  return null;
}

/**
 * Try to collapse the multi-line array into a single line.
 * Returns the output lines and how many source lines were consumed,
 * or null if collapse is not possible (over 80 chars).
 */
function tryCollapse(
  lines: string[],
  openLine: number,
  openInfo: { openIdx: number },
  closeInfo: { closeLine: number; closeIdx: number },
  resultSoFar: string[]
): { outputLines: string[]; replacedLines: number } | null {
  const { openIdx } = openInfo;
  const { closeLine, closeIdx } = closeInfo;

  // Get prefix: text before ({ on the opening line
  let prefix = lines[openLine].substring(0, openIdx);
  let absorbedPrevLine = false;

  // If ({ is alone on its line (prefix is whitespace), look at previous line
  if (prefix.trim().length === 0 && resultSoFar.length > 0) {
    const prevLine = resultSoFar[resultSoFar.length - 1];
    const prevTrimmed = prevLine.trimEnd();
    // Absorb if previous line ends with ( or , (continuation)
    if (prevTrimmed.endsWith("(") || prevTrimmed.endsWith(",")) {
      prefix = prevTrimmed;
      absorbedPrevLine = true;
    }
  }

  // Get suffix: text after }) on the closing line
  const suffix = lines[closeLine].substring(closeIdx + 2);

  // Collect element lines (between opening and closing)
  const elementLines: string[] = [];
  const firstElemLine = openLine + 1;
  for (let l = firstElemLine; l < closeLine; l++) {
    const trimmed = lines[l].trim();
    if (trimmed.length > 0) {
      elementLines.push(trimmed);
    }
  }

  // Also check if }) line has content before it (an element on the close line)
  const beforeClose = lines[closeLine].substring(0, closeIdx).trim();
  if (beforeClose.length > 0) {
    elementLines.push(beforeClose);
  }

  if (elementLines.length === 0) { return null; }

  // Parse elements: strip trailing commas, combine
  const elements: string[] = [];
  for (const el of elementLines) {
    // Remove trailing comma
    const cleaned = el.endsWith(",") ? el.slice(0, -1).trimEnd() : el;
    if (cleaned.length > 0) {
      elements.push(cleaned);
    }
  }

  if (elements.length === 0) { return null; }

  // Build the collapsed line
  const collapsed = prefix + "({" + elements.join(", ") + "})" +
    suffix.trimStart();

  // Determine how many lines to replace
  const linesConsumed = closeLine - openLine + 1;

  // Check if it fits on a single line
  if (collapsed.length <= 80) {
    if (absorbedPrevLine) {
      resultSoFar.pop();
    }
    return {
      outputLines: [collapsed],
      replacedLines: linesConsumed,
    };
  }

  // --- Reflow: group elements onto fewer lines under 80 chars ---
  // Determine indent for element lines (base indent + 2)
  const prefixIndent = prefix.match(/^(\s*)/)?.[1] ?? "";
  const elemIndent = prefixIndent + "  ";
  const closeIndent = prefixIndent;

  // Build grouped element lines
  const groupedLines: string[] = [];
  let currentLine = elemIndent;

  for (let ei = 0; ei < elements.length; ei++) {
    const elem = elements[ei];
    const separator = ei < elements.length - 1 ? ", " : ",";
    const candidate = currentLine + elem + separator;

    if (currentLine === elemIndent) {
      // First element on this line — always add it
      currentLine = candidate;
    }
    else if (candidate.length <= 80) {
      // Fits on current line
      currentLine = candidate;
    }
    else {
      // Doesn't fit — flush current line and start a new one
      groupedLines.push(currentLine);
      currentLine = elemIndent + elem + separator;
    }
  }
  if (currentLine.trim().length > 0) {
    groupedLines.push(currentLine);
  }

  // Only reflow if we actually reduced the line count
  if (groupedLines.length >= elements.length) { return null; }

  // Build the output: prefix with ({, grouped elements, close with })
  const openLineText = prefix.trimEnd().length > 0
    ? prefix.trimEnd() + "({"
    : prefixIndent + "({";
  const closeLineText = closeIndent + "})" + suffix.trimStart();

  const outputLines: string[] = [openLineText];
  for (const gl of groupedLines) {
    outputLines.push(gl);
  }
  outputLines.push(closeLineText);

  if (absorbedPrevLine) {
    resultSoFar.pop();
  }

  return {
    outputLines,
    replacedLines: linesConsumed,
  };
}
