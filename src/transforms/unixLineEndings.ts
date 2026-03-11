/**
 * Convert Windows line endings (\r\n) to Unix (\n).
 */
export function convertUnixLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n");
}
