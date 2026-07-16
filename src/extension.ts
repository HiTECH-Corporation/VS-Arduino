import * as vscode from 'vscode';
import * as path from 'path';
import { ArduinoCliManager } from './ArduinoCliManager';
import { ControlPanelProvider } from './ControlPanelProvider';
import { IntelliSenseManager } from './IntelliSenseManager';
import { PackageManagerWebview } from './PackageManagerWebview';
import { SerialConnectionManager } from './SerialConnectionManager';
import { SerialMonitorProvider } from './SerialMonitorProvider';
import { SerialPlotterProvider } from './SerialPlotterProvider';
import { ArduinoDebugConfigurationProvider } from './ArduinoDebugConfigurationProvider';
import { activateCortexDebugCore, deactivateCortexDebugCore } from './debugger/CortexDebugCore';

let outputChannel: vscode.OutputChannel;
let statusBarBoard: vscode.StatusBarItem;
let statusBarPort: vscode.StatusBarItem;
let controlPanelProvider: ControlPanelProvider;

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel("VS Arduino");
    context.subscriptions.push(outputChannel);
    outputChannel.appendLine('VS Arduino extension activated.');

    // The Cortex-Debug core ships inside this extension — activate it directly.
    activateCortexDebugCore(context, outputChannel);

    // Warn if official cortex-debug is also installed (conflict risk)
    const officialCortexDebug = vscode.extensions.getExtension('marus25.cortex-debug');
    if (officialCortexDebug) {
        vscode.window.showWarningMessage('You have the official Cortex-Debug extension (marus25) installed, which may conflict with the built-in version of VS Arduino. Please disable or uninstall it for the best experience.');
    }

    const cliManager = new ArduinoCliManager(context, outputChannel);
    cliManager.initialize().then(async () => {
        // Auto-detect after initialization
        const detected = await cliManager.autoDetectBoardAndPort();
        if (detected) {
            const config = vscode.workspace.getConfiguration('vs-arduino');
            await config.update('port', detected.port, vscode.ConfigurationTarget.Global);
            await config.update('board', detected.boardFqbn, vscode.ConfigurationTarget.Global);
            await config.update('boardName', detected.boardName, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Auto-detected ${detected.boardName} on ${detected.port}`);
        }
    }).catch(err => {
        const errorMsg = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`Initialization error: ${errorMsg}`);
        vscode.window.showErrorMessage(`VS Arduino Initialization error: ${errorMsg}`);
    });

    const intelliSenseManager = new IntelliSenseManager(outputChannel);
    intelliSenseManager.initialize(context);

    const diagnosticCollection = vscode.languages.createDiagnosticCollection('arduino');
    context.subscriptions.push(diagnosticCollection);

    // 1. Initialize ControlPanel Webview
    controlPanelProvider = new ControlPanelProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ControlPanelProvider.viewType, controlPanelProvider)
    );

    // Initialize Phase 4 Managers
    const serialConnectionManager = new SerialConnectionManager(cliManager);
    
    const serialMonitorProvider = new SerialMonitorProvider(context.extensionUri, serialConnectionManager);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(SerialMonitorProvider.viewType, serialMonitorProvider)
    );

    const serialPlotterProvider = new SerialPlotterProvider(context.extensionUri, serialConnectionManager);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(SerialPlotterProvider.viewType, serialPlotterProvider)
    );

    // 2. Initialize StatusBar Items
    // Port on the left (higher priority), Board on the right (lower priority)
    statusBarPort = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarPort.command = 'vs-arduino.selectPort';
    context.subscriptions.push(statusBarPort);

    statusBarBoard = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    statusBarBoard.command = 'vs-arduino.selectBoard';
    context.subscriptions.push(statusBarBoard);

    updateStatusBar();

    // Register Debug Configuration Provider
    context.subscriptions.push(
        vscode.debug.registerDebugConfigurationProvider(
            'arduino', 
            new ArduinoDebugConfigurationProvider(cliManager, outputChannel)
        )
    );

    // Listen for config changes to update UI
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('vs-arduino.board') || e.affectsConfiguration('vs-arduino.port') || e.affectsConfiguration('vs-arduino.boardName') || e.affectsConfiguration('vs-arduino.programmerName')) {
            updateStatusBar();
            controlPanelProvider.updateConfig();
        }
        if (e.affectsConfiguration('vs-arduino.board')) {
            intelliSenseManager.updateAllSketchesInWorkspace();
        }
    }));

    // 3. Register Commands
    context.subscriptions.push(vscode.commands.registerCommand('vs-arduino.selectBoard', async () => {
        try {
            const boards = await cliManager.getBoardListAll();
            const config = vscode.workspace.getConfiguration('vs-arduino');
            const currentBoard = config.get<string>('board');
            
            const items: vscode.QuickPickItem[] = boards.map(b => {
                const isSelected = b.fqbn === currentBoard;
                const version = b.platform?.release?.version;
                return {
                    label: isSelected ? `$(check) ${b.name}` : b.name,
                    description: version,
                    detail: b.fqbn,
                    _name: b.name,
                    _fqbn: b.fqbn
                } as any;
            });

            const selected: any = await vscode.window.showQuickPick(items, { placeHolder: 'Select Arduino Board' });
            if (selected) {
                await config.update('board', selected._fqbn, vscode.ConfigurationTarget.Global);
                await config.update('boardName', selected._name, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage(`Board set to ${selected._name}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage('Failed to list boards. See output for details.');
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('vs-arduino.selectPort', async () => {
        try {
            const ports = await cliManager.getConnectedPorts();
            if (ports.length === 0) {
                vscode.window.showInformationMessage('No ports detected. Is your Arduino connected?');
                return;
            }
            const config = vscode.workspace.getConfiguration('vs-arduino');
            const currentPort = config.get<string>('port');
            
            const items: vscode.QuickPickItem[] = ports.map(p => {
                const isSelected = p.port.address === currentPort;
                return {
                    label: isSelected ? `$(check) ${p.port.address}` : p.port.address,
                    description: p.port.protocol,
                    detail: p.matching_boards ? `Matching: ${p.matching_boards.map((b:any) => b.name).join(', ')}` : undefined,
                    _address: p.port.address,
                    _matching: p.matching_boards
                } as any;
            });

            const selected: any = await vscode.window.showQuickPick(items, { placeHolder: 'Select Port' });
            if (selected) {
                await config.update('port', selected._address, vscode.ConfigurationTarget.Global);
                
                if (selected._matching && selected._matching.length > 0) {
                    await config.update('board', selected._matching[0].fqbn, vscode.ConfigurationTarget.Global);
                    await config.update('boardName', selected._matching[0].name, vscode.ConfigurationTarget.Global);
                } else {
                    await config.update('board', '', vscode.ConfigurationTarget.Global);
                    await config.update('boardName', '', vscode.ConfigurationTarget.Global);
                }
                
                vscode.window.showInformationMessage(`Port set to ${selected._address}`);
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            outputChannel.appendLine(`Failed to list ports: ${errorMsg}`);
            vscode.window.showErrorMessage('Failed to list ports. See output for details.');
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('vs-arduino.selectProgrammer', async () => {
        const config = vscode.workspace.getConfiguration('vs-arduino');
        const board = config.get<string>('board');
        if (!board || board === 'Select Board') {
            vscode.window.showErrorMessage('Please select a board first to see available programmers.');
            return;
        }

        try {
            const programmers = await cliManager.getProgrammers(board);
            if (programmers.length === 0) {
                vscode.window.showInformationMessage('No programmers found for this board.');
                return;
            }

            const currentProgrammer = config.get<string>('programmer');
            const items: vscode.QuickPickItem[] = programmers.map(p => {
                const isSelected = p.id === currentProgrammer;
                return {
                    label: isSelected ? `$(check) ${p.name}` : p.name,
                    detail: p.id,
                    _id: p.id,
                    _name: p.name
                } as any;
            });

            const selected: any = await vscode.window.showQuickPick(items, { placeHolder: 'Select Programmer' });
            if (selected) {
                await config.update('programmer', selected._id, vscode.ConfigurationTarget.Global);
                await config.update('programmerName', selected._name, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage(`Programmer set to ${selected._name}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage('Failed to list programmers. See output for details.');
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('vs-arduino.focusActivityBar', () => {
        vscode.commands.executeCommand('workbench.view.extension.vs-arduino-view-container');
    }));

    context.subscriptions.push(vscode.commands.registerCommand('vs-arduino.openLibraryManager', () => {
        PackageManagerWebview.createOrShow(context.extensionUri, cliManager, 'library');
    }));

    context.subscriptions.push(vscode.commands.registerCommand('vs-arduino.openBoardManager', () => {
        PackageManagerWebview.createOrShow(context.extensionUri, cliManager, 'core');
    }));

    context.subscriptions.push(vscode.commands.registerCommand('vs-arduino.openSerialMonitor', () => {
        serialMonitorProvider.openInPanel();
    }));

    context.subscriptions.push(vscode.commands.registerCommand('vs-arduino.openSerialPlotter', () => {
        serialPlotterProvider.openInPanel();
    }));

    context.subscriptions.push(vscode.commands.registerCommand('vs-arduino.compile', async () => {
        const config = vscode.workspace.getConfiguration('vs-arduino');
        const board = config.get<string>('board');
        if (!board || board === 'Select Board') {
            vscode.window.showErrorMessage('Please select a board first.');
            return;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('Please open a folder containing your Arduino sketch.');
            return;
        }
        const sketchPath = workspaceFolders[0].uri.fsPath;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Compiling Sketch...",
            cancellable: false
        }, async (progress) => {
            try {
                diagnosticCollection.clear();
                outputChannel.show(true);
                outputChannel.appendLine(`\n--- Compiling for ${board} ---`);
                const { stdout, stderr } = await cliManager.compile(board, sketchPath);
                parseDiagnostics(stderr, diagnosticCollection);
                vscode.window.showInformationMessage('Compilation succeeded!');
            } catch (error: any) {
                if (error.stderr) {
                    parseDiagnostics(error.stderr, diagnosticCollection);
                }
                vscode.window.showErrorMessage('Compilation failed. Check output for details.');
            }
        });
    }));

    context.subscriptions.push(vscode.commands.registerCommand('vs-arduino.debug', async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('Please open a folder containing your Arduino sketch.');
            return;
        }

        const config = vscode.workspace.getConfiguration('vs-arduino');
        const board = config.get<string>('board');
        if (!board || board === 'Select Board') {
            vscode.window.showErrorMessage('Please select a board first.');
            return;
        }

        try {
            const programmers = await cliManager.getProgrammers(board);
            if (programmers.length > 0) {
                const currentProgrammer = config.get<string>('programmer');
                const items: vscode.QuickPickItem[] = programmers.map(p => {
                    const isSelected = p.id === currentProgrammer;
                    return {
                        label: isSelected ? `$(check) ${p.name}` : p.name,
                        detail: p.id,
                        _id: p.id,
                        _name: p.name
                    } as any;
                });

                const selected: any = await vscode.window.showQuickPick(items, { placeHolder: 'Select Programmer for Debugging' });
                if (!selected) {
                    return; // User cancelled
                }
                await config.update('programmer', selected._id, vscode.ConfigurationTarget.Global);
                await config.update('programmerName', selected._name, vscode.ConfigurationTarget.Global);
            } else {
                vscode.window.showInformationMessage('No programmers found for this board, proceeding to debug...');
            }
        } catch (error) {
            vscode.window.showErrorMessage('Failed to list programmers. See output for details.');
            return;
        }

        const sketchPath = workspaceFolders[0].uri.fsPath;
        const buildPath = path.join(sketchPath, 'build');

        const compileSuccess = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Compiling Sketch for Debug...",
            cancellable: false
        }, async () => {
            try {
                diagnosticCollection.clear();
                outputChannel.show(true);
                outputChannel.appendLine(`\n--- Compiling for ${board} (debug mode) ---`);
                const { stderr } = await cliManager.compile(board, sketchPath, true, buildPath);
                parseDiagnostics(stderr, diagnosticCollection);
                return true;
            } catch (error: any) {
                if (error.stderr) { parseDiagnostics(error.stderr, diagnosticCollection); }
                vscode.window.showErrorMessage('Debug compilation failed. Check output for details.');
                return false;
            }
        });

        if (!compileSuccess) { return; }

        vscode.debug.startDebugging(workspaceFolders[0], {
            type: 'arduino',
            request: 'launch',
            name: 'Arduino Debug'
        });
    }));

    context.subscriptions.push(vscode.commands.registerCommand('vs-arduino.upload', async () => {
        const config = vscode.workspace.getConfiguration('vs-arduino');
        const board = config.get<string>('board');
        const port = config.get<string>('port');
        
        if (!board || board === 'Select Board' || !port || port === 'Select Port') {
            vscode.window.showErrorMessage('Please select both a board and a port first.');
            return;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('Please open a folder containing your Arduino sketch.');
            return;
        }
        const sketchPath = workspaceFolders[0].uri.fsPath;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Uploading Sketch...",
            cancellable: false
        }, async (progress) => {
            try {
                // Phase 4: Handle COM Port Conflict
                const wasActive = serialConnectionManager.isActive();
                
                if (wasActive) {
                    serialConnectionManager.stop();
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for OS to release port
                }

                outputChannel.show(true);
                outputChannel.appendLine(`\n--- Compiling & Uploading to ${board} on ${port} ---`);
                await cliManager.upload(board, port, sketchPath);
                vscode.window.showInformationMessage('Upload succeeded!');

                // Restore
                if (wasActive) {
                    await serialConnectionManager.start(port, board);
                }

            } catch (error) {
                vscode.window.showErrorMessage('Upload failed. Check output for details.');
            }
        });
    }));

    // Context menu variants
    context.subscriptions.push(vscode.commands.registerCommand('vs-arduino.contextCompile', async (uri: vscode.Uri) => {
        const config = vscode.workspace.getConfiguration('vs-arduino');
        const board = config.get<string>('board');
        if (!board || board === 'Select Board') {
            vscode.window.showErrorMessage('Please select a board first.');
            return;
        }

        const sketchPath = uri.fsPath;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Compiling Sketch in ${path.basename(sketchPath)}...`,
            cancellable: false
        }, async (progress) => {
            try {
                diagnosticCollection.clear();
                outputChannel.show(true);
                outputChannel.appendLine(`\n--- Compiling for ${board} ---`);
                const { stdout, stderr } = await cliManager.compile(board, sketchPath);
                parseDiagnostics(stderr, diagnosticCollection);
                vscode.window.showInformationMessage(`Compilation succeeded for ${path.basename(sketchPath)}!`);
            } catch (error: any) {
                if (error.stderr) {
                    parseDiagnostics(error.stderr, diagnosticCollection);
                }
                vscode.window.showErrorMessage('Compilation failed. Check output for details.');
            }
        });
    }));

    context.subscriptions.push(vscode.commands.registerCommand('vs-arduino.contextUpload', async (uri: vscode.Uri) => {
        const config = vscode.workspace.getConfiguration('vs-arduino');
        const board = config.get<string>('board');
        const port = config.get<string>('port');
        
        if (!board || board === 'Select Board' || !port || port === 'Select Port') {
            vscode.window.showErrorMessage('Please select both a board and a port first.');
            return;
        }

        const sketchPath = uri.fsPath;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Uploading Sketch from ${path.basename(sketchPath)}...`,
            cancellable: false
        }, async (progress) => {
            try {
                const wasActive = serialConnectionManager.isActive();
                
                if (wasActive) {
                    serialConnectionManager.stop();
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                outputChannel.show(true);
                outputChannel.appendLine(`\n--- Compiling & Uploading to ${board} on ${port} ---`);
                await cliManager.upload(board, port, sketchPath);
                vscode.window.showInformationMessage(`Upload succeeded for ${path.basename(sketchPath)}!`);

                if (wasActive) {
                    await serialConnectionManager.start(port, board);
                }

            } catch (error) {
                vscode.window.showErrorMessage('Upload failed. Check output for details.');
            }
        });
    }));
}

function updateStatusBar() {
    const config = vscode.workspace.getConfiguration('vs-arduino');
    const boardFqbn = config.get<string>('board');
    const boardName = config.get<string>('boardName');
    const board = boardName ? boardName : (boardFqbn ? boardFqbn : 'Select Board');
    const port = config.get<string>('port') || 'Select Port';

    statusBarPort.text = `$(plug) ${port}`;
    statusBarPort.show();

    statusBarBoard.text = `$(board) ${board}`;
    statusBarBoard.show();
}

function parseDiagnostics(stderr: string, collection: vscode.DiagnosticCollection) {
    const regex = /^(.*?):(\d+):(\d+):\s*(error|warning|note):\s*(.*)$/gm;
    let match;
    const diagnosticsMap = new Map<string, vscode.Diagnostic[]>();

    while ((match = regex.exec(stderr)) !== null) {
        const file = match[1];
        const line = Math.max(0, parseInt(match[2], 10) - 1);
        const col = Math.max(0, parseInt(match[3], 10) - 1);
        const severityStr = match[4];
        const message = match[5];

        let severity = vscode.DiagnosticSeverity.Error;
        if (severityStr === 'warning') severity = vscode.DiagnosticSeverity.Warning;
        else if (severityStr === 'note') severity = vscode.DiagnosticSeverity.Information;

        const range = new vscode.Range(line, col, line, col);
        const diagnostic = new vscode.Diagnostic(range, message, severity);

        if (!diagnosticsMap.has(file)) {
            diagnosticsMap.set(file, []);
        }
        diagnosticsMap.get(file)!.push(diagnostic);
    }

    for (const [file, diagnostics] of diagnosticsMap.entries()) {
        const uri = vscode.Uri.file(file);
        collection.set(uri, diagnostics);
    }
}

export function deactivate() {
    deactivateCortexDebugCore();
    if (outputChannel) outputChannel.dispose();
    if (statusBarBoard) statusBarBoard.dispose();
    if (statusBarPort) statusBarPort.dispose();
}
