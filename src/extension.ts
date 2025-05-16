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
    if (!this._view) { return; }
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
    const jsonString = JSON.stringify(jsonObj).replace(/</g, '\u003c');
    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Doc Detective Results</title>
        <style>
          body { font-family: monospace; margin: 0; padding: 0.5em; background: #1e1e1e; color: #d4d4d4; }
          .collapsible { cursor: pointer; }
          .content { display: block; margin-left: 1.5em; }
          li:not(.active) > .content { display: none; }
          .key { color: #9cdcfe; }
          .string { color: #ce9178; }
          .number { color: #b5cea8; }
          .boolean { color: #569cd6; }
          .null { color: #d4d4d4; }
          ul { list-style-type: none; margin: 0; padding: 0; }
          .bracket { color: #d4d4d4; }
          .comma { color: #666; }
        </style>
      </head>
      <body>
        <div id="json"></div>
        <script>
          const jsonObj = JSON.parse('' + '${jsonString}'.replace(/\\u003c/g, '<'));
          function escapeHTML(str) {
            return str.replace(/[&<>]/g, function(tag) {
              const chars = {'&':'&amp;','<':'&lt;','>':'&gt;'};
              return chars[tag] || tag;
            });
          }
          function renderJSON(obj, indent = 0, isLast = true) {
            const INDENT = '  ';
            const pad = (n) => INDENT.repeat(n);
            if (typeof obj !== 'object' || obj === null) {
              if (typeof obj === 'string') return '<span class="string">"' + escapeHTML(obj) + '"</span>';
              if (typeof obj === 'number') return '<span class="number">' + obj + '</span>';
              if (typeof obj === 'boolean') return '<span class="boolean">' + obj + '</span>';
              if (obj === null) return '<span class="null">null</span>';
              return obj;
            }
            if (Array.isArray(obj)) {
              if (obj.length === 0) return '<span class="bracket">[ ]</span>';
              let html = '<span class="bracket">[</span><ul>';
              for (let i = 0; i < obj.length; i++) {
                const value = obj[i];
                const last = i === obj.length - 1;
                if (typeof value === 'object' && value !== null) {
                  html += '<li class="active"><span class="collapsible">▼</span><div class="content">' + renderJSON(value, indent + 1, last) + '</div>' + (!last ? '<span class="comma">,</span>' : '') + '</li>';
                } else {
                  html += '<li>' + pad(indent + 1) + renderJSON(value, indent + 1, last) + (!last ? '<span class="comma">,</span>' : '') + '</li>';
                }
              }
              html += '</ul>' + pad(indent) + '<span class="bracket">]</span>';
              return html;
            } else {
              const keys = Object.keys(obj);
              if (keys.length === 0) return '<span class="bracket">{ }</span>';
              let html = '<span class="bracket">{</span><ul>';
              keys.forEach(function(key, idx) {
                const value = obj[key];
                const last = idx === keys.length - 1;
                if (typeof value === 'object' && value !== null) {
                  html += '<li class="active"><span class="collapsible">▼ <span class="key">' + escapeHTML(key) + '</span>: </span><div class="content">' + renderJSON(value, indent + 1, last) + '</div>' + (!last ? '<span class="comma">,</span>' : '') + '</li>';
                } else {
                  html += '<li>' + pad(indent + 1) + '<span class="key">' + escapeHTML(key) + '</span>: ' + renderJSON(value, indent + 1, last) + (!last ? '<span class="comma">,</span>' : '') + '</li>';
                }
              });
              html += '</ul>' + pad(indent) + '<span class="bracket">}</span>';
              return html;
            }
          }
          document.getElementById('json').innerHTML = renderJSON(jsonObj, 0, true);
          document.querySelectorAll('.collapsible').forEach(function(el) {
            el.addEventListener('click', function(e) {
              e.stopPropagation();
              var parent = el.parentElement;
              parent.classList.toggle('active');
              // Update only the arrow, not the key
              var arrow = el.childNodes[0];
              if (arrow && arrow.nodeType === Node.TEXT_NODE) {
                arrow.textContent = parent.classList.contains('active') ? '▼' : '▶';
              } else {
                // fallback: update whole text
                el.textContent = parent.classList.contains('active') ? '▼ ' + el.textContent.slice(2) : '▶ ' + el.textContent.slice(2);
              }
            });
          });
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
