import * as vscode from "vscode";
import { lintDocument } from "./linter";
import { LpcFormattingProvider } from "./formatter";
import { LpcCodeActionProvider } from "./codeActions";

let diagnosticCollection: vscode.DiagnosticCollection;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

const DEBOUNCE_MS = 300;

export function activate(context: vscode.ExtensionContext): void {
  diagnosticCollection = vscode.languages.createDiagnosticCollection("3k-codestyle");
  context.subscriptions.push(diagnosticCollection);

  // Register formatter
  const formatter = new LpcFormattingProvider();
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider(
      { language: "lpc", scheme: "file" },
      formatter
    )
  );

  // Register code action provider
  const codeActionProvider = new LpcCodeActionProvider();
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      { language: "lpc", scheme: "file" },
      codeActionProvider,
      { providedCodeActionKinds: LpcCodeActionProvider.providedCodeActionKinds }
    )
  );

  // Lint on open
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => {
      if (doc.languageId === "lpc") {
        lintDocument(doc, diagnosticCollection);
      }
    })
  );

  // Lint on save
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.languageId === "lpc") {
        lintDocument(doc, diagnosticCollection);
      }
    })
  );

  // Lint on change (debounced)
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.languageId === "lpc") {
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
          lintDocument(event.document, diagnosticCollection);
        }, DEBOUNCE_MS);
      }
    })
  );

  // Clean up diagnostics when a document is closed
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((doc) => {
      diagnosticCollection.delete(doc.uri);
    })
  );

  // Lint all currently open LPC documents
  for (const doc of vscode.workspace.textDocuments) {
    if (doc.languageId === "lpc") {
      lintDocument(doc, diagnosticCollection);
    }
  }
}

export function deactivate(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
}
