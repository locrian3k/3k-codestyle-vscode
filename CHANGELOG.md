# Changelog

## 0.1.35 — 2026-03-22

### Linter
- **`includeDefsH`**: Now accepts any local `#include "..."` as satisfying the linked header chain, not just the literal `defs.h`. Files that include intermediate headers (e.g., `power_inc.h`) which themselves pull in `defs.h` no longer trigger a false warning.

## 0.1.34 — 2026-03-22

### Linter
- **`includeDefsH`**: Now skips all `.h` files, not just `defs.h`. Header files are inheritable partials meant to be included by `.c` files that already have the defs chain pulled in — requiring them to re-include `defs.h` is redundant.

## 0.1.33 — 2026-03-22

### Documentation
- Updated README/Details page with all 25 lint rules, 8 quick fixes, and 27 settings
- Fixed `superCreate` description: no longer references `reset()` (removed in v0.1.31)
- Updated file structure example: `reset()` no longer shows `::reset()` call
- Updated formatter description to reflect stack-based indentation engine

## 0.1.32 — 2026-03-22

### Linter
- **`closureQuoteFix`** (Hint): `#'function` closure references leave an unmatched quote that confuses IDE syntax highlighting — suggests adding `/*'*/` after the closure

## 0.1.31 — 2026-03-22

### Linter
- **`superCreate`**: Removed `::reset()` warning entirely — on 3K, no base inherited files define `reset()`, so calling `::reset()` does nothing. `::create()` and `::init()` warnings remain.

## 0.1.30 — 2026-03-16

### Formatter — Major Refactor
- **`fixIndentation`**: Rewrote from counter-based to stack-based architecture — every opener pushes a frame with its line indent, every closer pops and aligns with its opener. Eliminates the `countLeadingCloses`/`calcParenContribution` pre-calculation that caused 7+ bugs with combined closing-line patterns (`}));`, `}), 0, ({...}));`, etc.)
- Paren capping (multiple `(` in same context = +1 total indent) now emerges structurally from the stack instead of arithmetic calculation
- Same-line literal subsumption: `set_attack_pattern(({` items indent +1 from the call, not +2
- All existing edge cases preserved: `(::` vs `(:` distinction, `array[i])` guard, bracketless control flow, switch/case, block comments

## 0.1.29 — 2026-03-15

### Linter
- **`bracesAroundMacro`** (Warning): UPPERCASE macro calls (e.g. `REPORT()`) used as braceless `if`/`else` bodies must be wrapped in braces — macros that expand to `if()` statements cause dangling else bugs without them
- **`singleStatementBrackets`**: No longer suggests removing braces when the single statement is an UPPERCASE macro call (avoids conflicting with `bracesAroundMacro`)
- **`fileStructureOrder`**: Void one-liners with accessor prefixes (`set_`, `query_`, `clear_`, `reset_`, `is_`, `can_`) are now correctly classified as one-liner accessors, not action callbacks

### Bug Fixes
- **`collapseShortArrays`**: Fixed formatter breaking multi-line string concatenation expressions inside array literals — continuation lines starting with `+`, `||`, `&&` (or following a line ending with those operators) are now merged with the previous element instead of being treated as separate array elements

## 0.1.28 — 2026-03-13

### Linter — 9 New Rules from 3K Coding Primer
- **`defineUppercase`** (Warning): `#define` macro names must be UPPERCASE to distinguish from variables
- **`staticDeprecated`** (Hint): `static` modifier is deprecated in the new driver — use `protected` for functions, `nosave` for variables
- **`fileHeaderComment`** (Hint): `.c` files should start with a comment block (filename, author, date, description)
- **`filenameConventions`** (Warning): Filenames should not contain spaces or uppercase letters
- **`mixedType`** (Hint): Avoid `mixed` type on functions and variables unless truly necessary
- **`sprintfPreference`** (Hint): Use `sprintf()`/`printf()` instead of string concatenation (`+`) in output functions
- **`defineParenthesized`** (Hint): `#define` values using concatenation (`+`) should be wrapped in parentheses
- **`privateVariables`** (Hint): Global variables in inheritable files (those with `query_`/`set_` accessors) should be `private`
- **`floatCriticalData`** (Hint): Don't use `float` for critical game data (experience, gold, etc.) — use `int` to prevent precision loss

All 9 rules are individually toggleable via `3k-codestyle.lint.*` settings.

## 0.1.27 — 2026-03-13

### Linter
- **`superCreate`**: Downgraded missing `::reset()` warning from Warning to Hint — many parent classes don't define `reset()`, and the linter can't trace the inheritance chain to verify; `create()` and `init()` remain Warning severity
- **`superCreate`**: Hint messages now reference the inherited file(s) — e.g. `reset() should call ::reset() if DROOM defines reset().` so the user knows which parent to check

## 0.1.25 — 2026-03-13

