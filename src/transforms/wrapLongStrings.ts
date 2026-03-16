/**
 * Wrap long lines that contain string literals by splitting the string
 * using LPC string juxtaposition.
 *
 * Transforms:
 *   write(WRAP("Very long string that exceeds 80 chars...\n"));
 * Into:
 *   write(WRAP(
 *     "Very long string that exceeds "
 *     "80 chars...\n"));
 *
 * Also handles strings followed by more arguments:
 *   create_verbal(, name, "Very long message string", "write", "yells", ),
 * Into:
 *   create_verbal(, name,
 *     "Very long message "
 *     "string", "write", "yells", ),
 *
 * Only wraps strings that are function call arguments (preceded by ( or ,).
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

    const originalIndent = line.match(/^(\s*)/)?.[1] ?? "";
    const wrapIndent = originalIndent + "  ";
    const maxChunkLen = 80 - wrapIndent.length - 2; // 2 for quotes

    if (maxChunkLen < 20) { continue; }
    if (str.content.length <= maxChunkLen) { continue; }

    // Calculate max content length for the last chunk (must fit suffix)
    const suffixTrimmed = suffix.trimStart();
    const lastMaxContent = maxChunkLen - suffixTrimmed.length;
    if (lastMaxContent < 10) { continue; }

    const chunks = splitStringAtWords(str.content, maxChunkLen);
    if (chunks.length < 2) { continue; }

    // If last chunk is too long to fit with suffix, re-split it
    if (chunks[chunks.length - 1].length > lastMaxContent) {
      const last = chunks.pop()!;
      let splitAt = -1;
      for (let i = Math.min(lastMaxContent, last.length - 1); i > 0; i--) {
        if (last[i] === " ") {
          splitAt = i + 1;
          break;
        }
      }
      if (splitAt <= 0) {
        chunks.push(last);
        continue; // Can't split to fit suffix
      }
      // Avoid splitting escape sequences
      if (last[splitAt - 1] === "\\") { splitAt--; }
      if (splitAt <= 0) {
        chunks.push(last);
        continue;
      }
      chunks.push(last.substring(0, splitAt));
      chunks.push(last.substring(splitAt));
    }

    // Verify last chunk fits with suffix
    if (chunks[chunks.length - 1].length > lastMaxContent) { continue; }

    const resultLines: string[] = [];
    resultLines.push(prefix.trimEnd());
    for (let i = 0; i < chunks.length - 1; i++) {
      resultLines.push(wrapIndent + "\"" + chunks[i] + "\"");
    }
    // Append suffix to last chunk line
    const lastLine = wrapIndent + "\"" + chunks[chunks.length - 1]
      + "\"" + suffix;
    resultLines.push(lastLine.trimEnd());

    // Verify all lines fit under 80
    if (resultLines.every(l => l.length <= 80)) {
      return resultLines;
    }
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

    // Find the last space within maxLen characters from pos.
    // Start at maxLen - 1 because splitAt = i + 1 (includes the space),
    // so the chunk length is splitAt - pos which must be <= maxLen.
    let splitAt = -1;
    for (let i = pos + maxLen - 1; i > pos; i--) {
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
