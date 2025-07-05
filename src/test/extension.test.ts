import { suite, test, suiteSetup, suiteTeardown } from 'mocha';
import * as assert from 'assert';
import * as vscode from 'vscode';
import path from 'path';
import sinon from 'sinon';

const rootFolder = path.resolve('../../');
const fixturesFolder = path.join(rootFolder, 'src/test/fixtures');
const docsFolder = path.join(fixturesFolder, 'docs');
const testFileName = "account-creation.md";

// using helper methods because of problems with beforeEach()
async function getActivatedExtension(): Promise<vscode.Extension<any>> {
	const extension = vscode.extensions.getExtension('DocDetective.test-runner');
	if (!extension) {
		throw new Error('Extension not found');
	}

	if (!extension.isActive) {
		await extension.activate();
	}

	return extension;
}

async function getTestController(): Promise<vscode.TestController> {
	const extension = await getActivatedExtension();
	const exported = extension.exports;

	if (typeof exported?.getTestController === 'function') {
		return exported.getTestController();
	}

	throw new Error('getTestController() not found in extension exports');
}

async function waitForTestCompletion(controller: vscode.TestController, timeoutMs = 10000): Promise<void> {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		const allIdle = [...controller.items].every(([id, testItem]) => !testItem.busy);
		if (allIdle) { return; }
		await new Promise(resolve => setTimeout(resolve, 200));
	}
	throw new Error('Timeout waiting for tests to complete');
}

suite('Doc Detective Test Runner Extension Suite', () => {
	vscode.window.showInformationMessage('Starting Doc Detective Test Runner tests');

	let showOpenDialogStub: sinon.SinonStub;

	suiteSetup(() => {
		// we don't want the folder picker dialog to open during test runs
		showOpenDialogStub = sinon.stub(vscode.window, 'showOpenDialog').resolves([
			vscode.Uri.file(path.resolve(fixturesFolder))]);
	});

	suiteTeardown(() => {
		showOpenDialogStub.restore();
	});

	test('Extension should be activated', async function () {
		this.timeout(10000);

		const extension = vscode.extensions.getExtension('DocDetective.test-runner');
		if (!extension) {
			throw new Error('Extension should be found');
		}

		if (!extension.isActive) {
			await extension.activate();
		}

		assert.ok(extension.isActive, 'Extension should be activated');
	});

	test('Commands should be registered', async () => {
		const commands = await vscode.commands.getCommands(true);

		assert.ok(commands.includes('docDetectiveTestRunner.selectRootFolder'), 'selectRootFolder command not found');
		assert.ok(commands.includes('docDetectiveTestRunner.clearRootFolder'), 'clearRootFolder command not found');
	});

	test('Test controller should be registered', async () => {
		// Activate the extension
		const extension = getActivatedExtension();
		const controller = getTestController();
		assert.ok(extension, 'Extension not found');

		// Verify the extension is active
		assert.ok((await extension).isActive, 'Extension should be active');

		// Check if the controller is available
		assert.ok(controller, 'Test controller should be available');
	});

	test('Test discovery populates test items', async () => {
		const fakeDocsUri = vscode.Uri.file(docsFolder);

		await vscode.workspace.openTextDocument(path.join(fakeDocsUri.fsPath, testFileName));

		// wait for debounce & async ops
		await new Promise(resolve => setTimeout(resolve, 1000));

		assert.ok((await getTestController()).items.size > 0, 'No test items discovered');
	});
});

suite('Markdown Test Suite', () => {
	test('Should discover and run tests with one failure', async function () {
		this.timeout(10000);

		const extension = vscode.extensions.getExtension('DocDetective.test-runner');
		assert.ok(extension);
		await extension.activate();

		const filePath = path.join(docsFolder, testFileName);
		const doc = await vscode.workspace.openTextDocument(filePath);
		await vscode.window.showTextDocument(doc);

		const controller = await getTestController();
		assert.ok(controller);

		await vscode.commands.executeCommand('testing.run', [vscode.Uri.file(filePath)]);

		// Wait for test run to finish by polling busy state
		await waitForTestCompletion(controller);

		// Add your assertions here
	});

});
