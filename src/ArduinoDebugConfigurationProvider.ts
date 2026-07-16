import * as vscode from 'vscode';
import * as path from 'path';
import { ArduinoCliManager } from './ArduinoCliManager';

export class ArduinoDebugConfigurationProvider implements vscode.DebugConfigurationProvider {
    constructor(private cliManager: ArduinoCliManager, private outputChannel: vscode.OutputChannel) {}

    async resolveDebugConfiguration(folder: vscode.WorkspaceFolder | undefined, config: vscode.DebugConfiguration, token?: vscode.CancellationToken): Promise<vscode.DebugConfiguration | undefined> {
        // We need a workspace folder
        if (!folder) {
            vscode.window.showErrorMessage('Please open a folder containing your Arduino sketch to debug.');
            return undefined;
        }

        const workspaceConfig = vscode.workspace.getConfiguration('vs-arduino');
        const board = workspaceConfig.get<string>('board');
        const programmer = workspaceConfig.get<string>('programmer');
        const port = workspaceConfig.get<string>('port');
        
        if (!board || board === 'Select Board') {
            vscode.window.showErrorMessage('Please select an Arduino Board before debugging.');
            return undefined;
        }

        // Sanitize path for Windows to avoid 'Invalid escape sequence' in cppdbg
        const sketchPath = folder.uri.fsPath.replace(/\\/g, '/');
        const buildPath = path.join(folder.uri.fsPath, 'build');

        try {
            this.outputChannel.appendLine(`\n--- Fetching debug info for ${board} ---`);
            const debugInfo = await this.cliManager.getDebugInfo(board, sketchPath, programmer, port, buildPath);
            
            if (!debugInfo || !debugInfo.executable) {
                vscode.window.showErrorMessage('Board does not support debugging, or failed to get debug info.');
                return undefined;
            }

            const exeSuffix = process.platform === 'win32' ? '.exe' : '';
            let toolchainPath = debugInfo.toolchain_path ? debugInfo.toolchain_path.replace(/\\/g, '/') : '';

            const scriptsDir = debugInfo.server_configuration?.scripts_dir ? [debugInfo.server_configuration.scripts_dir.replace(/\\/g, '/')] : [];
            const scripts = (debugInfo.server_configuration?.scripts || []).map((s: string) => s.replace(/\\/g, '/'));

            const cortexDebugConfig = debugInfo.custom_configs?.['cortex-debug'] || {};
            const requestType = cortexDebugConfig.request || 'launch';

            const postAttachCommands = (cortexDebugConfig.postAttachCommands || [])
                .filter((cmd: string) => cmd !== 'c' && cmd !== 'continue');
            // runToEntryPoint only applies to launch requests. For attach requests,
            // run past the core static initializers and stop in the user's sketch,
            // so VS Code never auto-opens core files like IPAddress.cpp or main.cpp.
            if (requestType === 'attach') {
                postAttachCommands.push('tbreak setup', 'continue');
            }

            const debugConfig: vscode.DebugConfiguration = {
                type: 'vs-arduino-cortex-debug',
                request: requestType,
                name: config.name || 'Arduino Debug',
                executable: debugInfo.executable ? debugInfo.executable.replace(/\\/g, '/') : '',
                cwd: sketchPath,
                servertype: debugInfo.server || 'openocd',
                serverpath: debugInfo.server_path ? debugInfo.server_path.replace(/\\/g, '/') : '',
                armToolchainPath: toolchainPath,
                searchDir: scriptsDir,
                configFiles: scripts,
                svdFile: debugInfo.svd_file ? debugInfo.svd_file.replace(/\\/g, '/') : '',
                overrideRestartCommands: (cortexDebugConfig.overrideRestartCommands || []).filter((cmd: string) => cmd !== 'c' && cmd !== 'continue'),
                postAttachCommands,
                runToEntryPoint: 'setup',
                breakAfterReset: false,
                showDevDebugOutput: 'raw'
            };

            // Start debugging with the new configuration
            setTimeout(() => {
                vscode.debug.startDebugging(folder, debugConfig);
            }, 100);
            
            return undefined;

        } catch (error) {
            this.outputChannel.appendLine(`Debug info error: ${error}`);
            vscode.window.showErrorMessage('Failed to initialize debug session. Board might not support debugging. See output for details.');
            return undefined;
        }
    }
}
