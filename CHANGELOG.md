# Changelog

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
