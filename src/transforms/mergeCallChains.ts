/**
 * Merge unnecessarily split function call chains.
 *
 * Collapses patterns like:
 *   ansi_write(
 *     to_ansi(
 *     WWRAP(
 * into:
 *   ansi_write(to_ansi(WWRAP(
 *
 * And closing patterns like:
 *   )
 *   )
 *   );
 * into:
 *   )));
 *
 * Only merges when the result stays under 80 characters.
 * Does not touch lines inside strings, comments, or preprocessor directives.
 */
export function mergeCallChains(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Merge opening call chain: consecutive lines where each is just
    // funcname( or MACRO( — join them into one line
    if (isCallOpener(trimmed) && i + 1 < lines.length) {
      let merged = line.trimEnd();
      let j = i + 1;

      // Keep merging while next lines are also call openers
      while (j < lines.length && isCallOpener(lines[j].trim())) {
        merged += lines[j].trim();
        j++;
      }

      // Only use merge if we actually combined multiple lines
      // and the result is reasonable length
      if (j > i + 1 && merged.length <= 80) {
        result.push(merged);
        i = j;
        continue;
      }
    }

    // Merge closing paren chain: consecutive lines where each is just
    // ) or ); or ), — combine them into a single line
    if (isCloseParenOnly(trimmed) && i + 1 < lines.length) {
      let closers = trimmed;
      let j = i + 1;

      while (j < lines.length && isCloseParenOnly(lines[j].trim())) {
        closers = mergeClosers(closers, lines[j].trim());
        j++;
      }

      if (j > i + 1) {
        // Keep the merged closers on their own line with original indent
        const indent = line.match(/^(\s*)/)?.[1] ?? "";
        result.push(indent + closers);
        i = j;
        continue;
      }
    }

    result.push(line);
    i++;
  }

  return result.join("\n");
}

/**
 * Check if a trimmed line is just a function call opening: funcname( or just (
 * Must be ONLY the call opening with no arguments or other content.
 */
function isCallOpener(trimmed: string): boolean {
  if (trimmed.length === 0) {
    return false;
  }
  // Matches: identifier( or MACRO( — a call that opens but doesn't close
  return /^[a-zA-Z_]\w*\s*\($/.test(trimmed);
}

/**
 * Check if a trimmed line is only closing parens, optional semicolon,
 * and optional comma. e.g., ")", ");", "))", ")));", "),", etc.
 */
function isCloseParenOnly(trimmed: string): boolean {
  return /^\)+[;,]?$/.test(trimmed);
}

/**
 * Merge two closer strings. e.g., ")" + ");" = "));"
 */
function mergeClosers(existing: string, addition: string): string {
  // Strip trailing ; or , from existing, add the new parens
  const existClean = existing.replace(/[;,]$/, "");
  return existClean + addition;
}
