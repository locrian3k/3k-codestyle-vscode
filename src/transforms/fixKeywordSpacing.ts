/**
 * Ensure a space between control flow keywords and their opening paren.
 *
 * Fixes: if(, while(, for(, foreach(, switch(
 * Into:  if (, while (, for (, foreach (, switch (
 *
 * Also normalizes pointer declarations so * is on the name side:
 * Fixes: string* func, int*  x, mapping * arr
 * Into:  string *func, int *x, mapping *arr
 *
 * Respects strings, comments, and char literals.
 */
export function fixKeywordSpacing(text: string): string {
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

    result.push(addKeywordSpaces(line));
  }

  return result.join("\n");
}

const KEYWORDS = ["if", "while", "for", "foreach", "switch"];
const TYPES = [
  "void", "int", "string", "object", "mapping",
  "mixed", "float", "status", "closure", "symbol",
];

function addKeywordSpaces(line: string): string {
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

    // Check for keyword( pattern
    let matched = false;
    for (const kw of KEYWORDS) {
      if (line.slice(i, i + kw.length) === kw && line[i + kw.length] === "(") {
        // Verify word boundary before keyword
        if (i === 0 || !/\w/.test(line[i - 1])) {
          result += kw + " (";
          i += kw.length + 1;
          matched = true;
          break;
        }
      }
    }

    // Check for type* or type * pattern — move * to name side
    if (!matched) {
      for (const tp of TYPES) {
        if (line.slice(i, i + tp.length) === tp
            && (i === 0 || !/\w/.test(line[i - 1]))) {
          let j = i + tp.length;
          // Skip optional spaces between type and *
          while (j < line.length && line[j] === " ") { j++; }
          if (j < line.length && line[j] === "*") {
            j++; // skip *
            // Skip optional spaces after *
            while (j < line.length && line[j] === " ") { j++; }
            // Must be followed by a word char (the name)
            if (j < line.length && /\w/.test(line[j])) {
              result += tp + " *";
              i = j;
              matched = true;
              break;
            }
          }
        }
      }
    }

    if (!matched) {
      result += line[i];
      i++;
    }
  }

  return result;
}
