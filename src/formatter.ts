import * as vscode from "vscode";
import { getConfig } from "./config";
import { parseDocument } from "./lpcParser";
import { convertUnixLineEndings } from "./transforms/unixLineEndings";
import { convertTabsToSpaces } from "./transforms/tabsToSpaces";
import { fixKeywordSpacing } from "./transforms/fixKeywordSpacing";
import { fixCommaSpacing } from "./transforms/fixCommaSpacing";
import { convertToAllman } from "./transforms/allmanConvert";
import { mergeCallChains } from "./transforms/mergeCallChains";
import { fixIndentation } from "./transforms/fixIndentation";
import { collapseClosingLines } from "./transforms/collapseClosingLines";
import { alignAssignments } from "./transforms/alignAssignments";
import { wrapLongStrings } from "./transforms/wrapLongStrings";
import { collapseShortArrays } from "./transforms/collapseShortArrays";
import { splitLongArrays } from "./transforms/splitLongArrays";
import { blankLineBetweenFunctions } from "./transforms/blankLineBetweenFunctions";
import { collapseBlankLines } from "./transforms/collapseBlankLines";
import { trimTrailingWhitespace } from "./transforms/trimWhitespace";
import { ensureTrailingNewline } from "./transforms/ensureTrailingNewline";

export class LpcFormattingProvider implements vscode.DocumentFormattingEditProvider {
  provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    _options: vscode.FormattingOptions,
    _token: vscode.CancellationToken
  ): vscode.TextEdit[] {
    const config = getConfig();
    if (!config.enable || !config.formatEnable) {
      return [];
    }

    let text = document.getText();

    // Apply transforms in order (order matters)
    text = convertUnixLineEndings(text);
    text = convertTabsToSpaces(text);
    text = fixKeywordSpacing(text);
    text = fixCommaSpacing(text);
    text = convertToAllman(text);
    text = mergeCallChains(text);
    text = fixIndentation(text);
    text = collapseClosingLines(text);
    text = alignAssignments(text);
    text = wrapLongStrings(text);
    text = collapseShortArrays(text);
    text = splitLongArrays(text);
    text = blankLineBetweenFunctions(text);
    text = collapseBlankLines(text);
    text = trimTrailingWhitespace(text);
    text = ensureTrailingNewline(text);

    // If nothing changed, return empty edits
    if (text === document.getText()) {
      return [];
    }

    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(document.getText().length)
    );
    return [vscode.TextEdit.replace(fullRange, text)];
  }
}
