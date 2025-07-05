"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTestController = getTestController;
exports.activate = activate;
exports.deactivate = deactivate;
exports.selectRootFolder = selectRootFolder;
exports.getOrAskRootFolder = getOrAskRootFolder;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const testHelpers = __importStar(require("./utils/testHelpers"));
const { detectTests } = require('doc-detective-resolver');
const outputChannel = vscode.window.createOutputChannel('DocDetective Test Runner');
let testController;
const fileMap = new Map();
let discoverTimeout;
function scheduleDiscoverTests(docsFolder) {
    if (discoverTimeout) {
        clearTimeout(discoverTimeout);
    }
    discoverTimeout = setTimeout(() => {
        discoverTests(docsFolder);
    }, 500);
}
function getTestController() {
    return testController;
}
async function activate(context) {
    context.subscriptions.push(outputChannel);
    if (!testController) {
        testController = vscode.tests.createTestController('docDetectiveTestController', 'DocDetective Tests');
    }
    console.log('Activate - testController created');
    try {
        context.subscriptions.push(testController);
        context.subscriptions.push(vscode.commands.registerCommand('docDetectiveTestRunner.selectRootFolder', async () => {
            try {
                const rootFolder = await selectRootFolder(context);
                const config = getRunnerConfig(rootFolder);
                vscode.window.showInformationMessage(`Docs folder set to: ${config.docsFolder}`);
                await discoverTests(config.docsFolder);
            }
            catch (err) {
                vscode.window.showErrorMessage(err.message);
            }
        }));
        context.subscriptions.push(vscode.commands.registerCommand('docDetectiveTestRunner.clearRootFolder', async () => {
            await context.globalState.update('docDetectiveTestRunner.rootFolder', undefined);
            vscode.window.showInformationMessage('Doc Detective root folder has been cleared.');
        }));
        let rootFolder;
        try {
            rootFolder = await getOrAskRootFolder(context);
        }
        catch (err) {
            vscode.window.showErrorMessage('Please select a root folder to use Doc Detective Test Runner.');
            return;
        }
        const config = getRunnerConfig(rootFolder);
        await discoverTests(config.docsFolder);
        const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(config.docsFolder, '**/*.md'));
        watcher.onDidChange(uri => {
            outputChannel.appendLine(`[Doc Detective Test Runner] Markdown file changed: ${uri.fsPath}, scheduling test discovery...`);
            scheduleDiscoverTests(config.docsFolder);
        });
        watcher.onDidCreate(uri => {
            outputChannel.appendLine(`[Doc Detective Test Runner] Markdown file created: ${uri.fsPath}, scheduling test discovery...`);
            scheduleDiscoverTests(config.docsFolder);
        });
        watcher.onDidDelete(uri => {
            outputChannel.appendLine(`[Doc Detective Test Runner] Markdown file deleted: ${uri.fsPath}, scheduling test discovery...`);
            scheduleDiscoverTests(config.docsFolder);
        });
        context.subscriptions.push(watcher);
        testController.createRunProfile('Run', vscode.TestRunProfileKind.Run, async (request, token) => {
            outputChannel.appendLine('[Doc Detective Test Runner] Run handler called');
            const run = testController.createTestRun(request);
            const fileItems = [];
            if (request.include) {
                for (const item of request.include) {
                    if (fileMap.has(item.id)) {
                        fileItems.push(item);
                    }
                    else {
                        let parent = item.parent;
                        while (parent && !fileMap.has(parent.id)) {
                            parent = parent.parent;
                        }
                        if (parent && fileMap.has(parent.id) && !fileItems.includes(parent)) {
                            fileItems.push(parent);
                        }
                    }
                }
            }
            else {
                testController.items.forEach(item => fileItems.push(item));
            }
            for (const fileItem of fileItems) {
                const testResultsFileInfo = fileMap.get(fileItem.id);
                if (!testResultsFileInfo) {
                    continue;
                }
                run.started(testResultsFileInfo.item);
                for (const spec of testResultsFileInfo.specs) {
                    run.started(spec.item);
                    for (const test of spec.tests) {
                        run.started(test.item);
                        for (const step of test.steps) {
                            run.started(step.item);
                        }
                    }
                }
                try {
                    if (!fs.existsSync(config.resultsFolder)) {
                        fs.mkdirSync(config.resultsFolder);
                    }
                    fs.readdirSync(config.resultsFolder)
                        .filter(f => f.endsWith('.json'))
                        .forEach(f => fs.unlinkSync(path.join(config.resultsFolder, f)));
                    outputChannel.appendLine(`[Doc Detective Test Runner] Running: npx doc-detective --input "${fileItem.id}" --output "${config.resultsFolder}"`);
                    const testResultsSummary = await testHelpers.runDocDetectiveTest(fileItem.id, rootFolder, config.resultsFolder);
                    outputChannel.appendLine(`[Doc Detective Test Runner] Summary output for ${fileItem.id}:
  ${testResultsSummary}`);
                    const latestTestResultFilePath = getLatestTestResultsFile(config.resultsFolder);
                    outputChannel.appendLine(`[Doc Detective Test Runner] getLatestTestResultsFile returned: ${latestTestResultFilePath}`);
                    if (!latestTestResultFilePath) {
                        outputChannel.appendLine('Failed to get latest test results file');
                        continue;
                    }
                    const extractedTestResults = await testHelpers.extractLastJsonObject(latestTestResultFilePath, outputChannel);
                    if (!extractedTestResults) {
                        run.failed(testResultsFileInfo.item, new vscode.TestMessage('No test results found'));
                        continue;
                    }
                    run.appendOutput(`[Doc Detective Test Runner] Completed run for file "${fileItem.id}". Test results for this file are available in the test runner and at "${latestTestResultFilePath}"`, undefined, testResultsFileInfo.item);
                    if (Array.isArray(extractedTestResults.specs)) {
                        for (let specIdx = 0; specIdx < extractedTestResults.specs.length; specIdx++) {
                            const spec = extractedTestResults.specs[specIdx];
                            const specRef = testResultsFileInfo.specs[specIdx];
                            if (!specRef) {
                                continue;
                            }
                            if (Array.isArray(spec.tests)) {
                                for (let testIdx = 0; testIdx < spec.tests.length; testIdx++) {
                                    const test = spec.tests[testIdx];
                                    const testRef = specRef.tests[testIdx];
                                    if (!testRef) {
                                        continue;
                                    }
                                    if (test.result === 'PASS') {
                                        run.passed(testRef.item);
                                    }
                                    else {
                                        run.failed(testRef.item, new vscode.TestMessage(test.resultDescription || 'Test failed'));
                                    }
                                    const steps = test.contexts?.[0]?.steps || test.steps || [];
                                    for (let stepIdx = 0; stepIdx < steps.length; stepIdx++) {
                                        const step = steps[stepIdx];
                                        const stepRef = testRef.steps[stepIdx];
                                        if (!stepRef) {
                                            continue;
                                        }
                                        if (step.result === 'PASS') {
                                            run.passed(stepRef.item);
                                        }
                                        else {
                                            run.failed(stepRef.item, new vscode.TestMessage(step.resultDescription || 'Step failed'));
                                        }
                                    }
                                }
                            }
                        }
                    }
                    else {
                        run.failed(testResultsFileInfo.item, new vscode.TestMessage('Malformed results'));
                    }
                }
                catch (err) {
                    run.failed(testResultsFileInfo.item, new vscode.TestMessage(err?.message || String(err)));
                }
            }
            run.end();
            outputChannel.appendLine('[Doc Detective Test Runner] Run ended');
        }, true);
    }
    catch (error) {
        console.error("An error occurred during extension activation: ", error);
        console.log("Activate - Returning testController: ", testController);
        return { testController, getTestController: () => testController };
    }
    console.log("Activate - Activation successful. Returning testController: ", testController);
    return { testController, getTestController: () => testController };
}
function deactivate() {
    if (testController) {
        testController.dispose();
    }
}
async function selectRootFolder(context) {
    const folderUris = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select your root folder (Workspace Root)',
    });
    if (!folderUris || folderUris.length === 0) {
        throw new Error('Root folder not selected.');
    }
    const selectedFolder = folderUris[0].fsPath;
    await context.globalState.update('docDetectiveTestRunner.rootFolder', selectedFolder);
    return selectedFolder;
}
async function getOrAskRootFolder(context) {
    const savedRootFolder = context.globalState.get('docDetectiveTestRunner.rootFolder');
    return savedRootFolder ?? await selectRootFolder(context);
}
function getRunnerConfig(rootFolder) {
    const configPath = path.join(rootFolder, '.docDetectiveTestRunnerConfig.json');
    try {
        const raw = fs.readFileSync(configPath, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
            docsFolder: path.join(rootFolder, parsed.docsFolder || 'docs'),
            resultsFolder: path.join(rootFolder, parsed.resultsFolder || 'results'),
        };
    }
    catch (err) {
        vscode.window.showErrorMessage(`[Doc Detective Test Runner] Failed to read config file at ${configPath}: ${err}`);
        return {
            docsFolder: path.join(rootFolder, 'docs'),
            resultsFolder: path.join(rootFolder, 'results')
        };
    }
}
function sanitize(id) {
    if (!id) {
        return '';
    }
    return id.trim().replace(/[\r\n]/g, '');
}
async function discoverTests(docsFolder) {
    outputChannel.appendLine('[Doc Detective Test Runner] discoverTests() called');
    testController.items.replace([]);
    fileMap.clear();
    const pattern = new vscode.RelativePattern(docsFolder, '**/*.md');
    const allMatches = await vscode.workspace.findFiles(pattern, '**/node_modules/**');
    outputChannel.appendLine('[Doc Detective Test Runner] Discovering tests in docs folder: ' + docsFolder);
    allMatches.forEach(uri => outputChannel.appendLine(` - ${uri.fsPath}`));
    for (const file of allMatches) {
        try {
            const suites = await detectTests({ config: { input: file.fsPath } });
            outputChannel.appendLine('[Doc Detective Test Runner] Suites for ' + file.fsPath + ': ' + JSON.stringify(suites));
            const fileUri = vscode.Uri.file(file.fsPath);
            const fileLabel = path.basename(file.fsPath);
            const fileItem = testController.createTestItem(file.fsPath, fileLabel, fileUri);
            testController.items.add(fileItem);
            const fileRef = {
                id: file.fsPath,
                item: fileItem,
                specs: []
            };
            for (const suite of suites) {
                const specName = sanitize(suite.name || suite.id || suite.specId || 'spec');
                const specLabel = suite.name || suite.specId || suite.id || 'Spec';
                const specId = `${file.fsPath}::${specName}`;
                const specItem = testController.createTestItem(specId, specLabel, fileUri);
                fileItem.children.add(specItem);
                const specRef = {
                    id: specId,
                    item: specItem,
                    tests: []
                };
                if (suite.tests && Array.isArray(suite.tests)) {
                    for (const test of suite.tests) {
                        const testName = sanitize(test.name || test.id || test.testId || 'test');
                        const testLabel = test.name || test.testId || test.id || 'Test';
                        const testId = `${specId}::${testName}`;
                        const testItem = testController.createTestItem(testId, testLabel, fileUri);
                        specItem.children.add(testItem);
                        const testRef = {
                            id: testId,
                            item: testItem,
                            steps: []
                        };
                        if (test.steps && Array.isArray(test.steps)) {
                            const updatedStepItems = [];
                            test.steps.forEach((step, idx) => {
                                const action = Object.keys(step).find(k => !['stepId', 'result', 'resultDescription', 'outputs'].includes(k));
                                const value = action
                                    ? (typeof step[action] === 'object'
                                        ? JSON.stringify(step[action])
                                        : step[action])
                                    : '';
                                const stepLabel = action ? `${action} ${value}` : `Step ${idx + 1}`;
                                const stepId = `${testId}::step${idx}`;
                                const stepItem = testController.createTestItem(stepId, stepLabel, fileUri);
                                updatedStepItems.push(stepItem);
                                testRef.steps.push({
                                    id: stepId,
                                    item: stepItem
                                });
                            });
                            outputChannel.appendLine(`[Doc Detective Test Runner] Updating steps for test: ${testId}`);
                            updatedStepItems.forEach(item => {
                                outputChannel.appendLine(` - ${item.id}: ${item.label}`);
                            });
                            outputChannel.appendLine(`[Doc Detective Test Runner] Existing step items for ${testId}:`);
                            testItem.children.forEach(child => {
                                outputChannel.appendLine(`   - ${child.id}: ${child.label}`);
                            });
                            testItem.children.replace(updatedStepItems);
                        }
                        specRef.tests.push(testRef);
                    }
                }
                fileRef.specs.push(specRef);
            }
            fileMap.set(file.fsPath, fileRef);
        }
        catch (e) {
            outputChannel.appendLine(`[Doc Detective Test Runner] Error processing ${file.fsPath}: ${e}`);
            const fileUri = vscode.Uri.file(file.fsPath);
            const fileLabel = path.basename(file.fsPath);
            const fileItem = testController.createTestItem(file.fsPath, fileLabel, fileUri);
            fileItem.error = String(e);
            testController.items.add(fileItem);
        }
    }
}
function getLatestTestResultsFile(testResultsFolder) {
    const files = fs.readdirSync(testResultsFolder)
        .filter(f => f.toLowerCase().endsWith('.json'))
        .map(f => ({ file: f, mtime: fs.lstatSync(path.join(testResultsFolder, f)).mtime }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    if (!files.length) {
        outputChannel.appendLine('[Doc Detective Test Runner] No JSON test results found.');
        return '';
    }
    const latest = path.join(testResultsFolder, files[0].file);
    outputChannel.appendLine(`[Doc Detective Test Runner] Found latest results file: ${latest}`);
    return latest;
}
