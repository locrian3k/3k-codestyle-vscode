/**
 * Wrap long lines that contain string literals by splitting the string
 * using LPC string juxtaposition.
 *
 * Transforms:
 *   write(WRAP("Very long string that exceeds 80 chars...\n"));
 * Into:
 *   write(WRAP(
 *     "Very long string that exceeds "
 *     "80 chars...\n"
 *   ));
 *
 * Only wraps strings that are function call arguments (preceded by ( or ,)
 * and where the suffix is just closing parens/semicolons.
 * Splits at word boundaries. Respects escape sequences.
 */
export function wrapLongStrings(text: string): string {
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

    const wrapped = tryWrapLine(line);
    if (wrapped) {
      result.push(...wrapped);
    } else {
      result.push(line);
    }
  }

  return result.join("\n");
}

function tryWrapLine(line: string): string[] | null {
  const strings = findStringsOnLine(line);
  if (strings.length === 0) { return null; }

  // Try the last string first (usually the long content string)
  for (let si = strings.length - 1; si >= 0; si--) {
    const str = strings[si];
    const prefix = line.substring(0, str.start);
    const suffix = line.substring(str.end + 1);

    // Only wrap if string is a function call argument
    const beforeChar = prefix.trimEnd().slice(-1);
    if (beforeChar !== "(" && beforeChar !== ",") { continue; }

    // Only wrap if suffix is just closing parens/semicolons
    if (!/^[)\s;]*$/.test(suffix.trim())) { continue; }

    const originalIndent = line.match(/^(\s*)/)?.[1] ?? "";
    const wrapIndent = originalIndent + "  ";
    const maxChunkLen = 80 - wrapIndent.length - 2; // 2 for quotes

    if (maxChunkLen < 20) { continue; }
    if (str.content.length <= maxChunkLen) { continue; }

    const chunks = splitStringAtWords(str.content, maxChunkLen);
    if (chunks.length < 2) { continue; }

    const resultLines: string[] = [];
    resultLines.push(prefix.trimEnd());
    for (const chunk of chunks) {
      resultLines.push(wrapIndent + "\"" + chunk + "\"");
    }
    resultLines.push(originalIndent + suffix.trim());

    return resultLines;
  }

  return null;
}

/**
 * Find all string literals on a line, tracking their positions and content.
 * Respects escape sequences and skips comments.
 */
function findStringsOnLine(
  line: string
): { start: number; end: number; content: string }[] {
  const strings: { start: number; end: number; content: string }[] = [];
  let i = 0;

  while (i < line.length) {
    if (line[i] === "/" && line[i + 1] === "/") { break; }
    if (line[i] === "/" && line[i + 1] === "*") { break; }
    if (line[i] === "'") {
      const close = line.indexOf("'", i + 1);
      if (close > i) { i = close + 1; continue; }
    }
    if (line[i] === "\"") {
      const start = i;
      i++;
      while (i < line.length) {
        if (line[i] === "\\") { i += 2; continue; }
        if (line[i] === "\"") { break; }
        i++;
      }
      if (i < line.length) {
        strings.push({
          start,
          end: i,
          content: line.substring(start + 1, i),
        });
      }
      i++;
      continue;
    }
    i++;
  }

  return strings;
}

/**
 * Split string content at word boundaries to fit within maxLen.
 * Trailing space is kept with the first chunk for clean juxtaposition.
 */
function splitStringAtWords(content: string, maxLen: number): string[] {
  if (content.length <= maxLen) { return [content]; }

  const chunks: string[] = [];
  let pos = 0;

  while (pos < content.length) {
    if (content.length - pos <= maxLen) {
      chunks.push(content.substring(pos));
      break;
    }

    // Find the last space within maxLen characters from pos
    let splitAt = -1;
    for (let i = pos + maxLen; i > pos; i--) {
      if (content[i] === " ") {
        splitAt = i + 1; // Include the space in this chunk
        break;
      }
    }

    if (splitAt === -1 || splitAt <= pos) {
      // No space found — force split, avoiding escape sequences
      splitAt = pos + maxLen;
      if (splitAt > 0 && content[splitAt - 1] === "\\") { splitAt--; }
    }

    chunks.push(content.substring(pos, splitAt));
    pos = splitAt;
  }

  return chunks;
}
