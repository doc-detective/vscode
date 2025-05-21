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
          .yaml-indent { color: #555; }
          .yaml-dash { color: #666; }
          .toggle { color: #569cd6; }
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
          function renderYAML(obj, indent = 0, isArrayItem = false) {
            const INDENT = '  ';
            const pad = (n) => INDENT.repeat(n);
            
            if (typeof obj !== 'object' || obj === null) {
              if (typeof obj === 'string') return '<span class="string">' + escapeHTML(obj) + '</span>';
              if (typeof obj === 'number') return '<span class="number">' + obj + '</span>';
              if (typeof obj === 'boolean') return '<span class="boolean">' + obj + '</span>';
              if (obj === null) return '<span class="null">null</span>';
              return obj;
            }
            
            if (Array.isArray(obj)) {
              if (obj.length === 0) return '[]';
              let html = '<ul>';
              
              for (let i = 0; i < obj.length; i++) {
                const value = obj[i];
                const indentSpan = '<span class="yaml-indent">' + pad(indent) + '</span>';
                
                if (typeof value === 'object' && value !== null) {
                  html += '<li class="active">' + 
                          indentSpan + 
                          '<span class="collapsible"><span class="toggle">▼</span> <span class="yaml-dash">-</span></span>' +
                          '<div class="content">' + renderYAML(value, indent + 1, true) + '</div>' +
                          '</li>';
                } else {
                  html += '<li>' + indentSpan + '<span class="yaml-dash">-</span> ' + 
                          renderYAML(value, indent + 1, true) + '</li>';
                }
              }
              
              html += '</ul>';
              return html;
            } else {
              const keys = Object.keys(obj);
              if (keys.length === 0) return '{}';
              
              let html = '<ul>';
              keys.forEach(function(key) {
                const value = obj[key];
                const indentation = '<span class="yaml-indent">' + pad(indent) + '</span>';
                
                if (typeof value === 'object' && value !== null) {
                  html += '<li class="active">' + 
                          indentation +
                          '<span class="collapsible"><span class="toggle">▼</span> <span class="key">' + escapeHTML(key) + ':</span></span>' +
                          '<div class="content">' + renderYAML(value, indent + 1) + '</div>' +
                          '</li>';
                } else {
                  html += '<li>' + indentation + '<span class="key">' + 
                          escapeHTML(key) + ':</span> ' + renderYAML(value, indent + 1) + '</li>';
                }
              });
              
              html += '</ul>';
              return html;
            }
          }
          
          document.getElementById('json').innerHTML = renderYAML(jsonObj, 0);
          document.querySelectorAll('.collapsible').forEach(function(el) {
            el.addEventListener('click', function(e) {
              e.stopPropagation();
              var parent = el.parentElement;
              parent.classList.toggle('active');
              
              // Update the toggle arrow
              const toggleEl = el.querySelector('.toggle');
              if (toggleEl) {
                toggleEl.textContent = parent.classList.contains('active') ? '▼' : '▶';
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
