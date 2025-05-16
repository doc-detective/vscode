// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
const { detectTests } = require('doc-detective-resolver');

// Create an output channel for logging
const outputChannel = vscode.window.createOutputChannel('Doc Detective');

// Tree item for open files
class OpenFileItem extends vscode.TreeItem {
  constructor(public readonly filePath: string) {
    super(filePath, vscode.TreeItemCollapsibleState.Collapsed);
    this.tooltip = filePath;
    this.description = filePath;
    this.resourceUri = vscode.Uri.file(filePath);
    this.iconPath = vscode.ThemeIcon.File;
  }
}

// Tree item for test
class TestItem extends vscode.TreeItem {
  constructor(public readonly label: string, public readonly parentFile: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.tooltip = `${label} (from ${parentFile})`;
    this.description = label;
    this.iconPath = new vscode.ThemeIcon('beaker');
  }
}

// TreeDataProvider for open files and their detected tests
class OpenFilesTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | void> = this._onDidChangeTreeData.event;

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!element) {
      // Root: list open files
      const editors = vscode.window.visibleTextEditors;
      const filePaths = editors
        .filter(e => e.document.uri.scheme === 'file')
        .map(e => e.document.uri.fsPath);
      const uniquePaths = Array.from(new Set(filePaths));
      return uniquePaths.map(fp => new OpenFileItem(fp));
    } else if (element instanceof OpenFileItem) {
      // Children: detected tests for this file
      try {
        const tests: any = await detectTests({ input: element.filePath });
        outputChannel.appendLine(`[${element.filePath}] Detected tests: ${JSON.stringify(tests, null, 2)}`);
        if (Array.isArray(tests)) {
          return tests.map((test: any) => new TestItem(test.name || String(test), element.filePath));
        }
      } catch (e) {
        outputChannel.appendLine(`[${element.filePath}] Error detecting tests: ${e}`);
        return [new vscode.TreeItem('Error detecting tests')];
      }
      return [];
    }
    return [];
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "doc-detective-vsc" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('doc-detective-vsc.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from doc-detective-vsc!');
	});

	context.subscriptions.push(disposable);

  // Register the TreeDataProvider for open files
  const openFilesProvider = new OpenFilesTreeDataProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('bareBonesView', openFilesProvider)
  );

  // Refresh the tree when visible editors change
  context.subscriptions.push(
    vscode.window.onDidChangeVisibleTextEditors(() => openFilesProvider.refresh())
  );

  // On activation, send the current file path if any
  if (vscode.window.activeTextEditor) {
    openFilesProvider.refresh();
  }

  context.subscriptions.push(outputChannel);
}

// This method is called when your extension is deactivated
export function deactivate() {}