### Bug Fixes
- **`collapseClosingLines`**: Phase 1 no longer joins consecutive close-dominated lines when the previous line ends with a comma — preserves the visual boundary between array element separators and container closes (e.g. `),` followed by `}));` stays on two lines)
- **`collapseClosingLines`**: Phase 2 no longer absorbs container closes (`})`, `])`) or lines that open new scopes (unbalanced parens like `create_verbal(`) as trailing arguments

## 0.1.24 — 2026-03-13

### Bug Fixes
- **`collapseShortArrays`**: Fixed formatter adding commas between juxtaposed strings inside multi-line function calls nested in `({})` arrays — the transform now detects unbalanced parentheses in collected "elements" and skips collapse/reflow for multi-line function call fragments
- **`wrapLongStrings`**: Fixed off-by-one in `splitStringAtWords` that produced chunks one character too long when a space fell exactly at the max boundary, causing wrapped lines to hit 81 chars instead of 80

### Formatter
- `wrapLongStrings` now handles strings followed by more arguments (e.g., `create_verbal(, name, "long msg", "write", "yells")`) — previously only split strings where the suffix was just closing parens/semicolons; now appends the suffix to the last juxtaposed chunk line

### Quick Fixes
- Line-length quick-fix now offers "Split string across lines" as a fallback (Strategy 5) when no other break strategy works — splits the longest string literal at a word boundary using LPC string juxtaposition

## 0.1.23 — 2026-03-12

### Quick Fixes
- Line-length break suggestion now finds operators inside function call arguments (e.g., `REPORT("..." + var + "...")`) by falling back to depth 1 when no operators exist at the base depth

## 0.1.22 — 2026-03-12

### Formatter
- `fixIndentation` now correctly handles `//` comments before bracketless control flow bodies — comments receive the body indent without consuming it, so the actual statement after the comment also gets proper indentation

## 0.1.21 — 2026-03-12

### Linter
- `file-structure-order` no longer suggests moving `void` one-liner functions above `create()` — only non-void accessors (query/set/is functions) belong in the pre-create section; void one-liners like `handle_attack` are action callbacks that belong with other functions

## 0.1.20 — 2026-03-12

### Formatter
- `collapseShortArrays` now preserves one-element-per-line formatting when elements are long expressions (>20 chars), instead of reflowing them onto fewer lines

## 0.1.19 — 2026-03-12

### Bug Fixes
- Fixed `fixIndentation` confusing `(::` (paren + scope-resolution) with `(:` (LPC closure literal opener), which caused all lines after `(::function())` calls to be over-indented
- Applied the same `(::` vs `(:` fix to `lpcParser`, `allmanConvert`, and `splitLongArrays` to prevent similar issues across the formatter and linter
- Fixed `fixIndentation` bracketless-body detection falsely triggering on one-liner `if` statements ending with `}` (e.g., `if (cond) { stmt; }`), which over-indented the next line

## 0.1.18 — 2026-03-12

### Bug Fixes
- Fixed `collapseShortArrays` mangling multi-argument function calls like `add_item(({...}), second_arg)` — the transform now correctly leaves the array as an in-place collapsed argument instead of absorbing the parent function call line when the array is followed by a comma (indicating more arguments)

## 0.1.17 — 2026-03-11

### Formatter
- Enhanced `collapseShortArrays`: when a multi-line array can't fit on one line, it now **reflows** elements onto grouped lines that stay under 80 characters, instead of leaving them one-per-line
- Example: 10 elements listed on 10 lines → grouped onto 1–2 lines within the 80-char limit

## 0.1.16 — 2026-03-11

### Quick Fixes
- New quick-fix for `line-length` warnings: suggests where to break long lines (7th code action)
- Priority-based strategy: break after assignment `=`, after `return`, before binary operators, or after commas
- Operator breaks prefer lowest precedence first (`||` → `&&` → `+`/`-` → `*`/`/`)
- Context-aware: detects `if`/`while`/`for` conditions and finds operators at the correct paren depth
- Only offers a fix when both resulting lines fit under 80 characters

## 0.1.15 — 2026-03-11

### Linter
- New rule: `forward-reference` — warns when a locally-defined function is called before it is defined and has no forward prototype declaration (13th lint rule)
- Detects prototype declarations (`void func_name();`) and suppresses warnings when present
- Skips recursive calls, function names inside strings/comments, and external/inherited functions

## 0.1.14 — 2026-03-11

### Formatter
- New transform: collapse multi-line LPC array literals (`({...})`) to single line when they fit under 80 characters — 16th formatter transform
- Handles both `({` at end of line and `({` on its own line (absorbs prefix from previous line)
- Works with `add_item` patterns: collapses array portion while leaving remaining arguments untouched

## 0.1.13 — 2026-03-11

### Linter
- Enhanced `unwrapped-string` rule with context awareness:
  - Skips warnings inside `create()` and `reset()` where `word_wrap()` cannot be used (compile-time storage)
  - Single-target functions (`tell_object`, `write`, `ansi_write`, `ansi_tell_object`) suggest `word_wrap()`
  - Multi-target functions (`tell_room`, `ansi_tell_room`) warn that `word_wrap()` cannot be used, suggest manual wrapping
  - Removed references to custom `WRAP()`/`WWRAP()` macros — only suggests built-in `word_wrap()`

