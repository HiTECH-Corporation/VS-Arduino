import * as vscode from 'vscode';
import * as fs from 'fs';
import { ArduinoCliManager } from './ArduinoCliManager';

export class PackageManagerWebview {
    public static currentPanels: Map<string, PackageManagerWebview> = new Map();

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _cliManager: ArduinoCliManager;
    private _type: 'library' | 'core';

    public static createOrShow(extensionUri: vscode.Uri, cliManager: ArduinoCliManager, type: 'library' | 'core') {
        const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

        const existingPanel = PackageManagerWebview.currentPanels.get(type);
        if (existingPanel) {
            existingPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            `arduinoPackageManager-${type}`,
            type === 'library' ? 'Library Manager' : 'Board Manager',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
            }
        );

        // Set Icon
        panel.iconPath = vscode.Uri.joinPath(
            extensionUri,
            'media',
            'icons',
            type === 'library' ? 'library-manager.svg' : 'board-manager.svg'
        );

        PackageManagerWebview.currentPanels.set(type, new PackageManagerWebview(panel, extensionUri, cliManager, type));
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, cliManager: ArduinoCliManager, type: 'library' | 'core') {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._cliManager = cliManager;
        this._type = type;

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'init':
                        await this._handleInit();
                        return;
                    case 'search':
                        await this._handleSearch(message.query);
                        return;
                    case 'getDetails':
                        await this._handleGetDetails(message.name, message.isInstalled, message.installDir, message.installedVersion);
                        return;
                    case 'install':
                        await this._handleInstall(message.name, message.version);
                        return;
                    case 'uninstall':
                        await this._handleUninstall(message.name);
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    private async _handleInit() {
        try {
            this._panel.webview.postMessage({ command: 'loading', state: true });
            let results;
            if (this._type === 'library') {
                results = await this._cliManager.listInstalledLibraries();
            } else {
                results = await this._cliManager.listInstalledCores();
            }
            this._panel.webview.postMessage({ command: 'searchResults', results, type: this._type, isInstalledList: true });
        } catch (error) {
            // Ignore if fails on init
        } finally {
            this._panel.webview.postMessage({ command: 'loading', state: false });
        }
    }

    private async _handleSearch(query: string) {
        if (!query) {
            await this._handleInit();
            return;
        }
        try {
            this._panel.webview.postMessage({ command: 'loading', state: true });
            let results;
            if (this._type === 'library') {
                results = await this._cliManager.searchLibrary(query);
            } else {
                results = await this._cliManager.searchCore(query);
            }
            this._panel.webview.postMessage({ command: 'searchResults', results, type: this._type, isInstalledList: false });
        } catch (error) {
            vscode.window.showErrorMessage(`Search failed: ${error}`);
        } finally {
            this._panel.webview.postMessage({ command: 'loading', state: false });
        }
    }

    private async _handleGetDetails(name: string, isInstalled: boolean, installDir?: string, installedVersion?: string) {
        try {
            this._panel.webview.postMessage({ command: 'loadingDetails', state: true });
            let itemDetails;
            let versions: string[] = [];
            
            if (this._type === 'library') {
                itemDetails = await this._cliManager.getLibraryDetails(name);
                if (itemDetails && itemDetails.releases) {
                    versions = Object.keys(itemDetails.releases);
                }
            } else {
                itemDetails = await this._cliManager.getCoreDetails(name);
                if (itemDetails && itemDetails.releases) {
                    versions = Object.keys(itemDetails.releases);
                }
            }

            if (!versions || versions.length === 0) {
                versions = ['latest'];
            } else {
                versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }));
            }

            let readme = null;
            if (isInstalled && installDir) {
                readme = await this._cliManager.getReadmeContent(installDir);
            }

            this._panel.webview.postMessage({
                command: 'detailsResult',
                details: itemDetails,
                versions,
                readme,
                type: this._type,
                installedVersion
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to get details: ${error}`);
        } finally {
            this._panel.webview.postMessage({ command: 'loadingDetails', state: false });
        }
    }

    private async _handleInstall(name: string, version: string) {
        try {
            const versionToInstall = version === 'latest' ? undefined : version;
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Installing ${name}${versionToInstall ? '@' + versionToInstall : ''}...`,
                cancellable: false
            }, async () => {
                if (this._type === 'library') {
                    await this._cliManager.installLibrary(name, versionToInstall);
                } else {
                    await this._cliManager.installCore(name, versionToInstall);
                }
                vscode.window.showInformationMessage(`Successfully installed ${name}`);
                this._panel.webview.postMessage({ command: 'installComplete', name, version });
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Installation failed: ${error}`);
        }
    }

    private async _handleUninstall(name: string) {
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Uninstalling ${name}...`,
                cancellable: false
            }, async () => {
                if (this._type === 'library') {
                    await this._cliManager.uninstallLibrary(name);
                } else {
                    await this._cliManager.uninstallCore(name);
                }
                vscode.window.showInformationMessage(`Successfully uninstalled ${name}`);
                this._panel.webview.postMessage({ command: 'uninstallComplete', name });
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Uninstallation failed: ${error}`);
        }
    }

    public dispose() {
        PackageManagerWebview.currentPanels.delete(this._type);
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _update() {
        this._panel.webview.html = this._getHtmlForWebview();
    }

    private _getHtmlForWebview() {
        const webview = this._panel.webview;
        const folder = this._type === 'library' ? 'library-manager' : 'board-manager';

        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', folder, 'main.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', folder, 'style.css'));

        const htmlPath = vscode.Uri.joinPath(this._extensionUri, 'media', folder, 'index.html').fsPath;
        let htmlContent = fs.readFileSync(htmlPath, 'utf8');

        htmlContent = htmlContent.replace('{{jsUri}}', scriptUri.toString());
        htmlContent = htmlContent.replace('{{cssUri}}', styleUri.toString());
        htmlContent = htmlContent.replace(/{{cspSource}}/g, webview.cspSource);

        return htmlContent;
    }
}
