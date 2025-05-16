// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
const { detectTests } = require('doc-detective-resolver');

// Create an output channel for logging
const outputChannel = vscode.window.createOutputChannel('Doc Detective');


// WebviewViewProvider for Doc Detective
class DocDetectiveWebviewViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'docDetectiveView';
  private _view?: vscode.WebviewView;

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true
    };
    // Initial render
    await this.updateWebview();

    // Listen for messages from the webview (if needed)
    webviewView.webview.onDidReceiveMessage(async (message) => {
      if (message.command === 'refresh') {
        await this.updateWebview();
      }
    });
  }

  public async updateWebview() {
    if (!this._view) return;
    // Get open files
    const editors = vscode.window.visibleTextEditors;
    const filePaths = editors
      .filter(e => e.document.uri.scheme === 'file')
      .map(e => e.document.uri.fsPath);
    const uniquePaths = Array.from(new Set(filePaths));
    // For each file, detect tests
    const results: Record<string, any> = {};
    for (const file of uniquePaths) {
      try {
        const suites = await detectTests({ config: { input: file } });
        results[file] = suites;
      } catch (e) {
        results[file] = { error: String(e) };
      }
    }
    // Render JSON in webview
    this._view.webview.html = this.getHtmlForWebview(results);
  }

  private getHtmlForWebview(jsonObj: any): string {
    const pretty = JSON.stringify(jsonObj, null, 2);
    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Doc Detective Results</title>
        <style>
          body { font-family: monospace; margin: 0; padding: 0.5em; background: #1e1e1e; color: #d4d4d4; }
          pre { white-space: pre-wrap; word-break: break-all; }
        </style>
      </head>
      <body>
        <pre id="json">${pretty}</pre>
        <script>
          const vscode = acquireVsCodeApi();
        </script>
      </body>
      </html>`;
  }
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "doc-detective-vsc" is now active!');

  const disposable = vscode.commands.registerCommand('doc-detective-vsc.helloWorld', () => {
    vscode.window.showInformationMessage('Hello World from doc-detective-vsc!');
  });
  context.subscriptions.push(disposable);


  // Register the WebviewViewProvider for the sidebar
  const provider = new DocDetectiveWebviewViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('docDetectiveView', provider)
  );

  // Refresh the webview when visible editors change
  context.subscriptions.push(
    vscode.window.onDidChangeVisibleTextEditors(() => provider.updateWebview())
  );

  // Hot-reload the webview when the active editor changes (switching tabs)
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => provider.updateWebview())
  );

  context.subscriptions.push(outputChannel);
}

// This method is called when your extension is deactivated
export function deactivate() {}
