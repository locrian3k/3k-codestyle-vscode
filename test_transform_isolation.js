const fs = require("fs");
const path = require("path");
const Module = require("module");

const origResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent) {
  if (request === "vscode") return require.resolve("./test_vscode_mock.js");
  return origResolve.apply(this, arguments);
};

const srcPath = "C:/Users/1209a/OneDrive/Mud_Stuff/Mimic/areas/zodiac/rooms/evil/ae3.c";
const originalText = fs.readFileSync(srcPath, "utf8");

const transformsDir = path.join(__dirname, "out", "transforms");
const { convertUnixLineEndings } = require(path.join(transformsDir, "unixLineEndings.js"));
const { convertTabsToSpaces } = require(path.join(transformsDir, "tabsToSpaces.js"));
const { fixKeywordSpacing } = require(path.join(transformsDir, "fixKeywordSpacing.js"));
const { fixCommaSpacing } = require(path.join(transformsDir, "fixCommaSpacing.js"));
const { convertToAllman } = require(path.join(transformsDir, "allmanConvert.js"));
const { mergeCallChains } = require(path.join(transformsDir, "mergeCallChains.js"));
const { fixIndentation } = require(path.join(transformsDir, "fixIndentation.js"));
const { collapseClosingLines } = require(path.join(transformsDir, "collapseClosingLines.js"));
const { alignAssignments } = require(path.join(transformsDir, "alignAssignments.js"));
const { wrapLongStrings } = require(path.join(transformsDir, "wrapLongStrings.js"));
const { collapseShortArrays } = require(path.join(transformsDir, "collapseShortArrays.js"));
const { splitLongArrays } = require(path.join(transformsDir, "splitLongArrays.js"));
const { blankLineBetweenFunctions } = require(path.join(transformsDir, "blankLineBetweenFunctions.js"));
const { collapseBlankLines } = require(path.join(transformsDir, "collapseBlankLines.js"));
const { trimTrailingWhitespace } = require(path.join(transformsDir, "trimWhitespace.js"));
const { ensureTrailingNewline } = require(path.join(transformsDir, "ensureTrailingNewline.js"));

const pipeline = [
  { name: "convertUnixLineEndings", fn: convertUnixLineEndings },
  { name: "convertTabsToSpaces", fn: convertTabsToSpaces },
  { name: "fixKeywordSpacing", fn: fixKeywordSpacing },
  { name: "fixCommaSpacing", fn: fixCommaSpacing },
  { name: "convertToAllman", fn: convertToAllman },
  { name: "mergeCallChains", fn: mergeCallChains },
  { name: "fixIndentation", fn: fixIndentation },
  { name: "collapseClosingLines", fn: collapseClosingLines },
  { name: "alignAssignments", fn: alignAssignments },
  { name: "wrapLongStrings", fn: wrapLongStrings },
  { name: "collapseShortArrays", fn: collapseShortArrays },
  { name: "splitLongArrays", fn: splitLongArrays },
  { name: "blankLineBetweenFunctions", fn: blankLineBetweenFunctions },
  { name: "collapseBlankLines", fn: collapseBlankLines },
  { name: "trimTrailingWhitespace", fn: trimTrailingWhitespace },
  { name: "ensureTrailingNewline", fn: ensureTrailingNewline },
];

function checkIndentation(text) {
  const lines = text.split("\n");
  const issues = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trimStart().startsWith("add_exit")) {
      const leading = line.match(/^(\s*)/)[1];
      if (leading !== "  ") {
        issues.push("  Line " + (i+1) + ": add_exit has " + leading.length + " spaces, expected 2");
        issues.push("    > " + JSON.stringify(line));
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trimStart().startsWith("string lookatchest")) {
      const leading = line.match(/^(\s*)/)[1];
      if (leading !== "") {
        issues.push("  Line " + (i+1) + ": string lookatchest has " + leading.length + " spaces, expected 0");
        issues.push("    > " + JSON.stringify(line));
      }
    }
  }

  let inCreate = false;
  let braceDepth = 0;
  let createReturnLine = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === "void create()") {
      inCreate = true;
      braceDepth = 0;
      continue;
    }
    if (inCreate) {
      for (const ch of trimmed) {
        if (ch === "{") braceDepth++;
        if (ch === "}") braceDepth--;
      }
      if (trimmed === "return;" && braceDepth === 1) {
        createReturnLine = i;
      }
      if (braceDepth === 0 && trimmed === "}") {
        if (createReturnLine >= 0) {
          const rl = lines[createReturnLine];
          const leading = rl.match(/^(\s*)/)[1];
          if (leading !== "  ") {
            issues.push("  Line " + (createReturnLine+1) + ": return; in create() has " + leading.length + " spaces, expected 2");
            issues.push("    > " + JSON.stringify(rl));
          }
        }
        inCreate = false;
        break;
      }
    }
  }

  return issues;
}

