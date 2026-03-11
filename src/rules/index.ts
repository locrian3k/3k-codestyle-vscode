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
];
