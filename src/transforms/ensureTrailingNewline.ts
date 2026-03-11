/**
 * Ensure the file ends with exactly one newline.
 *
 * Removes any trailing blank lines and adds a single \n at the end.
 */
export function ensureTrailingNewline(text: string): string {
  return text.replace(/\n+$/, "") + "\n";
}
