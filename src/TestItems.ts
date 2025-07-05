import * as vscode from 'vscode';
// Helper to store the test tree for mapping results
export interface StepRef {
    id: string;
    item: vscode.TestItem;
}
export interface TestRef {
    id: string;
    item: vscode.TestItem;
    steps: StepRef[];
}
export interface SpecRef {
    id: string;
    item: vscode.TestItem;
    tests: TestRef[];
}
export interface FileRef {
    id: string;
    item: vscode.TestItem;
    specs: SpecRef[];
}