import * as vscode from 'vscode';
import type { WorkspaceIndex } from './workspaceIndex';

/**
 * Subscribes to WorkspaceIndex and surfaces parse errors as editor squiggles.
 * Errors are attributed to the correct source file even when they originate
 * from a stitched multi-file parse.
 */
export class DiagnosticsProvider implements vscode.Disposable {
  private readonly collection = vscode.languages.createDiagnosticCollection('dbmlx');
  private readonly disposables: vscode.Disposable[] = [this.collection];

  constructor(private readonly index: WorkspaceIndex) {
    this.disposables.push(index.onChange(() => this.refresh()));
    this.refresh();
  }

  public dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
  }

  private refresh(): void {
    this.collection.clear();
    for (const uri of this.index.getAllUris()) {
      const error = this.index.getFileError(uri);
      if (!error) continue;
      const line = Math.max(0, (error.line ?? 1) - 1);
      const col  = Math.max(0, (error.column ?? 1) - 1);
      const range = new vscode.Range(line, col, line, col + 1);
      const diag = new vscode.Diagnostic(range, error.message, vscode.DiagnosticSeverity.Error);
      diag.source = 'dbmlx';
      this.collection.set(uri, [diag]);
    }
  }
}
