// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const doc = require("../doc-detective");
const path = require("path");
const fs = require("fs");

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  // The command has been defined in the package.json file
  // Now provide the implementation of the command with  registerCommand
  // The commandId parameter must match the command field in package.json
  let testAll = vscode.commands.registerCommand("doc-detective.test", () => {
    let config = setConfig(context);
    test(config);
  });
  context.subscriptions.push(testAll);
  let testSingle = vscode.commands.registerCommand(
    "doc-detective.test-single",
    () => {
      let config = setConfig(context);
      config.input = vscode.window.activeTextEditor.document.fileName;
      test(config);
    }
  );
  context.subscriptions.push(testSingle);
  let coverageAll = vscode.commands.registerCommand(
    "doc-detective.coverage",
    () => {
      let config = setConfig(context);
      coverage(config);
    }
  );
  context.subscriptions.push(coverageAll);
  let coverageSingle = vscode.commands.registerCommand(
    "doc-detective.coverage-single",
    () => {
      let config = setConfig(context);
      config.input = vscode.window.activeTextEditor.document.fileName;
      coverage(config);
    }
  );
  context.subscriptions.push(coverageSingle);
}

// This method is called when your extension is deactivated
function deactivate() {}

async function test(config) {
  let results;
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Doc Detective: Running tests.`,
      cancellable: false,
    },
    async (progress, token) => {
      results = await doc.run(config);
    }
  );
  vscode.window
    .showInformationMessage(`Doc Detective: Tests complete.`, ...["See report"])
    .then((item) => {
      if (item == "See report") {
        vscode.window.showTextDocument(vscode.Uri.file(config.output));
      }
    });
};

async function coverage(config) {
  let results;
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Doc Detective: Analyizing test coverage.`,
      cancellable: false,
    },
    async (progress, token) => {
      results = doc.coverage(config);
    }
  );
  // vscode.window.showInformationMessage('Analyizing test coverage.');
  // report = JSON.parse(report);
  vscode.window
    .showInformationMessage(
      `Doc Detective: Test coverage analysis complete.`,
      ...["See report"]
    )
    .then((item) => {
      if (item == "See report") {
        vscode.window.showTextDocument(vscode.Uri.file(config.coverageOutput));
      }
    });
}

function setConfig(context) {
  // Identify and prepare configuration
  let configPath;
  let workspacePath = vscode.workspace.workspaceFolders[0].uri.path;
  let extensionPath = context.storageUri.path;
  if (process.platform == "win32") {
    workspacePath = workspacePath.slice(1);
    extensionPath = extensionPath.slice(1);
  }
  let configPathSetting = vscode.workspace
    .getConfiguration()
    .get("docDetective.configPath");
  let concatPath = path.resolve(workspacePath, configPathSetting);
  if (fs.existsSync(configPathSetting)) {
    // Full path
    configPath = configPathSetting;
  } else if (fs.existsSync(concatPath)) {
    // Relative path
    configPath = concatPath;
  } else {
    // Fallback to extension defaults
    configPath = path.resolve(extensionPath, "./config.json");
  }
  let config = require("./config.json");
  // Iterate through relativr paths and prepend them with the current workspace path.
  const pathOptions = [
    "env",
    "input",
    "output",
    "setup",
    "cleanup",
    "coverageOutput",
    "testSuggestions.reportOutput",
    "mediaDirectory",
    "downloadDirectory",
    "failedTestDirectory",
  ];
  pathOptions.forEach((option) => {
    if (option.includes(".")) {
      let keys = option.split(".");
      if (
        config[keys[0]][keys[1]] &&
        (!fs.existsSync(config[keys[0]][keys[1]]) ||
          config[keys[0]][keys[1]] === ".")
      ) {
        config[keys[0]][keys[1]] = path.resolve(
          workspacePath,
          config[keys[0]][keys[1]]
        );
      }
    } else {
      if (
        config[option] &&
        (!fs.existsSync(config[option]) || config[option] === ".")
      ) {
        config[option] = path.resolve(workspacePath, config[option]);
      }
    }
  });
  return config;
}

module.exports = {
  activate,
  deactivate,
};
