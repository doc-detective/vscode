// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const doc = require('doc-detective');
const path = require('path');
const fs = require('fs');
const { createNoSubstitutionTemplateLiteral } = require('typescript');

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "Doc Detective" is now active!');

	// Identify and prepare configuration
	// let configPath;
	// let workspacePath = vscode.workspace.workspaceFolders[0].uri.path;
	// let configPathSetting = vscode.workspace.getConfiguration().get('docDetective.configPath');
	// let concatPath = path.resolve(workspacePath, configPathSetting);

	// if (fs.existsSync(configPathSetting)) {
	// 	configPath = configPathSetting;
	// } else if (fs.existsSync(concatPath)) {
	// 	configPath = concatPath;
	// }
	let config = require("./config.json");
	// Iterate through relativr paths and prepend them with the current workspace path.
	let workspacePath = vscode.workspace.workspaceFolders[0].uri.path;
	if (process.platform == "win32") {
		workspacePath = workspacePath.slice(1);
	}
	console.log(workspacePath)
	const pathOptions = ["env", "input", "output", "setup", "cleanup", "coverageOutput", "testSuggestions.reportOutput", "mediaDirectory", "downloadDirectory", "failedTestDirectory"];
	pathOptions.forEach(option => {
		console.log(option)
		if (option.includes(".")) {
			let keys = option.split(".");
			console.log(keys)
			if (config[keys[0]][keys[1]] && (!fs.existsSync(config[keys[0]][keys[1]]) || config[keys[0]][keys[1]] === ".")) {
				config[keys[0]][keys[1]] = path.resolve(workspacePath, config[keys[0]][keys[1]])
			}
			console.log(config[keys[0]][keys[1]])
		} else {
			if (config[option] && (!fs.existsSync(config[option]) || config[option] === ".")) {
				config[option] = path.resolve(workspacePath, config[option])
			}
			console.log(config[option])
		}
	});

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('doc-detective.coverage-single', function () {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		vscode.window.showInformationMessage('Analyizing test coverage.');
		// console.log(vscode.workspace.getConfiguration().get('docDetective.configPath'));
		// if (!fs.existsSync())
		// vscode.window.showInformationMessage(vscode.workspace.workspaceFolders[0].uri.path);
		config.input = vscode.window.activeTextEditor.document.fileName;
		doc.coverage(config);
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
function deactivate() { }

module.exports = {
	activate,
	deactivate
}
