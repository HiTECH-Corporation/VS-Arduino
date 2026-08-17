import * as vscode from 'vscode';
import * as path from 'path';
import { ArduinoCliManager } from './ArduinoCliManager';
import { ControlPanelProvider } from './ControlPanelProvider';
import { IntelliSenseManager } from './IntelliSenseManager';
import { PackageManagerWebview } from './PackageManagerWebview';
import { ExampleBrowser } from './ExampleBrowser';
import { UpdateChecker } from './UpdateChecker';
import { SerialConnectionManager } from './SerialConnectionManager';
import { SerialMonitorProvider } from './SerialMonitorProvider';
import { SerialPlotterProvider } from './SerialPlotterProvider';
import { ArduinoDebugConfigurationProvider } from './ArduinoDebugConfigurationProvider';
import { CliCommandRunner } from './CliCommandRunner';
import { SnippetManager } from './SnippetManager';
import { activateCortexDebugCore, deactivateCortexDebugCore } from './debugger/CortexDebugCore';

let outputChannel: vscode.OutputChannel;
let intelliSenseChannel: vscode.OutputChannel;
let statusBarBoard: vscode.StatusBarItem;
let statusBarPort: vscode.StatusBarItem;
let controlPanelProvider: ControlPanelProvider;

const OUTPUT_LANGUAGE_ID = 'vs-arduino-output';
const DEFAULT_SCAFFOLD = 'void setup() {\n    \n}\n\nvoid loop() {\n    \n}\n';

