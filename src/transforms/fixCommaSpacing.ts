/**
 * Ensure a space after commas in code.
 *
 * Fixes: func(a,b,c)  and  ({1,2,3})
 * Into:  func(a, b, c)  and  ({1, 2, 3})
 *
 * Respects strings, comments, and char literals.
 * Does not add a trailing space if comma is at end of line.
 */
export function fixCommaSpacing(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let inBlockComment = false;

  for (const line of lines) {
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

    if (trimmed.startsWith("//") || trimmed.startsWith("#")) {
      result.push(line);
      continue;
    }

    result.push(addCommaSpaces(line));
  }

  return result.join("\n");
}

function addCommaSpaces(line: string): string {
  let result = "";
  let inStr = false;
  let i = 0;

  while (i < line.length) {
    if (inStr) {
      if (line[i] === "\\") { result += line[i] + (line[i + 1] || ""); i += 2; continue; }
      if (line[i] === "\"") { inStr = false; }
      result += line[i]; i++; continue;
    }

    if (line[i] === "\"") { inStr = true; result += line[i]; i++; continue; }
    if (line[i] === "/" && line[i + 1] === "/") { result += line.slice(i); return result; }
    if (line[i] === "/" && line[i + 1] === "*") { result += line.slice(i); return result; }

    // Skip char literals
    if (line[i] === "'") {
      const close = line.indexOf("'", i + 1);
      if (close > i) {
        result += line.slice(i, close + 1);
        i = close + 1;
        continue;
      }
    }

    // Comma not followed by space — add one
    if (line[i] === ",") {
      result += ",";
      i++;
      if (i < line.length && line[i] !== " " && line[i] !== "\n") {
        result += " ";
      }
      continue;
    }

    result += line[i];
    i++;
  }

  return result;
}
