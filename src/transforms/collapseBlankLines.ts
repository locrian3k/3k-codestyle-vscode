/**
 * Collapse consecutive blank lines to a maximum of 2.
 *
 * Prevents large whitespace gaps from accumulating during edits.
 * Three or more consecutive blank lines are reduced to two.
 */
export function collapseBlankLines(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let consecutiveBlanks = 0;

  for (const line of lines) {
    if (line.trim().length === 0) {
      consecutiveBlanks++;
      if (consecutiveBlanks <= 2) {
        result.push(line);
      }
    } else {
      consecutiveBlanks = 0;
      result.push(line);
    }
  }

  return result.join("\n");
}