function getScaffold(): string {
    const config = vscode.workspace.getConfiguration('vs-arduino');
    if (!config.get<boolean>('inoScaffolding', true)) { return ''; }
    const template = config.get<string>('inoScaffoldTemplate', '');
    return template.length > 0 ? template : DEFAULT_SCAFFOLD;
}

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('VS Arduino', OUTPUT_LANGUAGE_ID);
    intelliSenseChannel = vscode.window.createOutputChannel('VS Arduino: IntelliSense', OUTPUT_LANGUAGE_ID);
    context.subscriptions.push(outputChannel, intelliSenseChannel);
    outputChannel.appendLine('[VS Arduino] Extension activated.');

    setImmediate(() => {
        activateCortexDebugCore(context, outputChannel);

        const officialCortexDebug = vscode.extensions.getExtension('marus25.cortex-debug');
        if (officialCortexDebug) {
            vscode.window.showWarningMessage('You have the official Cortex-Debug extension (marus25) installed, which may conflict with the built-in version of VS Arduino. Please disable or uninstall it for the best experience.');
        }
    });

    const cliManager = new ArduinoCliManager(context, outputChannel);
    const updateChecker = new UpdateChecker(cliManager, outputChannel);
    cliManager.initialize().then(async () => {

        const detected = await cliManager.autoDetectBoardAndPort();
        if (detected) {
            const config = vscode.workspace.getConfiguration('vs-arduino');
            await config.update('port', detected.port, vscode.ConfigurationTarget.Global);
            await config.update('board', detected.boardFqbn, vscode.ConfigurationTarget.Global);
            await config.update('boardName', detected.boardName, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Auto-detected ${detected.boardName} on ${detected.port}`);
        }

        updateChecker.checkAndNotify().catch(updateErr => {
            outputChannel.appendLine(`[Update] Check failed: ${updateErr instanceof Error ? updateErr.message : String(updateErr)}`);
        });
    }).catch(err => {
        const errorMsg = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`[Setup] Initialization error: ${errorMsg}`);
        vscode.window.showErrorMessage(`VS Arduino Initialization error: ${errorMsg}`);
    });

    const intelliSenseManager = new IntelliSenseManager(intelliSenseChannel, cliManager);
    intelliSenseManager.initialize(context);

    const diagnosticCollection = vscode.languages.createDiagnosticCollection('arduino');
    context.subscriptions.push(diagnosticCollection);

    controlPanelProvider = new ControlPanelProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ControlPanelProvider.viewType, controlPanelProvider)
    );

    const serialConnectionManager = new SerialConnectionManager(cliManager);

    const serialMonitorProvider = new SerialMonitorProvider(context.extensionUri, serialConnectionManager);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(SerialMonitorProvider.viewType, serialMonitorProvider)
    );

    const serialPlotterProvider = new SerialPlotterProvider(context.extensionUri, serialConnectionManager);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(SerialPlotterProvider.viewType, serialPlotterProvider)
    );

    statusBarPort = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarPort.command = 'vs-arduino.selectPort';
    context.subscriptions.push(statusBarPort);

    statusBarBoard = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    statusBarBoard.command = 'vs-arduino.selectBoard';
    context.subscriptions.push(statusBarBoard);

    updateStatusBar();

    context.subscriptions.push(
        vscode.debug.registerDebugConfigurationProvider(
            'arduino',
            new ArduinoDebugConfigurationProvider(cliManager, outputChannel)
        )
    );

    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('vs-arduino.board') || e.affectsConfiguration('vs-arduino.port') || e.affectsConfiguration('vs-arduino.boardName') || e.affectsConfiguration('vs-arduino.programmerName')) {
            updateStatusBar();
            controlPanelProvider.updateConfig();
        }
        if (e.affectsConfiguration('vs-arduino.board')) {
            intelliSenseManager.updateAllSketchesInWorkspace();
        }
    }));

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
            outputChannel.appendLine(`[Ports] Failed to list ports: ${errorMsg}`);
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

    const exampleBrowser = new ExampleBrowser(cliManager);
    context.subscriptions.push(vscode.commands.registerCommand('vs-arduino.browseExamples', async (menuContext?: any) => {
        const itemName = menuContext?.vsArduinoItemName;
        const managerType = menuContext?.vsArduinoManagerType;
        if (!itemName || (managerType !== 'library' && managerType !== 'core')) {
            vscode.window.showInformationMessage('Right-click an installed library or board package to browse its examples.');
            return;
        }
        await exampleBrowser.browse(itemName, managerType);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('vs-arduino.openExample', async () => {
        try {
            await exampleBrowser.pickAndBrowse();
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            outputChannel.appendLine(`[Examples] Failed to list examples: ${errorMsg}`);
            vscode.window.showErrorMessage('Failed to list examples. See output for details.');
        }
    }));

    const cliCommandRunner = new CliCommandRunner(context, outputChannel, cliManager);
    context.subscriptions.push(vscode.commands.registerCommand('vs-arduino.runCliCommand', async () => {
        await cliCommandRunner.run();
    }));

    const snippetManager = new SnippetManager(context);
    context.subscriptions.push(vscode.commands.registerCommand('vs-arduino.createSnippet', async () => {
        await snippetManager.createSnippet();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('vs-arduino.insertSnippet', async () => {
        await snippetManager.insertSnippet();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('vs-arduino.deleteSnippet', async () => {
        await snippetManager.deleteSnippet();
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
            cancellable: true
        }, async (progress, token) => {
            try {
                diagnosticCollection.clear();
                outputChannel.show(true);
                outputChannel.appendLine(`\n[Compile] Building for ${board}`);
                const { stdout, stderr } = await cliManager.compile(board, sketchPath, false, undefined, token);
                parseDiagnostics(stderr, diagnosticCollection);
                vscode.window.showInformationMessage('Compilation succeeded!');
            } catch (error: any) {
                if (token.isCancellationRequested || error instanceof vscode.CancellationError) {
                    outputChannel.appendLine('\n[Compile] Compilation cancelled.');
                    vscode.window.showInformationMessage('Compilation cancelled.');
                    return;
                }
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
                    return;
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
                outputChannel.appendLine(`\n[Debug] Building for ${board} with debug optimization`);
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
            cancellable: true
        }, async (progress, token) => {
            const wasActive = serialConnectionManager.isActive();
            try {
                if (wasActive) {
                    serialConnectionManager.stop();
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                outputChannel.show(true);
                outputChannel.appendLine(`\n[Upload] Building and uploading to ${board} on ${port}`);
                await cliManager.upload(board, port, sketchPath, token);
                vscode.window.showInformationMessage('Upload succeeded!');
            } catch (error: any) {
                if (token.isCancellationRequested || error instanceof vscode.CancellationError) {
                    outputChannel.appendLine('\n[Upload] Upload cancelled.');
                    vscode.window.showInformationMessage('Upload cancelled.');
                    return;
                }
                vscode.window.showErrorMessage('Upload failed. Check output for details.');
            } finally {
                if (wasActive && !serialConnectionManager.isActive()) {
                    await serialConnectionManager.start(port, board);
                }
            }
        });
    }));

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
            cancellable: true
        }, async (progress, token) => {
            try {
                diagnosticCollection.clear();
                outputChannel.show(true);
                outputChannel.appendLine(`\n[Compile] Building for ${board}`);
                const { stdout, stderr } = await cliManager.compile(board, sketchPath, false, undefined, token);
                parseDiagnostics(stderr, diagnosticCollection);
                vscode.window.showInformationMessage(`Compilation succeeded for ${path.basename(sketchPath)}!`);
            } catch (error: any) {
                if (token.isCancellationRequested || error instanceof vscode.CancellationError) {
                    outputChannel.appendLine('\n[Compile] Compilation cancelled.');
                    vscode.window.showInformationMessage('Compilation cancelled.');
                    return;
                }
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
            cancellable: true
        }, async (progress, token) => {
            const wasActive = serialConnectionManager.isActive();
            try {
                if (wasActive) {
                    serialConnectionManager.stop();
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                outputChannel.show(true);
                outputChannel.appendLine(`\n[Upload] Building and uploading to ${board} on ${port}`);
                await cliManager.upload(board, port, sketchPath, token);
                vscode.window.showInformationMessage(`Upload succeeded for ${path.basename(sketchPath)}!`);
            } catch (error: any) {
                if (token.isCancellationRequested || error instanceof vscode.CancellationError) {
                    outputChannel.appendLine('\n[Upload] Upload cancelled.');
                    vscode.window.showInformationMessage('Upload cancelled.');
                    return;
                }
                vscode.window.showErrorMessage('Upload failed. Check output for details.');
            } finally {
                if (wasActive && !serialConnectionManager.isActive()) {
                    await serialConnectionManager.start(port, board);
                }
            }
        });
    }));

    context.subscriptions.push(vscode.commands.registerCommand('vs-arduino.addBoardManagerUrl', async () => {
        const presets = [
            {
                label: 'ESP32 (Espressif Systems)',
                description: 'Official ESP32 platform URL',
                url: 'https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json'
            },
            {
                label: 'ESP8266 (ESP8266 Community)',
                description: 'ESP8266 boards platform URL',
                url: 'https://arduino.esp8266.com/stable/package_esp8266com_index.json'
            },
            {
                label: 'Raspberry Pi Pico / RP2040 (Earle Philhower)',
                description: 'RP2040 Arduino core URL',
                url: 'https://github.com/earlephilhower/arduino-pico/releases/download/global/package_rp2040_index.json'
            },
            {
                label: 'STM32 (STMicroelectronics)',
                description: 'Official STM32 platform URL',
                url: 'https://github.com/stm32duino/BoardManagerFiles/raw/main/package_stmicroelectronics_index.json'
            },
            {
                label: '$(plus) Custom URL...',
                description: 'Enter a custom board manager package URL',
                url: ''
            }
        ];

        const selected = await vscode.window.showQuickPick(presets, {
            placeHolder: 'Select a popular platform or enter custom URL'
        });

        if (!selected) { return; }

        let targetUrl = selected.url;
        if (!targetUrl) {
            const input = await vscode.window.showInputBox({
                prompt: 'Enter Additional Board Manager URL (e.g. https://.../package_xxx_index.json)',
                placeHolder: 'https://...'
            });
            if (!input || !input.trim()) { return; }
            targetUrl = input.trim();
        }

        const config = vscode.workspace.getConfiguration('vs-arduino');
        const currentUrls = config.get<string[]>('additionalUrls') || [];
        if (currentUrls.includes(targetUrl)) {
            vscode.window.showInformationMessage(`URL already exists in configuration: ${targetUrl}`);
            return;
        }

        const updatedUrls = [...currentUrls, targetUrl];
        await config.update('additionalUrls', updatedUrls, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Added Board Manager URL: ${targetUrl}`);

        const updateChoice = await vscode.window.showInformationMessage(
            'Board Manager URL added. Would you like to update board indexes now?',
            'Update Indexes Now',
            'Later'
        );
        if (updateChoice === 'Update Indexes Now') {
            await vscode.commands.executeCommand('vs-arduino.updateIndex');
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('vs-arduino.updateIndex', async () => {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Updating Board & Library Indexes...',
            cancellable: true
        }, async (progress, token) => {
            try {
                outputChannel.show(true);
                await cliManager.updateIndex(token);
                vscode.window.showInformationMessage('Board & Library indexes updated successfully!');
            } catch (error) {
                if (token.isCancellationRequested || error instanceof vscode.CancellationError) {
                    vscode.window.showInformationMessage('Index update cancelled.');
                    return;
                }
                const errorMsg = error instanceof Error ? error.message : String(error);
                outputChannel.appendLine(`[Index] Update failed: ${errorMsg}`);
                vscode.window.showErrorMessage('Failed to update indexes. See output for details.');
            }
        });
    }));

    context.subscriptions.push(vscode.workspace.onDidCreateFiles(async event => {
        const scaffoldingEnabled = vscode.workspace.getConfiguration('vs-arduino').get<boolean>('inoScaffolding', true);
        if (!scaffoldingEnabled) return;
        for (const file of event.files) {
            if (!file.fsPath.endsWith('.ino')) continue;
            if (file.fsPath.split(/[\\/]/).includes('.vscode')) continue;
            try {
                const content = await vscode.workspace.fs.readFile(file);
                if (content.byteLength === 0) {
                    await vscode.workspace.fs.writeFile(file, Buffer.from(getScaffold(), 'utf8'));
                }
            } catch {
            }
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('vs-arduino.newSketch', async (uri?: vscode.Uri) => {
        let targetDir: string | undefined;

        if (uri) {
            try {
                const stat = await vscode.workspace.fs.stat(uri);
                targetDir = stat.type === vscode.FileType.Directory ? uri.fsPath : path.dirname(uri.fsPath);
            } catch {
                targetDir = undefined;
            }
        }

        if (!targetDir) {
            targetDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        }

        if (!targetDir) {
            vscode.window.showErrorMessage('Open a folder in the Explorer before creating a sketch.');
            return;
        }

        const sketchName = await vscode.window.showInputBox({
            prompt: 'Enter a name for the new sketch',
            placeHolder: 'MySketch',
            validateInput: value => {
                const trimmed = value.trim();
                if (!trimmed) {
                    return 'Sketch name cannot be empty.';
                }
                if (!/^[a-zA-Z0-9_][a-zA-Z0-9_.-]*$/.test(trimmed)) {
                    return 'Sketch name may only contain letters, numbers, underscores, dots, and dashes, and must start with a letter, number, or underscore.';
                }
                if (trimmed.length > 63) {
                    return 'Sketch name must be 63 characters or fewer.';
                }
                return undefined;
            }
        });

        if (!sketchName) {
            return;
        }

        const trimmedName = sketchName.trim();
        const sketchDir = path.join(targetDir, trimmedName);
        const sketchFile = path.join(sketchDir, `${trimmedName}.ino`);
        const sketchFileUri = vscode.Uri.file(sketchFile);

        try {
            await vscode.workspace.fs.stat(sketchFileUri);
            vscode.window.showErrorMessage(`A sketch named "${trimmedName}" already exists at this location.`);
            return;
        } catch {
        }

        const scaffold = getScaffold();

        try {
            await vscode.workspace.fs.createDirectory(vscode.Uri.file(sketchDir));
            await vscode.workspace.fs.writeFile(sketchFileUri, Buffer.from(scaffold, 'utf8'));
            const doc = await vscode.workspace.openTextDocument(sketchFileUri);
            await vscode.window.showTextDocument(doc);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to create sketch: ${errorMsg}`);
        }
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
