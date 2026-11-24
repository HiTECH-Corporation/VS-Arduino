import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ArduinoCliManager } from './ArduinoCliManager';

export class ControlPanelProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'vs-arduino-control-panel';
    private _view?: vscode.WebviewView;
    private panel: any;
    private cliManager: any;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        cliManager?: ArduinoCliManager
    ) {
        this.cliManager = cliManager;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;
        this.panel = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(message => {
            this.handleWebviewMessage(message);
        });

        this.updateConfig();
    }

    private async handleWebviewMessage(message: any): Promise<void> {
        switch (message.command) {
            case 'selectPort':
                if (message.port) {
                    await this.cliManager.updatePort(message.port);
                    const latestConfig = await this.cliManager.getConfig();
                    this.panel.webview.postMessage({
                        command: 'syncState',
                        state: latestConfig
                    });
                } else {
                    vscode.commands.executeCommand('vs-arduino.selectPort');
                }
                break;
                
            case 'selectBoard':
                if (message.fqbn) {
                    await this.cliManager.updateBoard(message.fqbn);
                } else {
                    vscode.commands.executeCommand('vs-arduino.selectBoard');
                }
                break;

            case 'compile':
                vscode.commands.executeCommand('vs-arduino.compile');
                break;
            case 'upload':
                vscode.commands.executeCommand('vs-arduino.upload');
                break;
            case 'debug':
                vscode.commands.executeCommand('vs-arduino.debug');
                break;
            case 'openMonitor':
                vscode.commands.executeCommand('vs-arduino.openSerialMonitor');
                break;
            case 'openPlotter':
                vscode.commands.executeCommand('vs-arduino.openSerialPlotter');
                break;
            case 'openBoardManager':
                vscode.commands.executeCommand('vs-arduino.openBoardManager');
                break;
            case 'openLibraryManager':
                vscode.commands.executeCommand('vs-arduino.openLibraryManager');
                break;
            case 'ready':
                this.updateConfig();
                break;
        }
    }

    public updateConfig() {
        if (this._view) {
            const config = vscode.workspace.getConfiguration('vs-arduino');
            const boardName = config.get<string>('boardName') || '';
            const port = config.get<string>('port') || '';
            this._view.webview.postMessage({ command: 'updateConfig', boardName, port });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const htmlPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'control-panel', 'index.html');
        let html = fs.readFileSync(htmlPath.fsPath, 'utf8');

        const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'control-panel', 'style.css'));
        const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'control-panel', 'main.js'));

        html = html.replace('{{cssUri}}', cssUri.toString());
        html = html.replace('{{jsUri}}', jsUri.toString());
        html = html.replace(/{{cspSource}}/g, webview.cspSource);

        return html;
    }
}
