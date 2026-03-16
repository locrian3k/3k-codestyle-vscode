import * as vscode from "vscode";

export interface LintConfig {
  pragmaStrongTypes: boolean;
  includeDefsH: boolean;
  noTabs: boolean;
  indentation: boolean;
  lineLength: boolean;
  lineLengthMax: number;
  allmanBrackets: boolean;
  voidReturn: boolean;
  statusType: boolean;
  singleStatementBrackets: boolean;
  superCreate: boolean;
  unwrappedString: boolean;
  fileStructureOrder: boolean;
  forwardReference: boolean;
  defineUppercase: boolean;
  staticDeprecated: boolean;
  fileHeaderComment: boolean;
  filenameConventions: boolean;
  mixedType: boolean;
  sprintfPreference: boolean;
  defineParenthesized: boolean;
  privateVariables: boolean;
  floatCriticalData: boolean;
  bracesAroundMacro: boolean;
}

export interface Config {
  enable: boolean;
  lint: LintConfig;
  formatEnable: boolean;
}

export function getConfig(): Config {
  const cfg = vscode.workspace.getConfiguration("3k-codestyle");
  return {
    enable: cfg.get<boolean>("enable", true),
    lint: {
      pragmaStrongTypes: cfg.get<boolean>("lint.pragmaStrongTypes", true),
      includeDefsH: cfg.get<boolean>("lint.includeDefsH", true),
      noTabs: cfg.get<boolean>("lint.noTabs", true),
      indentation: cfg.get<boolean>("lint.indentation", true),
      lineLength: cfg.get<boolean>("lint.lineLength", true),
      lineLengthMax: cfg.get<number>("lint.lineLengthMax", 80),
      allmanBrackets: cfg.get<boolean>("lint.allmanBrackets", true),
      voidReturn: cfg.get<boolean>("lint.voidReturn", true),
      statusType: cfg.get<boolean>("lint.statusType", true),
      singleStatementBrackets: cfg.get<boolean>("lint.singleStatementBrackets", true),
      superCreate: cfg.get<boolean>("lint.superCreate", true),
      unwrappedString: cfg.get<boolean>("lint.unwrappedString", true),
      fileStructureOrder: cfg.get<boolean>("lint.fileStructureOrder", true),
      forwardReference: cfg.get<boolean>("lint.forwardReference", true),
      defineUppercase: cfg.get<boolean>("lint.defineUppercase", true),
      staticDeprecated: cfg.get<boolean>("lint.staticDeprecated", true),
      fileHeaderComment: cfg.get<boolean>("lint.fileHeaderComment", true),
      filenameConventions: cfg.get<boolean>("lint.filenameConventions", true),
      mixedType: cfg.get<boolean>("lint.mixedType", true),
      sprintfPreference: cfg.get<boolean>("lint.sprintfPreference", true),
      defineParenthesized: cfg.get<boolean>("lint.defineParenthesized", true),
      privateVariables: cfg.get<boolean>("lint.privateVariables", true),
      floatCriticalData: cfg.get<boolean>("lint.floatCriticalData", true),
      bracesAroundMacro: cfg.get<boolean>("lint.bracesAroundMacro", true),
    },
    formatEnable: cfg.get<boolean>("format.enable", true),
  };
}
