import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SerialConnectionManager } from './SerialConnectionManager';

export class SerialMonitorProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'vs-arduino-serial-monitor';
    
    private _view?: vscode.WebviewView;
    private _panel?: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _connectionManager: SerialConnectionManager
    ) {
        this._connectionManager.onData(data => {
            this.postMessage({ type: 'data', value: data });
        });

        this._connectionManager.onStateChange(isActive => {
            this.postMessage({ type: 'state', isActive });
        });
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        this._initWebview(webviewView.webview);

        webviewView.onDidDispose(() => {
            this._view = undefined;
        }, null, this._disposables);
    }

    public openInPanel() {
        if (this._panel) {
            this._panel.reveal(vscode.ViewColumn.One);
            return;
        }

        this._panel = vscode.window.createWebviewPanel(
            SerialMonitorProvider.viewType,
            'Arduino Serial Monitor',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [this._extensionUri],
                retainContextWhenHidden: true
            }
        );

        this._panel.iconPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'icons', 'monitor-icon.svg');

        this._initWebview(this._panel.webview);

        this._panel.onDidDispose(() => {
            this._panel = undefined;
        }, null, this._disposables);
    }

    private _initWebview(webview: vscode.Webview) {
        webview.html = this._getHtmlForWebview(webview);

        webview.onDidReceiveMessage(async data => {
            switch (data.type) {
                case 'changeBaudRate':
                    await this._connectionManager.changeBaudRate(data.value);
                    break;
                case 'send':
                    let text = data.value;
                    const newlineConfig = data.newline; // 'none', 'nl', 'cr', 'nlcr'
                    if (newlineConfig === 'nl') text += '\n';
                    else if (newlineConfig === 'cr') text += '\r';
                    else if (newlineConfig === 'nlcr') text += '\r\n';
                    
                    this._connectionManager.sendText(text);
                    break;
                case 'ready':
                    // Auto-connect when the monitor webview becomes ready
                    if (!this._connectionManager.isActive()) {
                        this._connectionManager.start();
                    }
                    const config = vscode.workspace.getConfiguration('vs-arduino');
                    this.postMessage({ type: 'baudRate', value: config.get<string>('baudRate') || '115200' });
                    this.postMessage({
                        type: 'config',
                        boardName: config.get<string>('boardName') || '',
                        port: config.get<string>('port') || ''
                    });
                    break;
            }
        }, undefined, this._disposables);
    }

    private postMessage(message: any) {
        if (this._view && this._view.visible) {
            this._view.webview.postMessage(message);
        }
        if (this._panel && this._panel.visible) {
            this._panel.webview.postMessage(message);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'serial-monitor', 'main.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'serial-monitor', 'style.css'));

        const htmlPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'serial-monitor', 'index.html').fsPath;
        let htmlContent = fs.readFileSync(htmlPath, 'utf8');

        htmlContent = htmlContent.replace('{{jsUri}}', scriptUri.toString());
        htmlContent = htmlContent.replace('{{cssUri}}', styleUri.toString());
        htmlContent = htmlContent.replace(/{{cspSource}}/g, webview.cspSource);

        return htmlContent;
    }

    public dispose() {
        if (this._view) {
            // View can't really be disposed by us
        }
        if (this._panel) {
            this._panel.dispose();
        }
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}
