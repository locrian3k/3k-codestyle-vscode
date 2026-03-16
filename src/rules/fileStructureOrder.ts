import * as vscode from "vscode";
import { LpcContext } from "../lpcParser";
import { Config } from "../config";

/**
 * Rule: File structure should follow the 3K codestyle order:
 *   #pragma, #include, #define, inherit, globals/prototypes,
 *   one-liner functions, create(), init(), reset(), other functions.
 *
 * One-liner functions (simple query/set accessors) are grouped with
 * declarations before create(), matching the convention that property
 * accessors sit near their global variables.
 *
 * Only applies to .c files.
 */

// Section order constants (lower = should appear earlier)
const S_PRAGMA = 0;
const S_INCLUDE = 1;
const S_DEFINE = 2;
const S_INHERIT = 3;
const S_DECLARATION = 4;
const S_ONE_LINER = 5;
const S_CREATE = 6;
const S_INIT = 7;
const S_RESET = 8;
const S_OTHER_FUNC = 9;

const SECTION_LABELS: Record<number, string> = {
  [S_PRAGMA]: "#pragma",
  [S_INCLUDE]: "#include",
  [S_DEFINE]: "#define",
  [S_INHERIT]: "inherit",
  [S_DECLARATION]: "globals/prototypes",
  [S_ONE_LINER]: "one-liner functions",
  [S_CREATE]: "create()",
  [S_INIT]: "init()",
  [S_RESET]: "reset()",
  [S_OTHER_FUNC]: "functions",
};

export function fileStructureOrder(
  document: vscode.TextDocument,
  contexts: LpcContext,
  _config: Config
): vscode.Diagnostic[] {
  if (!document.fileName.endsWith(".c")) { return []; }

  const diagnostics: vscode.Diagnostic[] = [];

  // Map function signature lines to their info
  const funcAtLine = new Map<number, {
    name: string; isOneLiner: boolean; returnType: string;
  }>();
  const insideFunction = new Set<number>();

  for (const func of contexts.functions) {
    funcAtLine.set(func.signatureLine, {
      name: func.name,
      isOneLiner: func.isOneLiner,
      returnType: func.returnType,
    });
    // Mark body lines (after signature through closing brace) to skip
    for (let l = func.signatureLine + 1; l <= func.closeBraceLine; l++) {
      insideFunction.add(l);
    }
  }

  let highestSection = -1;
  let highestSectionLabel = "";
  let highestSectionLine = -1;

  for (let lineNum = 0; lineNum < document.lineCount; lineNum++) {
    if (insideFunction.has(lineNum)) { continue; }

    const ctx = contexts.lines[lineNum];
    if (ctx.isInBlockComment) { continue; }

    const trimmed = ctx.text.trim();
    if (trimmed === "" || trimmed.startsWith("//") ||
        trimmed.startsWith("/*") || trimmed.startsWith("*")) {
      continue;
    }

    // Skip conditional preprocessor directives (they can wrap any section)
    if (trimmed.startsWith("#ifdef") || trimmed.startsWith("#ifndef") ||
        trimmed.startsWith("#endif") || trimmed.startsWith("#else") ||
        trimmed.startsWith("#elif") || trimmed.startsWith("#if ")) {
      continue;
    }

    let section = -1;
    let label = "";

    // Check if this is a function signature
    const funcInfo = funcAtLine.get(lineNum);
    if (funcInfo) {
      if (funcInfo.name === "create") {
        section = S_CREATE;
        label = "create()";
      } else if (funcInfo.name === "init") {
        section = S_INIT;
        label = "init()";
      } else if (funcInfo.name === "reset") {
        section = S_RESET;
        label = "reset()";
      } else if (funcInfo.isOneLiner && (funcInfo.returnType !== "void"
        || /^(?:set_|query_|clear_|reset_|is_|can_)/.test(funcInfo.name))) {
        // Non-void one-liners are accessors. Void one-liners with
        // accessor prefixes (set_, query_, etc.) also belong here.
        // Other void one-liners are action callbacks after create.
        section = S_ONE_LINER;
        label = funcInfo.name + "()";
      } else {
        section = S_OTHER_FUNC;
        label = funcInfo.name + "()";
      }
    }
    else if (trimmed.startsWith("#pragma")) {
      section = S_PRAGMA;
      label = "#pragma";
    }
    else if (trimmed.startsWith("#include")) {
      section = S_INCLUDE;
      label = "#include";
    }
    else if (trimmed.startsWith("#define") || trimmed.startsWith("#undef")) {
      section = S_DEFINE;
      label = "#define";
    }
    else if (trimmed.startsWith("inherit ") || trimmed === "inherit") {
      section = S_INHERIT;
      label = "inherit";
    }
    else if (ctx.braceDepth === 0) {
      section = S_DECLARATION;
      label = "declaration";
    }

    if (section === -1) { continue; }

    if (section < highestSection) {
      diagnostics.push(
        new vscode.Diagnostic(
          new vscode.Range(lineNum, 0, lineNum, ctx.text.length),
          label + " should appear before " + highestSectionLabel +
          " (line " + (highestSectionLine + 1) +
          "). Expected order: pragma, includes, defines, inherit, " +
          "globals/prototypes, one-liners, create(), init(), " +
          "reset(), other functions.",
          vscode.DiagnosticSeverity.Hint
        )
      );
    } else if (section > highestSection) {
      highestSection = section;
      highestSectionLabel = label;
      highestSectionLine = lineNum;
    }
  }

  return diagnostics;
}
