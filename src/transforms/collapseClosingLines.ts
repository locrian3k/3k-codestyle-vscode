/**
 * Collapse closing lines to reduce unnecessary vertical stacking.
 *
 * Phase 1: Join consecutive close-dominated lines.
 *   )        becomes   ));
 *   );
 *
 * Phase 2: Join close-comma lines with short trailing args.
 *   )),          becomes   )), ETO);
 *     ETO
 *   );
 *
 *   )),          becomes   )), ENVI(ETO), ETO);
 *     ENVI(ETO),
 *     ETO
 *   );
 *
 * A "close-dominated" line starts with ), }), ]), or :) and is short
 * (under 20 chars trimmed). Trailing args are absorbed only if each
 * is under 20 chars and the total joined line fits within 80 chars.
 *
 * Runs after fixIndentation; the joined line keeps the indent of the
 * first close line in the run.
 */
export function collapseClosingLines(text: string): string {
  let lines = text.split("\n");
  lines = collapseConsecutiveCloses(lines);
  lines = collapseTrailingArgs(lines);
  return lines.join("\n");
}

const MAX_CLOSE_LINE_LENGTH = 20;
const MAX_ARG_LINE_LENGTH = 20;
const MAX_LINE_LENGTH = 80;

/**
 * Phase 1: Join consecutive close-dominated lines into one.
 */
function collapseConsecutiveCloses(lines: string[]): string[] {
  const result: string[] = [];
  let lastWasClose = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (isCloseDominated(trimmed) && result.length > 0 && lastWasClose) {
      const prevLine = result[result.length - 1];
      const prevTrimmed = prevLine.trim();
      const indent = prevLine.match(/^(\s*)/)?.[1] || "";
      result[result.length - 1] = indent + prevTrimmed + trimmed;
      continue;
    }

    lastWasClose = isCloseDominated(trimmed);
    result.push(lines[i]);
  }

  return result;
}

/**
 * Phase 2: When a close-dominated line ends with a comma (more args
 * to come), absorb subsequent short lines until hitting a semicolon.
 * Produces e.g. ")), ETO);" or ")), ENVI(ETO), ETO);".
 */
function collapseTrailingArgs(lines: string[]): string[] {
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Look for close-dominated line ending with comma
    if (isCloseDominated(trimmed) && trimmed.endsWith(",")) {
      const indent = lines[i].match(/^(\s*)/)?.[1] || "";
      let combined = trimmed;
      let j = i + 1;

      // Absorb short following lines
      while (j < lines.length) {
        const nextTrimmed = lines[j].trim();
        if (nextTrimmed.length === 0) break;
        if (nextTrimmed.length > MAX_ARG_LINE_LENGTH) break;

        // Close constructs join directly; other content gets a space
        if (startsWithClose(nextTrimmed)) {
          combined += nextTrimmed;
        } else {
          combined += " " + nextTrimmed;
        }

        j++;

        // Stop after semicolon (end of statement)
        if (nextTrimmed.endsWith(";")) break;
      }

      // Only collapse if we absorbed at least one line AND it fits
      if (j > i + 1 && (indent.length + combined.length) <= MAX_LINE_LENGTH) {
        result.push(indent + combined);
        i = j - 1;
        continue;
      }
    }

    result.push(lines[i]);
  }

  return result;
}

/**
 * Check if a trimmed line starts with a closing construct.
 */
function startsWithClose(trimmed: string): boolean {
  return trimmed.startsWith(")")
    || trimmed.startsWith("})")
    || trimmed.startsWith("])")
    || trimmed.startsWith(":)");
}

/**
 * A line is "close-dominated" if it starts with a closing construct
 * and is short enough to safely join with adjacent close lines.
 */
function isCloseDominated(trimmed: string): boolean {
  if (trimmed.length === 0 || trimmed.length > MAX_CLOSE_LINE_LENGTH) {
    return false;
  }
  return startsWithClose(trimmed);
}
