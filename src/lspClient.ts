// Doc Detective language-server client.
//
// Launches the `doc-detective lsp --stdio` server and wires it to VS Code so a
// spec author gets live diagnostics, completion, and hover — the same schema
// knowledge the runner validates against, surfaced while editing.
//
// Resolution order (a workspace's pinned version wins):
//   1. the `docDetective.languageServer.path` setting, if set (a bin/JS entry);
//   2. a project-local install (node_modules/doc-detective);
//   3. `npx --yes doc-detective` — zero-install fallback.
// The first two run as a `module` through vscode-languageclient, which executes
// it with the extension host's Node (no shell, no PATH/cwd resolution). The npx
// fallback spawns `npx` from PATH; the server needs the `lsp` subcommand, which
// ships with doc-detective's language-server feature.

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
  Executable,
} from 'vscode-languageclient/node';

const LSP_ARGS = ['lsp', '--stdio'];

let client: LanguageClient | undefined;

/** A JS entry to run via Node (the server bin, or npx-cli.js). */
interface NodeLaunch {
  module: string;
  args: string[];
}

/** Walk up `node_modules` from `startDir` for a project-local doc-detective bin. */
function resolveLocalBin(startDir: string): NodeLaunch | null {
  let dir = startDir;
  for (;;) {
    const pkgDir = path.join(dir, 'node_modules', 'doc-detective');
    const pkgJson = path.join(pkgDir, 'package.json');
    if (fs.existsSync(pkgJson)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgJson, 'utf8'));
        // `bin` may be a string or a map; only a string or the `doc-detective`
        // key is a real path — never the whole map object.
        const rel =
          (typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.['doc-detective']) ||
          'bin/doc-detective.js';
        const bin = path.join(pkgDir, rel);
        if (fs.existsSync(bin)) {
          return { module: bin, args: [...LSP_ARGS] };
        }
      } catch {
        /* malformed local install — fall through to the npx fallback */
      }
      return null;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {return null;} // reached the filesystem root
    dir = parent;
  }
}

/** The first workspace folder's path, used as the server's cwd (config lookup). */
function workspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

/**
 * Build the server launch spec. Prefers a configured/local Node module (run
 * safely via the client); falls back to spawning `npx`.
 */
function buildServerOptions(cwd: string | undefined): ServerOptions {
  const options = cwd ? { cwd } : undefined;

  const configured = vscode.workspace
    .getConfiguration('docDetective')
    .get<string>('languageServer.path')
    ?.trim();

  const launch: NodeLaunch | null = configured
    ? { module: configured, args: [...LSP_ARGS] }
    : resolveLocalBin(cwd ?? process.cwd());

  if (launch) {
    const node = {
      module: launch.module,
      args: launch.args,
      transport: TransportKind.stdio,
      options,
    };
    return { run: node, debug: node };
  }

  // Zero-install fallback: spawn npx from PATH.
  const npx: Executable = {
    command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
    args: ['--yes', 'doc-detective', ...LSP_ARGS],
    transport: TransportKind.stdio,
    options,
  };
  return { run: npx, debug: npx };
}

/**
 * Start the language server, unless disabled by
 * `docDetective.languageServer.enable`. Idempotent-ish: a second call is a
 * no-op while a client is running. The server is stopped via `deactivate()`
 * (and the settings-change handler stops it before restarting), so no
 * per-start subscription is registered — that would accumulate on each restart.
 */
export async function startLanguageServer(
  log: (message: string) => void,
): Promise<void> {
  if (client) {return;}

  const enabled = vscode.workspace
    .getConfiguration('docDetective')
    .get<boolean>('languageServer.enable', true);
  if (!enabled) {
    log('Language server disabled via docDetective.languageServer.enable.');
    return;
  }

  const cwd = workspaceRoot();
  const serverOptions = buildServerOptions(cwd);

  const clientOptions: LanguageClientOptions = {
    // The server's own detection gate stays silent on non-Doc-Detective files,
    // so a broad selector is safe: standalone specs/config by glob, inline
    // tests by markup language.
    documentSelector: [
      { scheme: 'file', pattern: '**/*.spec.json' },
      { scheme: 'file', pattern: '**/*.spec.yaml' },
      { scheme: 'file', pattern: '**/*.spec.yml' },
      { scheme: 'file', pattern: '**/.doc-detective.json' },
      { scheme: 'file', pattern: '**/.doc-detective.yaml' },
      { scheme: 'file', pattern: '**/.doc-detective.yml' },
      { scheme: 'file', language: 'markdown' },
      { scheme: 'file', language: 'asciidoc' },
      { scheme: 'file', language: 'html' },
    ],
  };

  // Hold the client in a local so a concurrent restart (the settings-change
  // handler) reassigning the module-level `client` mid-await can't make us
  // start or clear the wrong instance.
  const started = new LanguageClient(
    'docDetectiveLsp',
    'Doc Detective Language Server',
    serverOptions,
    clientOptions,
  );
  client = started;

  try {
    log('Starting Doc Detective language server…');
    await started.start();
    log('Doc Detective language server started.');
  } catch (error) {
    // A missing/old CLI (no `lsp` subcommand) shouldn't break the rest of the
    // extension — surface it and carry on. Only clear `client` if it is still
    // this instance; a restart may already have replaced it.
    log(`Doc Detective language server failed to start: ${error}`);
    if (client === started) {
      client = undefined;
    }
  }
}

/** Stop the language server if running. */
export async function stopLanguageServer(): Promise<void> {
  const running = client;
  client = undefined;
  if (running) {
    try {
      await running.stop();
    } catch {
      // The server may already be gone (crashed / never fully started);
      // there's nothing left to clean up, and this runs from a fire-and-forget
      // config listener and from deactivate(), so don't surface a rejection.
    }
  }
}
