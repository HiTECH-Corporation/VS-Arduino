import * as vscode from 'vscode';
import { ArduinoCliManager, OutdatedItem } from './ArduinoCliManager';

export class UpdateChecker {
    constructor(
        private cliManager: ArduinoCliManager,
        private outputChannel: vscode.OutputChannel
    ) {}

    public async checkAndNotify(): Promise<void> {
        const config = vscode.workspace.getConfiguration('vs-arduino');
        if (!config.get<boolean>('checkForUpdates', true)) {
            return;
        }

        const { libraries, cores } = await this.cliManager.getOutdated();
        const ignored = new Set(config.get<string[]>('ignoredUpdates', []));
        const libs = libraries.filter(item => !ignored.has(item.id));
        const boards = cores.filter(item => !ignored.has(item.id));

        const total = libs.length + boards.length;
        if (total === 0) {
            return;
        }

        const message = this.buildMessage(libs, boards);
        const update = 'Update';
        const noThanks = 'No, Thanks';

        const dismiss = total === 1
            ? `Don't Notify for This`
            : `Stop Update Notifications`;

        const choice = await vscode.window.showInformationMessage(message, update, noThanks, dismiss);

        if (choice === update) {
            await this.upgrade(libs, boards);
        } else if (choice === dismiss) {
            if (total === 1) {
                const only = [...libs, ...boards][0];
                const next = Array.from(new Set([...ignored, only.id]));
                await config.update('ignoredUpdates', next, vscode.ConfigurationTarget.Global);
            } else {
                await config.update('checkForUpdates', false, vscode.ConfigurationTarget.Global);
            }
        }
    }

    private buildMessage(libs: OutdatedItem[], boards: OutdatedItem[]): string {
        const total = libs.length + boards.length;

        if (total === 1) {
            const item = [...libs, ...boards][0];
            const kind = libs.length === 1 ? 'library' : 'board package';
            return `An update is available for the ${kind} "${item.name}" (${item.installedVersion} -> ${item.latestVersion}).`;
        }

        const parts: string[] = [];
        if (libs.length > 0) {
            parts.push(`${libs.length} ${libs.length === 1 ? 'library' : 'libraries'}`);
        }
        if (boards.length > 0) {
            parts.push(`${boards.length} board ${boards.length === 1 ? 'package' : 'packages'}`);
        }
        return `Updates are available for ${parts.join(' and ')}.`;
    }

    private async upgrade(libs: OutdatedItem[], boards: OutdatedItem[]): Promise<void> {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Updating Arduino packages...',
            cancellable: true
        }, async (progress, token) => {
            for (const board of boards) {
                if (token.isCancellationRequested) {
                    this.outputChannel.appendLine('[Update] Update cancelled by user.');
                    vscode.window.showInformationMessage('Arduino packages update cancelled.');
                    return;
                }
                try {
                    await this.cliManager.upgradeCore(board.id, token);
                } catch (error) {
                    if (token.isCancellationRequested || error instanceof vscode.CancellationError) {
                        vscode.window.showInformationMessage('Arduino packages update cancelled.');
                        return;
                    }
                    this.outputChannel.appendLine(`[Update] Failed to upgrade board package ${board.name}: ${error}`);
                }
            }
            for (const lib of libs) {
                if (token.isCancellationRequested) {
                    this.outputChannel.appendLine('[Update] Update cancelled by user.');
                    vscode.window.showInformationMessage('Arduino packages update cancelled.');
                    return;
                }
                try {
                    await this.cliManager.upgradeLibrary(lib.id, token);
                } catch (error) {
                    if (token.isCancellationRequested || error instanceof vscode.CancellationError) {
                        vscode.window.showInformationMessage('Arduino packages update cancelled.');
                        return;
                    }
                    this.outputChannel.appendLine(`[Update] Failed to upgrade library ${lib.name}: ${error}`);
                }
            }
            vscode.window.showInformationMessage('Arduino packages updated.');
        });
    }
}
