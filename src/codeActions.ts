import * as vscode from "vscode";

interface BreakResult {
  label: string;
  replacement: string;
}

export class LpcCodeActionProvider implements vscode.CodeActionProvider {
  static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range,
    context: vscode.CodeActionContext,
    _token: vscode.CancellationToken
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== "3k-codestyle") {
        continue;
      }

      switch (diagnostic.code) {
        case "pragma-strong-types":
          actions.push(this.createAddPragmaAction(document, diagnostic));
          break;
        case "include-defs-h":
          actions.push(this.createAddIncludeAction(document, diagnostic));
          break;
        case "no-tabs":
          actions.push(this.createConvertTabAction(document, diagnostic));
          break;
        case "void-return-missing":
          actions.push(this.createAddReturnAction(document, diagnostic));
          break;
        case "allman-brackets":
          actions.push(this.createAllmanFixAction(document, diagnostic));
          break;
        case "unwrapped-string":
          actions.push(this.createWordWrapAction(document, diagnostic));
          break;
        case "closure-quote-fix":
          actions.push(this.createClosureQuoteAction(document, diagnostic));
          break;
        case "line-length": {
          const breakAction = this.createLineLengthBreakAction(
            document, diagnostic
          );
          if (breakAction) {
            actions.push(breakAction);
          }
          break;
        }
      }
    }

    return actions;
  }

  private createAddPragmaAction(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      "Add #pragma strong_types",
      vscode.CodeActionKind.QuickFix
    );
    action.edit = new vscode.WorkspaceEdit();

    // Insert at the diagnostic line (first non-comment line) rather than line 0,
    // so file header comments are preserved above the pragma.
    const insertLine = diagnostic.range.start.line;
    action.edit.insert(
      document.uri,
      new vscode.Position(insertLine, 0),
      "#pragma strong_types\n"
    );
    action.diagnostics = [diagnostic];
    action.isPreferred = true;
    return action;
  }

  private createAddIncludeAction(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      'Add #include "defs.h"',
      vscode.CodeActionKind.QuickFix
    );
    action.edit = new vscode.WorkspaceEdit();

    // Insert after #pragma strong_types if it exists, otherwise at top
    let insertLine = 0;
    for (let i = 0; i < document.lineCount; i++) {
      if (document.lineAt(i).text.trim() === "#pragma strong_types") {
        insertLine = i + 1;
        break;
      }
    }

    action.edit.insert(
      document.uri,
      new vscode.Position(insertLine, 0),
      '#include "defs.h"\n'
    );
    action.diagnostics = [diagnostic];
    action.isPreferred = true;
    return action;
  }

  private createConvertTabAction(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      "Convert tab to spaces",
      vscode.CodeActionKind.QuickFix
    );
    action.edit = new vscode.WorkspaceEdit();
    action.edit.replace(
      document.uri,
      diagnostic.range,
      "  "
    );
    action.diagnostics = [diagnostic];
    action.isPreferred = true;
    return action;
  }

  private createAddReturnAction(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      "Add missing return;",
      vscode.CodeActionKind.QuickFix
    );
    action.edit = new vscode.WorkspaceEdit();

    // Insert return; before the closing brace
    const closeBraceLine = diagnostic.range.start.line;
    const indent = document.lineAt(closeBraceLine).text.match(/^(\s*)/)?.[1] ?? "";
    action.edit.insert(
      document.uri,
      new vscode.Position(closeBraceLine, 0),
      indent + "  return;\n"
    );
    action.diagnostics = [diagnostic];
    action.isPreferred = true;
    return action;
  }

  private createAllmanFixAction(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      "Move brace to new line (Allman style)",
      vscode.CodeActionKind.QuickFix
    );
    action.edit = new vscode.WorkspaceEdit();

    const line = document.lineAt(diagnostic.range.start.line);
    const text = line.text;
    const braceIdx = text.lastIndexOf("{");
    if (braceIdx >= 0) {
      // Get the text before the brace, trimmed
      const before = text.substring(0, braceIdx).trimEnd();
      // Get indentation of the line
      const indent = text.match(/^(\s*)/)?.[1] ?? "";
      // Everything after the brace on the same line
      const after = text.substring(braceIdx + 1);

      let replacement = before + "\n" + indent + "{";
      if (after.trim().length > 0) {
        replacement += "\n" + indent + "  " + after.trimStart();
      }

      action.edit.replace(
        document.uri,
        line.range,
        replacement
      );
    }

    action.diagnostics = [diagnostic];
    action.isPreferred = true;
    return action;
  }

  /**
   * Wrap the string argument of a single-target output function in
   * word_wrap(). Handles both 1-arg (write) and 2-arg (tell_object)
   * forms by finding the correct argument position.
   */
  private createWordWrapAction(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      "Wrap string in word_wrap()",
      vscode.CodeActionKind.QuickFix
    );
    action.edit = new vscode.WorkspaceEdit();

    const lineNum = diagnostic.range.start.line;
    const line = document.lineAt(lineNum).text;

    // The diagnostic range covers "funcName(" — extract the function name
    const diagText = line.substring(
      diagnostic.range.start.character,
      diagnostic.range.end.character
    );
    const funcName = diagText.replace(/\s*\($/, "");

    // Functions where the message is the 2nd argument (after target)
    const twoArgFunctions = ["tell_object", "ansi_tell_object"];
    const needsSkipFirstArg = twoArgFunctions.includes(funcName);

    // Find the opening paren of the call
    const callStart = diagnostic.range.start.character;
    let parenIdx = line.indexOf("(", callStart + funcName.length);
    if (parenIdx === -1) {
      action.diagnostics = [diagnostic];
      return action;
    }

    // Scan from the opening paren to find the insertion point and
    // the closing paren, spanning multiple lines if needed
    const result = this.findWrapInsertPoints(
      document, lineNum, parenIdx, needsSkipFirstArg
    );

    if (result) {
      // Insert "word_wrap(" at the argument start
      action.edit.insert(
        document.uri,
        result.insertStart,
        "word_wrap("
      );
      // Insert ")" before the closing paren
      action.edit.insert(
        document.uri,
        result.insertEnd,
        ")"
      );
    }

    action.diagnostics = [diagnostic];
    action.isPreferred = true;
    return action;
  }

  /**
   * Find the positions to insert "word_wrap(" and ")" around the
   * string argument of an output function call.
   */
  private findWrapInsertPoints(
    document: vscode.TextDocument,
    startLine: number,
    parenCol: number,
    skipFirstArg: boolean
  ): { insertStart: vscode.Position; insertEnd: vscode.Position } | null {
    let depth = 0;
    let foundComma = !skipFirstArg; // If no skip needed, start ready
    let insertStart: vscode.Position | null = null;
    const maxLines = Math.min(startLine + 20, document.lineCount);

    for (let l = startLine; l < maxLines; l++) {
      const lineText = document.lineAt(l).text;
      const startCol = (l === startLine) ? parenCol : 0;

      for (let i = startCol; i < lineText.length; i++) {
        const ch = lineText[i];

        // Skip strings
        if (ch === "\"") {
          i++;
          while (i < lineText.length) {
            if (lineText[i] === "\\") { i++; }
            else if (lineText[i] === "\"") { break; }
            i++;
          }
          continue;
        }

        // Skip line comments
        if (ch === "/" && i + 1 < lineText.length && lineText[i + 1] === "/") {
          break;
        }

        if (ch === "(") {
          depth++;
          continue;
        }

        if (ch === ")") {
          depth--;
          if (depth === 0) {
            // Found the closing paren — insert ")" just before it
            if (insertStart) {
              return {
                insertStart,
                insertEnd: new vscode.Position(l, i),
              };
            }
            return null;
          }
          continue;
        }

        // At depth 1, look for comma to skip first arg
        if (depth === 1 && !foundComma && ch === ",") {
          foundComma = true;
          continue;
        }

        // At depth 1, after the comma (or immediately for 1-arg),
        // find the start of the string argument (first non-space)
        if (depth === 1 && foundComma && !insertStart) {
          if (ch !== " " && ch !== "\t" && ch !== "\n" && ch !== "\r") {
            insertStart = new vscode.Position(l, i);
          }
        }
      }
    }

    return null;
  }

  // ==========================================================================
  // Line-length quick-fix: suggest where to break long lines
  // ==========================================================================

  /**
   * Try to break a long line at a sensible point. Strategies tried in order:
   * 1. After assignment operator (=, +=, -=, etc.)
   * 2. After return keyword
   * 3. Before a binary operator (lowest precedence first)
   * 4. After a comma (function arguments)
   */
  private createLineLengthBreakAction(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
  ): vscode.CodeAction | null {
    const lineNum = diagnostic.range.start.line;
    const line = document.lineAt(lineNum).text;
    const maxLen = diagnostic.range.start.character;

    // Skip preprocessor directives, comments
    const trimmed = line.trim();
    if (trimmed.startsWith("#")
      || trimmed.startsWith("//")
      || trimmed.startsWith("/*"))
    {
      return null;
    }

    const baseIndent = line.match(/^(\s*)/)?.[1] ?? "";
    const contIndent = baseIndent + "  ";

    const breakResult =
      this.tryBreakAfterAssignment(line, contIndent, maxLen)
      ?? this.tryBreakAfterReturn(line, contIndent, maxLen)
      ?? this.tryBreakAtOperator(line, contIndent, maxLen)
      ?? this.tryBreakAtComma(line, contIndent, maxLen)
      ?? this.tryBreakString(line, contIndent, maxLen);

    if (!breakResult) {
      return null;
    }

    const action = new vscode.CodeAction(
      breakResult.label,
      vscode.CodeActionKind.QuickFix
    );
    action.edit = new vscode.WorkspaceEdit();
    action.edit.replace(
      document.uri,
      document.lineAt(lineNum).range,
      breakResult.replacement
    );
    action.diagnostics = [diagnostic];
    action.isPreferred = true;
    return action;
  }

  // --- Strategy 1: Break after assignment operator ---

  private tryBreakAfterAssignment(
    line: string,
    contIndent: string,
    maxLen: number
  ): BreakResult | null {
    const assignIdx = this.findAssignmentOperator(line);
    if (assignIdx === null) { return null; }

    // Break after the '=' — skip trailing spaces
    let opEnd = assignIdx + 1;
    while (opEnd < line.length && line[opEnd] === " ") { opEnd++; }

    const firstLine = line.substring(0, opEnd).trimEnd();
    const secondLine = contIndent + line.substring(opEnd).trimStart();

    if (secondLine.length > maxLen) { return null; }

    return {
      label: "Break line after assignment",
      replacement: firstLine + "\n" + secondLine,
    };
  }

  /**
   * Find the position of an assignment '=' at paren depth 0.
   * Recognizes =, +=, -=, *=, /=, %=.
   * Skips ==, !=, <=, >=.
   */
  private findAssignmentOperator(line: string): number | null {
    let inStr = false;
    let parenDepth = 0;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      const prev = i > 0 ? line[i - 1] : "";
      const next = i + 1 < line.length ? line[i + 1] : "";

      if (inStr) {
        if (ch === "\\") { i++; continue; }
        if (ch === "\"") { inStr = false; }
        continue;
      }
      if (ch === "\"") { inStr = true; continue; }
      if (ch === "/" && next === "/") { break; }
      if (ch === "/" && next === "*") { break; }

      if (ch === "(") { parenDepth++; continue; }
      if (ch === ")") { parenDepth--; continue; }

      if (ch === "=" && parenDepth === 0) {
        if (next === "=") { i++; continue; } // ==
        if (prev === "!" || prev === "<" || prev === ">") { continue; }
        return i;
      }
    }
    return null;
  }

  // --- Strategy 2: Break after return keyword ---

  private tryBreakAfterReturn(
    line: string,
    contIndent: string,
    maxLen: number
  ): BreakResult | null {
    const trimmed = line.trimStart();
    if (!trimmed.startsWith("return ")) { return null; }

    const returnIdx = line.indexOf("return ");
    const breakPos = returnIdx + 7;

    const firstLine = line.substring(0, breakPos).trimEnd();
    const secondLine = contIndent + line.substring(breakPos).trimStart();

    if (secondLine.length > maxLen) { return null; }

    return {
      label: "Break line after return",
      replacement: firstLine + "\n" + secondLine,
    };
  }

  // --- Strategy 3: Break before binary operator ---

  private tryBreakAtOperator(
    line: string,
    contIndent: string,
    maxLen: number
  ): BreakResult | null {
    let candidates = this.findOperatorBreakPoints(line);
    // If no operators at base depth, try one level deeper (inside a
    // function call like REPORT("..." + var + "..."))
    if (candidates.length === 0) {
      candidates = this.findOperatorBreakPoints(line, 1);
    }
    if (candidates.length === 0) { return null; }

    // Sort by precedence ascending (lowest = best break), then position
    candidates.sort((a, b) => a.precedence - b.precedence || a.pos - b.pos);

    for (const candidate of candidates) {
      const firstLine = line.substring(0, candidate.pos).trimEnd();
      const secondLine = contIndent
        + line.substring(candidate.pos).trimStart();

      if (firstLine.length <= maxLen && secondLine.length <= maxLen) {
        return {
          label: "Break line before operator",
          replacement: firstLine + "\n" + secondLine,
        };
      }
    }

    return null;
  }

  /**
   * Find binary operators that could serve as break points.
   * Determines the "base" paren depth of the expression:
   *   - if/while/for/switch: depth 1 (expression inside parens)
   *   - assignments/return/other: depth 0
   * Only considers operators at that base depth (+ depthOffset).
   *
   * depthOffset allows searching deeper (e.g., +1 to find operators
   * inside a function call argument like REPORT("..." + var)).
   *
   * Precedence (lower = break here first):
   *   1: ||  2: &&  3: |  4: ^  5: &  6: +/-  7: * / %
   */
  private findOperatorBreakPoints(
    line: string,
    depthOffset: number = 0
  ): { pos: number; precedence: number }[] {
    const candidates: { pos: number; precedence: number }[] = [];
    let inStr = false;
    let parenDepth = 0;
    const codeStart = line.search(/\S/);

    // Determine base depth: control-flow keywords wrap expression
    // in parens, so operators are at depth 1
    const trimmed = line.trim();
    const baseDepth = (/^(if|else\s+if|while|for|switch)\s*\(/.test(trimmed)
      ? 1 : 0) + depthOffset;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      const next = i + 1 < line.length ? line[i + 1] : "";
      const prev = i > 0 ? line[i - 1] : "";

      if (inStr) {
        if (ch === "\\") { i++; continue; }
        if (ch === "\"") { inStr = false; }
        continue;
      }
      if (ch === "\"") { inStr = true; continue; }
      if (ch === "/" && next === "/") { break; }
      if (ch === "/" && next === "*") { break; }

      // Skip char literals
      if (ch === "'" && !inStr) {
        const close = line.indexOf("'", i + 1);
        if (close > i) { i = close; continue; }
      }

      if (ch === "(") { parenDepth++; continue; }
      if (ch === ")") { parenDepth--; continue; }
      if (parenDepth !== baseDepth) { continue; }

      // Skip leading indent
      if (i <= codeStart) { continue; }

      // Skip -> arrow (not subtraction)
      if (ch === "-" && next === ">") { i++; continue; }

      // || logical or
      if (ch === "|" && next === "|") {
        candidates.push({ pos: i, precedence: 1 });
        i++; continue;
      }
      // && logical and
      if (ch === "&" && next === "&") {
        candidates.push({ pos: i, precedence: 2 });
        i++; continue;
      }
      // | bitwise or (not ||)
      if (ch === "|" && next !== "|" && prev !== "|") {
        candidates.push({ pos: i, precedence: 3 });
        continue;
      }
      // ^ bitwise xor
      if (ch === "^") {
        candidates.push({ pos: i, precedence: 4 });
        continue;
      }
      // & bitwise and (not &&)
      if (ch === "&" && next !== "&" && prev !== "&") {
        candidates.push({ pos: i, precedence: 5 });
        continue;
      }
      // Find preceding non-space character for binary vs unary check
      let prevNS = "";
      for (let j = i - 1; j >= 0; j--) {
        if (line[j] !== " " && line[j] !== "\t") {
          prevNS = line[j]; break;
        }
      }

      // + - binary (not unary, not +=/-=, not ->)
      if ((ch === "+" || ch === "-") && next !== "=") {
        if (/[\w)\]]/.test(prevNS)) {
          candidates.push({ pos: i, precedence: 6 });
          continue;
        }
      }
      // * / % (not *=, /=, %=, not /*, not ->)
      if ((ch === "*" || ch === "/" || ch === "%") && next !== "=") {
        if (ch === "/" && next === "*") { continue; }
        if (ch === "*" && prev === "/") { continue; }
        if (/[\w)\]]/.test(prevNS)) {
          candidates.push({ pos: i, precedence: 7 });
          continue;
        }
      }
    }

    return candidates;
  }

  // --- Strategy 4: Break after comma ---

  private tryBreakAtComma(
    line: string,
    contIndent: string,
    maxLen: number
  ): BreakResult | null {
    const commaPositions = this.findCommaBreakPoints(line);
    if (commaPositions.length === 0) { return null; }

    // Try rightmost comma first (balances line lengths better)
    for (let ci = commaPositions.length - 1; ci >= 0; ci--) {
      const pos = commaPositions[ci];
      const firstLine = line.substring(0, pos + 1).trimEnd();
      const secondLine = contIndent + line.substring(pos + 1).trimStart();

      if (firstLine.length <= maxLen && secondLine.length <= maxLen) {
        return {
          label: "Break line after comma",
          replacement: firstLine + "\n" + secondLine,
        };
      }
    }

    return null;
  }

  /**
   * Find commas at paren depth 1 (function arguments) that could
   * serve as line break points.
   */
  private findCommaBreakPoints(line: string): number[] {
    const positions: number[] = [];
    let inStr = false;
    let parenDepth = 0;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      const next = i + 1 < line.length ? line[i + 1] : "";

      if (inStr) {
        if (ch === "\\") { i++; continue; }
        if (ch === "\"") { inStr = false; }
        continue;
      }
      if (ch === "\"") { inStr = true; continue; }
      if (ch === "/" && next === "/") { break; }
      if (ch === "/" && next === "*") { break; }

      // Skip char literals
      if (ch === "'" && !inStr) {
        const close = line.indexOf("'", i + 1);
        if (close > i) { i = close; continue; }
      }

      if (ch === "(") { parenDepth++; continue; }
      if (ch === ")") { parenDepth--; continue; }

      if (ch === "," && parenDepth === 1) {
        positions.push(i);
      }
    }

    return positions;
  }

  // --- Strategy 5: Split a long string using juxtaposition ---

  /**
   * Find the longest string on the line and offer to split it at a word
   * boundary using LPC string juxtaposition ("first part " "second part").
   * This is the last resort when no other break strategy works.
   */
  private tryBreakString(
    line: string,
    contIndent: string,
    maxLen: number
  ): BreakResult | null {
    const strings = this.findStringsOnLine(line);
    if (strings.length === 0) { return null; }

    // Sort by content length descending — try longest string first
    strings.sort((a, b) => b.content.length - a.content.length);

    for (const str of strings) {
      // Only split strings that are reasonably long
      if (str.content.length < 20) { continue; }

      const beforeStr = line.substring(0, str.start); // text before "
      const afterStr = line.substring(str.end + 1);   // text after "

      // Max content length for first part
      const firstMaxContent = maxLen - beforeStr.length - 2; // 2 for quotes
      // Max content length for second part (must fit suffix)
      const secondMaxContent = maxLen - contIndent.length - 2
        - afterStr.trimStart().length;

      if (firstMaxContent < 10 || secondMaxContent < 5) { continue; }

      // Find a split point at a word boundary
      let splitAt = -1;
      const target = Math.min(firstMaxContent, str.content.length - 5);
      for (let i = target; i > 5; i--) {
        if (str.content[i] === " ") {
          splitAt = i + 1; // Include the space in the first part
          break;
        }
      }

      if (splitAt <= 0) { continue; }

      // Avoid splitting escape sequences
      if (str.content[splitAt - 1] === "\\") { splitAt--; }
      if (splitAt <= 0) { continue; }

      const firstPart = str.content.substring(0, splitAt);
      const secondPart = str.content.substring(splitAt);

      // Verify second part fits
      if (secondPart.length > secondMaxContent) { continue; }

      const firstLine = beforeStr + "\"" + firstPart + "\"";
      const secondLine = contIndent + "\"" + secondPart + "\""
        + afterStr;

      if (firstLine.length <= maxLen && secondLine.length <= maxLen) {
        return {
          label: "Split string across lines",
          replacement: firstLine + "\n" + secondLine,
        };
      }
    }

    return null;
  }

  /**
   * Find all string literals on a line, tracking their positions and
   * content. Respects escape sequences and skips comments.
   */
  private findStringsOnLine(
    line: string
  ): { start: number; end: number; content: string }[] {
    const strings: { start: number; end: number; content: string }[] = [];
    let i = 0;

    while (i < line.length) {
      if (line[i] === "/" && line[i + 1] === "/") { break; }
      if (line[i] === "/" && line[i + 1] === "*") { break; }
      if (line[i] === "'") {
        const close = line.indexOf("'", i + 1);
        if (close > i) { i = close + 1; continue; }
      }
      if (line[i] === "\"") {
        const start = i;
        i++;
        while (i < line.length) {
          if (line[i] === "\\") { i += 2; continue; }
          if (line[i] === "\"") { break; }
          i++;
        }
        if (i < line.length) {
          strings.push({
            start,
            end: i,
            content: line.substring(start + 1, i),
          });
        }
        i++;
        continue;
      }
      i++;
    }

    return strings;
  }

  // --- Closure quote fix: add /*'*/ after #'function ---

  private createClosureQuoteAction(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      "Add /*'*/ to close unmatched quote",
      vscode.CodeActionKind.QuickFix
    );
    action.edit = new vscode.WorkspaceEdit();

    const line = diagnostic.range.start.line;
    const text = document.lineAt(line).text;

    // Find the last #'identifier on the line and insert /*'*/ after it
    const match = text.match(/^(.*#'\w+)(.*)/);
    if (match) {
      const beforeClosure = match[1];
      const afterClosure = match[2];
      action.edit.replace(
        document.uri,
        new vscode.Range(line, 0, line, text.length),
        beforeClosure + "/*'*/" + afterClosure
      );
    }

    action.diagnostics = [diagnostic];
    action.isPreferred = true;
    return action;
  }
}
