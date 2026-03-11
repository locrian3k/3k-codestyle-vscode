import * as vscode from "vscode";
import { getConfig } from "./config";
import { parseDocument, LpcContext } from "./lpcParser";
import { allRules } from "./rules/index";

export function lintDocument(
  document: vscode.TextDocument,
  diagnosticCollection: vscode.DiagnosticCollection
): void {
  const config = getConfig();

  if (!config.enable) {
    diagnosticCollection.delete(document.uri);
    return;
  }

  const contexts = parseDocument(document);
  const diagnostics: vscode.Diagnostic[] = [];

  for (const entry of allRules) {
    const enabled = config.lint[entry.settingKey as keyof typeof config.lint];
    if (enabled === false) {
      continue;
    }

    const ruleDiags = entry.rule(document, contexts, config);
    for (const d of ruleDiags) {
      d.source = "3k-codestyle";
      if (!d.code) { d.code = entry.id; }
      diagnostics.push(d);
    }
  }

  diagnosticCollection.set(document.uri, diagnostics);
}
