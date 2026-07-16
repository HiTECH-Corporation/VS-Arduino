import * as vscode from 'vscode';
import * as path from 'path';

const CORE_RELATIVE_ROOT = path.join('src', 'debugger', 'cortex-debug-core');

interface CortexDebugCoreModule {
    activate(context: vscode.ExtensionContext): unknown;
    deactivate(): void;
}

let coreModule: CortexDebugCoreModule | undefined;

export function activateCortexDebugCore(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel): void {
    const coreRoot = path.join(context.extensionPath, CORE_RELATIVE_ROOT);
    try {
        coreModule = require(path.join(coreRoot, 'dist', 'extension.js')) as CortexDebugCoreModule;
        coreModule.activate(createCoreExtensionContext(context, coreRoot));
        outputChannel.appendLine('Embedded Cortex-Debug core activated.');
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        outputChannel.appendLine(`Failed to activate embedded Cortex-Debug core: ${errorMessage}`);
        vscode.window.showErrorMessage(`VS Arduino: failed to start the embedded debugger core: ${errorMessage}`);
    }
}

export function deactivateCortexDebugCore(): void {
    coreModule?.deactivate();
    coreModule = undefined;
}

// The cortex-debug core resolves every asset (dist/grapher.bundle.js,
// resources/, support/, webview/) relative to its ExtensionContext paths.
// Re-rooting extensionPath/extensionUri keeps those lookups inside the
// embedded core folder while all other context members delegate to the host.
function createCoreExtensionContext(context: vscode.ExtensionContext, coreRoot: string): vscode.ExtensionContext {
    const coreUri = vscode.Uri.file(coreRoot);
    return new Proxy(context, {
        get(target, property) {
            if (property === 'extensionPath') { return coreRoot; }
            if (property === 'extensionUri') { return coreUri; }
            if (property === 'asAbsolutePath') {
                return (relativePath: string) => path.join(coreRoot, relativePath);
            }
            const value = Reflect.get(target, property, target);
            return typeof value === 'function' ? value.bind(target) : value;
        }
    });
}
