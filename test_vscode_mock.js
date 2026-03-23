module.exports = {
  CodeActionKind: { QuickFix: 'quickfix' },
  CodeAction: class { constructor(t, k) { this.title = t; this.kind = k; } },
  WorkspaceEdit: class { insert() {} replace() {} },
  Diagnostic: class { constructor(r, m, s) { this.range = r; this.message = m; this.severity = s; } },
  DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
  Position: class { constructor(l, c) { this.line = l; this.character = c; } },
  Range: class { constructor(s, e) { this.start = s; this.end = e; } },
  languages: { registerCodeActionsProvider: () => ({ dispose: () => {} }) },
};