console.log("=== Transform Isolation Test for ae3.c ===");
console.log();

const issuesOriginal = checkIndentation(originalText);
console.log("ORIGINAL file:");
if (issuesOriginal.length === 0) {
  console.log("  OK - all indentation checks pass");
} else {
  console.log("  ISSUES:");
  issuesOriginal.forEach(function(x) { console.log(x); });
}
console.log();

let currentText = originalText;
let prevText = originalText;
let firstBreak = null;

for (const step of pipeline) {
  prevText = currentText;
  try {
    currentText = step.fn(currentText);
  } catch (e) {
    console.log("[" + step.name + "] ERROR: " + e.message);
    console.log(e.stack);
    continue;
  }

  const changed = currentText !== prevText;
  const issues = checkIndentation(currentText);
  const prevIssues = checkIndentation(prevText);
  const newIssues = issues.length > 0 && prevIssues.length === 0;

  if (changed) {
    const status = issues.length === 0 ? "OK" : "BROKEN";
    console.log("[" + step.name + "] changed=YES  indent=" + status);
    if (issues.length > 0) {
      issues.forEach(function(x) { console.log(x); });
    }

    const prevLines = prevText.split("\n");
    const currLines = currentText.split("\n");
    const keywords = ["add_exit", "string lookatchest"];

    const relevantBefore = [];
    const relevantAfter = [];

    for (let i = 0; i < prevLines.length; i++) {
      const trimmed = prevLines[i].trim();
      if (keywords.some(function(k) { return trimmed.startsWith(k); })) {
        relevantBefore.push("    " + (i+1) + ": " + JSON.stringify(prevLines[i]));
      }
      if (trimmed === "return;" && i > 10 && i < 60) {
        relevantBefore.push("    " + (i+1) + ": " + JSON.stringify(prevLines[i]));
      }
    }
    for (let i = 0; i < currLines.length; i++) {
      const trimmed = currLines[i].trim();
      if (keywords.some(function(k) { return trimmed.startsWith(k); })) {
        relevantAfter.push("    " + (i+1) + ": " + JSON.stringify(currLines[i]));
      }
      if (trimmed === "return;" && i > 10 && i < 60) {
        relevantAfter.push("    " + (i+1) + ": " + JSON.stringify(currLines[i]));
      }
    }

    const beforeStr = relevantBefore.join("\n");
    const afterStr = relevantAfter.join("\n");
    if (beforeStr !== afterStr) {
      console.log("  Relevant lines BEFORE:");
      console.log(beforeStr);
      console.log("  Relevant lines AFTER:");
      console.log(afterStr);
    }

    if (newIssues && !firstBreak) {
      firstBreak = step.name;
      console.log();
      console.log("  >>> FIRST BREAK: " + step.name + " <<<");
      console.log();
    }
    console.log();
  } else {
    const cs = issues.length === 0 ? "OK" : "BROKEN (pre-existing)";
    console.log("[" + step.name + "] changed=NO   indent=" + cs);
    console.log();
  }
}

console.log("=== Final state of key lines ===");
console.log();
const finalLines = currentText.split("\n");
for (let i = 0; i < finalLines.length; i++) {
  const trimmed = finalLines[i].trim();
  if (trimmed.startsWith("add_exit") || trimmed.startsWith("string lookatchest") || (trimmed === "return;" && i > 10 && i < 60)) {
    const start = Math.max(0, i - 2);
    const end = Math.min(finalLines.length - 1, i + 2);
    for (let j = start; j <= end; j++) {
      const marker = j === i ? ">>>" : "   ";
      console.log(marker + " " + (j+1) + ": " + JSON.stringify(finalLines[j]));
    }
    console.log("   ---");
  }
}

if (firstBreak) {
  console.log();
  console.log("=== CONCLUSION: " + JSON.stringify(firstBreak) + " is the first transform that breaks indentation ===");
} else {
  console.log();
  console.log("=== CONCLUSION: No transform broke the indentation checks ===");
}
