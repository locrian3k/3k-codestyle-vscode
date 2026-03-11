/**
 * Auto-align = signs in consecutive assignment groups.
 *
 * Detects groups of consecutive lines at the same indent level that are
 * simple assignments (identifier = value) and pads identifiers so all
 * = signs align to the same column.
 *
 * Only aligns groups of 2 or more consecutive assignments.
 * Skips lines inside block comments, line comments, and preprocessor directives.
 */
export function alignAssignments(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let i = 0;
  let inBlockComment = false;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Track block comment state
    if (inBlockComment) {
      result.push(line);
      if (trimmed.includes("*/")) {
        inBlockComment = false;
      }
      i++;
      continue;
    }

    if (trimmed.startsWith("/*")) {
      result.push(line);
      if (!trimmed.includes("*/")) {
        inBlockComment = true;
      }
      i++;
      continue;
    }

    // Skip line comments, preprocessor, empty lines
    if (trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.length === 0) {
      result.push(line);
      i++;
      continue;
    }

    // Try to start an assignment group from this line
    const firstParsed = parseAssignmentLine(line);
    if (!firstParsed) {
      result.push(line);
      i++;
      continue;
    }

    // Collect consecutive assignment lines at the same indent level
    const group: AssignmentInfo[] = [firstParsed];
    let j = i + 1;

    while (j < lines.length) {
      const t = lines[j].trim();
      if (t.length === 0 || t.startsWith("//") || t.startsWith("/*")
          || t.startsWith("#")) {
        break;
      }

      const parsed = parseAssignmentLine(lines[j]);
      if (!parsed || parsed.indent !== firstParsed.indent) {
        break;
      }

      group.push(parsed);
      j++;
    }

    if (group.length >= 2) {
      const maxLen = Math.max(...group.map(g => g.identifier.length));
      for (const g of group) {
        const pad = " ".repeat(maxLen - g.identifier.length);
        result.push(g.indent + g.identifier + pad + " = " + g.value);
      }
      i = j;
    } else {
      result.push(line);
      i++;
    }
  }

  return result.join("\n");
}

interface AssignmentInfo {
  indent: string;
  identifier: string;
  value: string;
}

/** Keywords that should not be treated as assignment targets */
const KEYWORDS = new Set([
  "if", "else", "while", "for", "foreach", "switch", "return",
  "case", "default", "do", "break", "continue", "inherit",
]);

/**
 * Parse a line as a simple assignment: identifier = value
 * Returns null if the line is not a simple assignment.
 * Excludes == (comparison) via negative lookahead.
 */
function parseAssignmentLine(line: string): AssignmentInfo | null {
  const match = line.match(/^(\s*)([a-zA-Z_]\w*)\s*=(?!=)\s*(.*)/);
  if (!match) { return null; }

  if (KEYWORDS.has(match[2])) { return null; }

  return {
    indent: match[1],
    identifier: match[2],
    value: match[3],
  };
}
