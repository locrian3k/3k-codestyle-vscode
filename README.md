# 3K Codestyle for LPC

A Visual Studio Code extension that enforces [3Kingdoms MUD](https://www.3k.org) coding conventions for LPC (Lars Pensjö C) files, based on the codestyle standards written by Adalius. Built with assistance from Claude.

Provides real-time linting with diagnostics, a document formatter, quick-fix code actions, and full LPC syntax highlighting.

## Features

### Linter (13 Rules)

All rules run in real-time on file open, save, and as-you-type (300ms debounce). Each rule can be individually toggled in settings.

| Rule | Severity | Description |
|------|----------|-------------|
| `pragma-strong-types` | Error | Require `#pragma strong_types` as the first non-comment line of `.c` files |
| `include-defs-h` | Warning | Require `#include "defs.h"` in every file (skips `defs.h` itself) |
| `no-tabs` | Warning | Flag tab characters outside strings/comments (spaces only) |
| `indentation` | Warning | Require 2-space indentation multiples |
| `line-length` | Warning | Warn on lines exceeding 80 characters (configurable) |
| `allman-brackets` | Error | Require Allman-style braces (opening `{` on its own line) |
| `void-return-missing` | Warning | Require explicit `return;` at end of void functions |
| `status-type` | Hint | Suggest `status` type instead of `int` for boolean functions (`is_`, `has_`, `can_`, `query_`, `check_`) |
| `single-statement-brackets` | Hint | Flag unnecessary brackets on single-statement `if`/`else` |
| `super-create` | Warning | Warn if `create()`, `init()`, or `reset()` don't call their `::` parent version |
| `unwrapped-string` | Warning | Warn when output functions have long strings (>80 chars) not wrapped in `word_wrap()`. Context-aware: skips `create()`/`reset()`, distinguishes single-target vs multi-target functions |
| `file-structure-order` | Hint | Hint when file sections are out of order (pragma, includes, defines, inherit, globals/prototypes, one-liners, create, init, reset, other functions) |
| `forward-reference` | Warning | Warn when a locally-defined function is called before it is defined without a forward prototype declaration |

### Formatter (16 Transforms)

Triggered via VS Code's Format Document command (`Shift+Alt+F`). Transforms run in a specific order — each builds on the previous.

1. **Unix line endings** — Convert CRLF to LF
2. **Tabs to spaces** — Convert all tabs to 2 spaces
3. **Keyword spacing** — Ensure space between control keywords and `(` (`if(` to `if (`)
4. **Comma spacing** — Ensure space after commas (`func(a,b)` to `func(a, b)`)
5. **Allman conversion** — Move K&R opening braces to their own line
6. **Call chain merging** — Collapse split `ansi_write(to_ansi(WWRAP(` patterns to single line
7. **Indentation** — Fix all indentation to 2-space levels, LPC-literal-aware (`({})`, `([])`, `(::)`), bracketless control flow body indentation, switch/case alignment
8. **Collapse closing lines** — Merge consecutive close-dominated lines (`)\n);` to `));`)
9. **Align assignments** — Align `=` signs in consecutive assignment blocks
10. **Wrap long strings** — Split strings over 80 chars using LPC juxtaposition
11. **Collapse short arrays** — Collapse multi-line `({...})` arrays to single line when under 80 chars
12. **Split long arrays** — Split single-line `({...})` arrays exceeding 80 chars into multi-line format
13. **Blank line between functions** — Insert blank line after top-level `}` before next function
14. **Collapse blank lines** — Reduce 3+ consecutive blank lines to maximum of 2
15. **Trim trailing whitespace** — Remove trailing spaces/tabs from all lines
16. **Ensure trailing newline** — File ends with exactly one newline

### Quick Fixes (6 Code Actions)

Click the lightbulb or press `Ctrl+.` on a diagnostic to apply:

1. **Add `#pragma strong_types`** — Insert at first non-comment line
2. **Add `#include "defs.h"`** — Insert after pragma (or at top)
3. **Convert tab to spaces** — Replace tab with 2 spaces
4. **Add missing `return;`** — Insert before closing brace of void function
5. **Move brace to new line** — Convert K&R to Allman style
6. **Wrap string in `word_wrap()`** — Wrap long string argument for single-target output functions
7. **Break long line** — Suggest where to split lines over 80 characters (assignments, returns, operators, commas)

### Syntax Highlighting

Full TextMate grammar for LPC with support for:

- Keywords, types, modifiers, operators
- LPC-specific: closures `(: :)`, efun references, `call_other` (`->`)
- Array `({ })`, mapping `([ ])`, and closure `(: :)` literals
- Preprocessor directives, inherit statements
- Heredoc strings

## Settings

All settings are under the `3k-codestyle` prefix. Access via `File > Preferences > Settings` and search for "3k-codestyle".

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `enable` | boolean | `true` | Master enable/disable for linter and formatter |
| `lint.pragmaStrongTypes` | boolean | `true` | Require `#pragma strong_types` |
| `lint.includeDefsH` | boolean | `true` | Require `#include "defs.h"` |
| `lint.noTabs` | boolean | `true` | Flag tab characters |
| `lint.indentation` | boolean | `true` | Require 2-space indentation |
| `lint.lineLength` | boolean | `true` | Warn on long lines |
| `lint.lineLengthMax` | number | `80` | Maximum line length |
| `lint.allmanBrackets` | boolean | `true` | Require Allman-style braces |
| `lint.voidReturn` | boolean | `true` | Require `return;` in void functions |
| `lint.statusType` | boolean | `true` | Suggest `status` for boolean functions |
| `lint.singleStatementBrackets` | boolean | `true` | Flag unnecessary brackets |
| `lint.superCreate` | boolean | `true` | Warn on missing `::create()` etc. |
| `lint.unwrappedString` | boolean | `true` | Warn on unwrapped long strings |
| `lint.fileStructureOrder` | boolean | `true` | Hint on out-of-order sections |
| `lint.forwardReference` | boolean | `true` | Warn on forward references |
| `format.enable` | boolean | `true` | Enable document formatter |

## Installation

### From GitHub Release (recommended)

1. Go to [Releases](https://github.com/locrian3k/3k-codestyle-vscode/releases)
2. Download the `.vsix` file from the latest release
3. In VS Code: `Extensions` sidebar > `...` menu > `Install from VSIX...`
4. Select the downloaded `.vsix` file
5. Reload VS Code

### From source

Requires [Node.js](https://nodejs.org/) installed.

```bash
git clone https://github.com/locrian3k/3k-codestyle-vscode.git
cd 3k-codestyle-vscode
npm install
npm run compile
npx @vscode/vsce package
code --install-extension 3k-codestyle-*.vsix
```

## File Structure Convention

The expected order of sections in an LPC `.c` file:

```c
#pragma strong_types          // 1. Pragma
#include "defs.h"             // 2. Includes
#define FOO "bar"             // 3. Defines
inherit "/obj/armour";        // 4. Inherit

int my_var;                   // 5. Globals & prototypes
void helper();                //    (forward prototype)

int query_foo() { return foo; } // 6. One-liner functions

void create()                 // 7. create()
{
  ::create();
  return;
}

void init()                   // 8. init()
{
  ::init();
  return;
}

void reset()                  // 9. reset()
{
  ::reset();
  return;
}

void helper()                 // 10. Other functions
{
  return;
}
```

## Bug Reports & Feature Requests

Submit issues at: https://github.com/locrian3k/3k-codestyle-vscode/issues

## License

MIT
