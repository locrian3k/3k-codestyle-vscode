import * as vscode from "vscode";
import { LpcContext } from "../lpcParser";
import { Config } from "../config";

/**
 * Rule: Global variables in inheritable files should be private.
 *
 * The 3K Coding Primer states: "It is bad practice to allow
 * inheritables to directly access internal variables. Instead,
 * declare them as private and offer helper functions to set and
 * query them."
 *
 * Only flags files that look like inheritables — those that define
 * query_/set_ accessor functions AND don't have #pragma no_inherit.
 * Global variables without a "private" modifier get a hint.
 */

// Types that can begin a variable declaration
const VAR_TYPES =
  /^(?:int|string|object|mapping|status|float|mixed|closure|bytes)\b/;

export function privateVariables(
  document: vscode.TextDocument,
  contexts: LpcContext,
  _config: Config
): vscode.Diagnostic[] {
  // Only check .c files
  if (!document.fileName.endsWith(".c")) {
    return [];
  }

  // Check for #pragma no_inherit — skip entirely
  for (const ctx of contexts.lines) {
    if (ctx.isPreprocessor
      && /^#\s*pragma\s+no_inherit/.test(ctx.text.trim()))
    {
      return [];
    }
  }

  // Check if file defines accessor functions (query_/set_)
  // If not, it probably isn't an inheritable pattern
  const hasAccessors = contexts.functions.some(
    f => /^(?:query_|set_)/.test(f.name)
  );
  if (!hasAccessors) {
    return [];
  }

  const diagnostics: vscode.Diagnostic[] = [];

  for (const ctx of contexts.lines) {
    // Only check global scope (brace depth 0)
    if (ctx.braceDepth !== 0) { continue; }
    if (ctx.isInBlockComment || ctx.isInString) { continue; }
    if (ctx.isPreprocessor) { continue; }

    const text = ctx.text;
    const trimmed = text.trim();

    // Skip comments, inherit, empty lines
    if (trimmed.startsWith("//") || trimmed.startsWith("/*")) {
      continue;
    }
    if (trimmed.startsWith("inherit ")) { continue; }
    if (trimmed.length === 0) { continue; }

    // Skip function signatures
    if (contexts.functions.some(
      f => f.signatureLine === ctx.lineNumber)) { continue; }

    // Must end with semicolon (variable declaration)
    if (!trimmed.endsWith(";")) { continue; }

    // Already has "private" modifier — skip
    if (/\bprivate\b/.test(trimmed)) { continue; }

    // Strip other modifiers to find the type
    const stripped = trimmed
      .replace(/^(?:protected|public|nosave|static|visible)\s+/, "")
      .replace(/^(?:protected|public|nosave|static|visible)\s+/, "");

    // Check if it starts with a known type
    if (!VAR_TYPES.test(stripped)) { continue; }

    diagnostics.push(
      new vscode.Diagnostic(
        new vscode.Range(ctx.lineNumber, 0,
          ctx.lineNumber, text.length),
        "Global variable should be \"private\" with"
          + " query_/set_ accessors in inheritable files.",
        vscode.DiagnosticSeverity.Hint
      )
    );
  }

  return diagnostics;
}
