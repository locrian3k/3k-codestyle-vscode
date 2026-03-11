/**
 * Convert all tab characters to 2 spaces.
 */
export function convertTabsToSpaces(text: string): string {
  return text.replace(/\t/g, "  ");
}