### Quick Fixes
- New quick-fix for `unwrapped-string`: auto-wraps string argument in `word_wrap()` for single-target output functions (6th code action)

## 0.1.12 — 2026-03-10

### Formatter
- New transform: auto-split single-line LPC array literals (`({...})`) that exceed 80 characters into multi-line format with proper indentation and trailing commas — 15th formatter transform

## 0.1.11 — 2026-03-10

### Formatter
- Pointer position normalization: moves `*` to the name side (`string* func` → `string *func`) for declarations and function signatures

## 0.1.10 — 2026-03-10

### Bugfix
- Fixed indentation bug where `array[i])` patterns (array index followed by closing paren) were misidentified as LPC mapping literal closers `])`, causing incorrect depth tracking and wrong indentation for subsequent lines
- Fixed function signature parser not recognizing pointer return types with `*` on the type side (e.g., `string* func()`), causing false positives in the file structure order rule

## 0.1.9 — 2026-03-09

### Formatter
- New transform: collapse consecutive closing lines (e.g., `)\n), ETO\n);` becomes `)), ETO);`) — 14th formatter transform

## 0.1.8 — 2026-03-09

### Formatter
- Bracketless control flow body indentation: lines after `if(...)`, `else if(...)`, `else`, `while(...)`, `for(...)` without braces are now indented one level deeper
- Fixed paren indentation for function calls inside LPC literals: args to calls like `create_verbal(...)` inside `({ })` now indent one level deeper than the call

## 0.1.7 — 2026-03-09

### Formatter
- Fixed LPC literal indentation: items inside `({ })`, `([ ])`, and `(: :)` are now indented one level deeper than the opener, and the closer aligns with the opener. Regular function call nesting is unchanged.
- Fixed `})` incorrectly triggering brace depth reduction (was treated as code brace close instead of LPC array literal close)

## 0.1.6 — 2026-03-09

### Linter
- Added file structure order rule: hints when file sections are out of the expected order (pragma, includes, defines, inherit, globals/prototypes, one-liner functions, create(), init(), reset(), other functions). One-liner accessor functions are grouped with declarations before create(). (12th lint rule)

## 0.1.5 — 2026-03-09

### Linter
- Added unwrapped string rule: warns when output functions (write, tell_object, ansi_write, ansi_tell_object, tell_room, ansi_tell_room) have string arguments over 80 chars without WRAP(), WWRAP(), or word_wrap() wrapping (11th lint rule)

## 0.1.4 — 2026-03-09

### Formatter
- Added long string wrapping: automatically splits strings over 80 chars using LPC juxtaposition, with closing parens on their own line

## 0.1.3 — 2026-03-09

### Linter
- Added parent call rule: warns if `create()`, `init()`, or `reset()` do not call their `::` parent version in `.c` files (10th lint rule)

### Bugfix
- Fixed parser misidentifying function boundaries for K&R-style functions (brace on same line as signature), which caused false positives in the void return rule

## 0.1.2 — 2026-03-09

### Formatter
- Added keyword spacing: ensures space between control keywords and `(` (`if(` → `if (`)
- Added comma spacing: ensures space after commas (`func(a,b)` → `func(a, b)`)
- Added blank line between functions: inserts a blank line after top-level `}` when the next function follows immediately
- Added blank line collapsing: reduces 3+ consecutive blank lines to a maximum of 2
- Added trailing newline enforcement: file always ends with exactly one newline

## 0.1.1 — 2026-03-09

### Formatter
- Added call chain merging: collapses split `ansi_write(to_ansi(WWRAP(` patterns into a single line (respects 80-char limit)
- Added switch/case indentation: case body lines indent one level deeper than the case label
- Added `=` sign auto-alignment: consecutive assignments at the same indent level align their `=` signs

### Linter
- `#include "defs.h"` rule now skips `defs.h` files themselves

## 0.1.0 — 2026-03-09

Initial release.

### Linter
- 9 lint rules: pragma, include, tabs, indentation, line length, Allman brackets, void return, status type, single-statement brackets
- Real-time diagnostics on open, save, and as-you-type (300ms debounce)
- All rules individually toggleable in settings
- LPC-aware parser: correctly handles array `({})`, mapping `([])`, and closure `(::)` literals
- Pragma rule allows file header comments before `#pragma strong_types`

### Formatter
- 5 transforms: Unix line endings, tabs to spaces, K&R to Allman conversion, indentation fix, trailing whitespace trim
- LPC-aware: preserves array, mapping, and closure literal syntax
- Block comment content preserved as-is (no `*` insertion)

### Quick Fixes
- Add missing `#pragma strong_types`
- Add missing `#include "defs.h"`
- Convert tab to spaces
- Add missing `return;` to void functions
- Move brace to new line (Allman style)

### Syntax Highlighting
- Full TextMate grammar for LPC
- Keywords, types, modifiers, operators
- LPC-specific: closures, efun references, call-other, heredoc strings
- Preprocessor directives, inherit statements
