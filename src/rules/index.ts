import * as vscode from "vscode";
import { LpcContext } from "../lpcParser";
import { Config } from "../config";
import { pragmaStrongTypes } from "./pragmaStrongTypes";
import { includeDefsH } from "./includeDefsH";
import { noTabs } from "./noTabs";
import { indentation } from "./indentation";
import { lineLength } from "./lineLength";
import { allmanBrackets } from "./allmanBrackets";
import { voidReturn } from "./voidReturn";
import { statusType } from "./statusType";
import { singleStatementBrackets } from "./singleStatementBrackets";
import { superCreate } from "./superCreate";
import { unwrappedString } from "./unwrappedString";
import { fileStructureOrder } from "./fileStructureOrder";
import { forwardReference } from "./forwardReference";
import { defineUppercase } from "./defineUppercase";
import { staticDeprecated } from "./staticDeprecated";
import { fileHeaderComment } from "./fileHeaderComment";
import { filenameConventions } from "./filenameConventions";
import { mixedType } from "./mixedType";
import { sprintfPreference } from "./sprintfPreference";
import { defineParenthesized } from "./defineParenthesized";
import { privateVariables } from "./privateVariables";
import { floatCriticalData } from "./floatCriticalData";
import { bracesAroundMacro } from "./bracesAroundMacro";
import { closureQuoteFix } from "./closureQuoteFix";

export type LintRule = (
  document: vscode.TextDocument,
  contexts: LpcContext,
  config: Config
) => vscode.Diagnostic[];

export interface RuleEntry {
  id: string;
  settingKey: string;
  rule: LintRule;
}

export const allRules: RuleEntry[] = [
  { id: "pragma-strong-types", settingKey: "pragmaStrongTypes", rule: pragmaStrongTypes },
  { id: "include-defs-h", settingKey: "includeDefsH", rule: includeDefsH },
  { id: "no-tabs", settingKey: "noTabs", rule: noTabs },
  { id: "indentation", settingKey: "indentation", rule: indentation },
  { id: "line-length", settingKey: "lineLength", rule: lineLength },
  { id: "allman-brackets", settingKey: "allmanBrackets", rule: allmanBrackets },
  { id: "void-return-missing", settingKey: "voidReturn", rule: voidReturn },
  { id: "status-type", settingKey: "statusType", rule: statusType },
  { id: "single-statement-brackets", settingKey: "singleStatementBrackets", rule: singleStatementBrackets },
  { id: "super-create", settingKey: "superCreate", rule: superCreate },
  { id: "unwrapped-string", settingKey: "unwrappedString", rule: unwrappedString },
  { id: "file-structure-order", settingKey: "fileStructureOrder", rule: fileStructureOrder },
  { id: "forward-reference", settingKey: "forwardReference", rule: forwardReference },
  { id: "define-uppercase", settingKey: "defineUppercase", rule: defineUppercase },
  { id: "static-deprecated", settingKey: "staticDeprecated", rule: staticDeprecated },
  { id: "file-header-comment", settingKey: "fileHeaderComment", rule: fileHeaderComment },
  { id: "filename-conventions", settingKey: "filenameConventions", rule: filenameConventions },
  { id: "mixed-type", settingKey: "mixedType", rule: mixedType },
  { id: "sprintf-preference", settingKey: "sprintfPreference", rule: sprintfPreference },
  { id: "define-parenthesized", settingKey: "defineParenthesized", rule: defineParenthesized },
  { id: "private-variables", settingKey: "privateVariables", rule: privateVariables },
  { id: "float-critical-data", settingKey: "floatCriticalData", rule: floatCriticalData },
  { id: "braces-around-macro", settingKey: "bracesAroundMacro", rule: bracesAroundMacro },
  { id: "closure-quote-fix", settingKey: "closureQuoteFix", rule: closureQuoteFix },
];
