/**
 * Trim trailing whitespace from each line.
 * Preserves the final newline if present.
 */
export function trimTrailingWhitespace(text: string): string {
  const lines = text.split("\n");
  const trimmed = lines.map((line) => line.replace(/\s+$/, ""));
  return trimmed.join("\n");
}
