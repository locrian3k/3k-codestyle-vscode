/**
 * Ensure at least one blank line between top-level function definitions.
 *
 * Detects top-level closing braces (} at column 0 with no leading whitespace)
 * and inserts a blank line if the next non-empty line follows immediately.
 * Does not add a trailing blank line after the last function in the file.
 */
export function blankLineBetweenFunctions(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    result.push(lines[i]);

    const trimmed = lines[i].trim();

    // Top-level closing brace: exactly "}" with no leading whitespace
    if (trimmed === "}" && /^\}/.test(lines[i])) {
      // Find next non-empty line
      let nextNonEmpty = i + 1;
      while (nextNonEmpty < lines.length
             && lines[nextNonEmpty].trim().length === 0) {
        nextNonEmpty++;
      }

      // If there's a next non-empty line and no blank line between, add one
      if (nextNonEmpty < lines.length && nextNonEmpty === i + 1) {
        result.push("");
      }
    }
  }

  return result.join("\n");
}
