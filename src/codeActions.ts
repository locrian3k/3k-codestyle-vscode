import * as vscode from "vscode";

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
}
