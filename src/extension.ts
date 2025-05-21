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

  // Check if the view is available
  public hasView(): boolean {
    return !!this._view;
  }

  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')]
    };
    
    // Set content security policy for the webview
    // Allow inline styles and scripts, as well as VS Code's webview CSS
    webviewView.webview.html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https:; script-src 'unsafe-inline';">
        <title>Loading Doc Detective...</title>
      </head>
      <body>
        <div>Loading Doc Detective...</div>
      </body>
      </html>
    `;
    
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
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https:; script-src 'unsafe-inline';">
        <title>Doc Detective Results</title>
        <style>
          :root {
            --background: var(--vscode-editor-background);
            --foreground: var(--vscode-editor-foreground);
            --key-color: var(--vscode-symbolIcon-propertyForeground, var(--vscode-debugTokenExpression-name, #9cdcfe));
            --string-color: var(--vscode-debugTokenExpression-string, #ce9178);
            --number-color: var(--vscode-debugTokenExpression-number, #b5cea8);
            --boolean-color: var(--vscode-debugTokenExpression-boolean, #569cd6);
            --indent-color: var(--vscode-editorIndentGuide-background, #555);
            --dash-color: var(--vscode-editorIndentGuide-activeBackground, #666);
            --toggle-color: var(--vscode-editorLink-activeForeground, #569cd6);
          }
          
          body { 
            font-family: var(--vscode-editor-font-family, monospace); 
            margin: 0; 
            padding: 0.5em; 
            background: var(--background); 
            color: var(--foreground);
            font-size: var(--vscode-editor-font-size, 14px);
            line-height: 1.5;
          }
          
          .collapsible { cursor: pointer; }
          
          .content { 
            display: block; 
            margin-left: 1.5em; 
          }
          
          li:not(.active) > .content { 
            display: none; 
          }
          
          .key { 
            color: var(--key-color); 
            font-weight: var(--vscode-font-weight, normal);
          }
          
          .string { 
            color: var(--string-color); 
          }
          
          .number { 
            color: var(--number-color); 
          }
          
          .boolean { 
            color: var(--boolean-color); 
          }
          
          .null { 
            color: var(--foreground);
            opacity: 0.7; 
          }
          
          ul { 
            list-style-type: none; 
            margin: 0; 
            padding: 0; 
          }
          
          .yaml-indent { 
            color: var(--indent-color); 
          }
          
          .yaml-dash { 
            color: var(--dash-color); 
          }
          
          .toggle { 
            color: var(--toggle-color);
            display: inline-block;
            width: 1em;
            text-align: center;
          }
          
          .simple-obj { 
            margin-left: 1.5em;
            padding-left: 0.5em;
            border-left: 1px solid var(--indent-color);
          }
          
          /* Basic styling */
          .collapsible {
            transition: opacity 0.1s;
          }
          
          li {
            padding: 1px 0;
          }
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
          
          // Helper function to check if an object has nested objects/arrays
          function hasNestedObjects(obj) {
            if (typeof obj !== 'object' || obj === null) return false;
            
            if (Array.isArray(obj)) {
              return obj.some(item => typeof item === 'object' && item !== null);
            } else {
              return Object.values(obj).some(val => typeof val === 'object' && val !== null);
            }
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
                  if (Array.isArray(value)) {
                    // Array inside array
                    html += '<li>' + indentSpan + '<span class="yaml-dash">-</span> ' + 
                            renderYAML(value, indent + 1, true) + '</li>';
                  } else {
                    // Object inside array
                    const keys = Object.keys(value);
                    if (keys.length === 0) {
                      html += '<li>' + indentSpan + '<span class="yaml-dash">-</span> {}</li>';
                    } else {
                      const hasNested = hasNestedObjects(value);
                      const firstKey = keys[0];

                      if (hasNested) {
                        // This is a complex object with nested properties
                        // Use triangle toggle INSTEAD OF dash marker
                        html += '<li class="active">' + indentSpan + 
                                '<span class="collapsible"><span class="toggle">▼</span> <span class="key">' + 
                                escapeHTML(firstKey) + ':</span></span>';

                        if (typeof value[firstKey] === 'object' && value[firstKey] !== null) {
                          // First value is also an object
                          html += '<div class="content">' + renderYAML(value[firstKey], indent + 1) + '</div>';
                        } else {
                          // First value is a primitive
                          html += ' ' + renderYAML(value[firstKey], 0);
                          html += '<div class="content">';
                          for (let k = 1; k < keys.length; k++) {
                            html += '<div>' + 
                                    '<span class="yaml-indent">' + pad(indent + 1) + '</span>' +
                                    '<span class="key">' + escapeHTML(keys[k]) + ':</span> ' + 
                                    renderYAML(value[keys[k]], 0) + '</div>';
                          }
                          html += '</div>';
                        }
                      } else {
                        // Simple object - use dash marker
                        html += '<li>' + indentSpan + '<span class="yaml-dash">-</span> ' +
                                '<span class="key">' + escapeHTML(firstKey) + ':</span> ' +
                                renderYAML(value[firstKey], 0);
                        
                        if (keys.length > 1) {
                          html += '<div class="simple-obj">';
                          for (let k = 1; k < keys.length; k++) {
                            html += '<div>' + 
                                    '<span class="key">' + escapeHTML(keys[k]) + ':</span> ' + 
                                    renderYAML(value[keys[k]], 0) + '</div>';
                          }
                          html += '</div>';
                        }
                      }
                    }
                  }
                } else {
                  // Simple value in array
                  html += '<li>' + indentSpan + '<span class="yaml-dash">-</span> ' + 
                          renderYAML(value, 0, true) + '</li>';
                }
                html += '</li>';
              }
              
              html += '</ul>';
              return html;
            } else {
              // It's an object
              const keys = Object.keys(obj);
              if (keys.length === 0) return '{}';
              
              let html = '<ul>';
              keys.forEach(function(key) {
                const value = obj[key];
                const indentation = '<span class="yaml-indent">' + pad(indent) + '</span>';
                
                if (typeof value === 'object' && value !== null && (hasNestedObjects(value) || Array.isArray(value))) {
                  // Object with nested structure - use triangle
                  html += '<li class="active">' + indentation +
                          '<span class="collapsible"><span class="toggle">▼</span> <span class="key">' + 
                          escapeHTML(key) + ':</span></span>' +
                          '<div class="content">' + renderYAML(value, indent + 1, Array.isArray(value)) + '</div>' +
                          '</li>';
                } else {
                  // Simple key-value
                  html += '<li>' + indentation + '<span class="key">' + 
                          escapeHTML(key) + ':</span> ' + renderYAML(value, 0) + '</li>';
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

          // Handle theme changes
          window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'vscode-theme-updated') {
              // No need to do anything special - CSS vars will update automatically
              console.log('Theme updated');
            }
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

  // Update when the color theme changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveColorTheme(() => {
      if (provider.hasView()) {
        provider.updateWebview();
      }
    })
  );

  context.subscriptions.push(outputChannel);
}

// This method is called when your extension is deactivated
export function deactivate() {}
