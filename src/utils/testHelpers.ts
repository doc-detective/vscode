import * as cp from 'child_process';
import { readFile } from 'fs/promises';
import * as vscode from 'vscode';

export function runDocDetectiveTest(file: string, cwd: string, resultsFolder: string): Promise<string> {
    return new Promise((resolve) => {
        const cmd = `npx doc-detective --input "${file}" --output ${resultsFolder}`;
        cp.exec(cmd, { cwd }, (error, stdout, stderr) => {
            resolve(stdout + stderr);
        });
    });
}

export async function extractLastJsonObject(resultsFilePath: string, outputChannel: vscode.OutputChannel): Promise<any> {
    const content = await readFile(resultsFilePath, 'utf-8');
    const matches = content.match(/\{[\s\S]*\}\s*$/m);
    if (!matches) {
        throw new Error('No valid JSON object found at end of file.');
    }

    try {
        return JSON.parse(matches[0]);
    } catch (err) {
        outputChannel.appendLine(`[Doc Detective Test Runner] Failed to parse JSON from file: ${resultsFilePath}`);
        outputChannel.appendLine(String(err));
        throw err;
    }
}