import * as vscode from 'vscode';
import { exec, spawn, ChildProcess } from 'child_process';
import * as os from 'os';
import { ArduinoCliManager } from './ArduinoCliManager';

export class SerialConnectionManager {
    private process: ChildProcess | undefined;
    private currentPort: string | undefined;
    private currentBoard: string | undefined;
    private currentBaudRate: string = '115200';

    private _onData = new vscode.EventEmitter<string>();
    public readonly onData: vscode.Event<string> = this._onData.event;

    private _onPlotData = new vscode.EventEmitter<{values: number[], labels: string[]}>();
    public readonly onPlotData: vscode.Event<{values: number[], labels: string[]}> = this._onPlotData.event;

    private _onStateChange = new vscode.EventEmitter<boolean>();
    public readonly onStateChange: vscode.Event<boolean> = this._onStateChange.event;

    constructor(private cliManager: ArduinoCliManager) {}

    public async start(port?: string, boardFqbn?: string) {
        if (this.process) {
            this.stop();
        }

        const config = vscode.workspace.getConfiguration('vs-arduino');

        this.currentPort = port || config.get<string>('port');
        this.currentBoard = boardFqbn || config.get<string>('board');
        this.currentBaudRate = config.get<string>('baudRate') || '115200';

        if (!this.currentPort || this.currentPort === 'Select Port' ||
            !this.currentBoard || this.currentBoard === 'Select Board') {
            vscode.window.showErrorMessage('Please select a port and board first.');
            return;
        }

        const cliPath = config.get<string>('arduinoCliPath') || 'arduino-cli';

        const configArg = await this.cliManager.getConfigFileArg();

        const args = ['monitor', ...configArg, '-p', this.currentPort, '-b', this.currentBoard, '--config', `baudrate=${this.currentBaudRate}`, '--quiet', '--raw'];

        this.process = spawn(`"${cliPath}"`, args, { shell: true });

        let buffer = '';

        this.process.stdout?.on('data', (data: Buffer) => {
            const str = data.toString();

            this._onData.fire(str);

            buffer += str;
            let newlineIndex;
            while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
                const line = buffer.slice(0, newlineIndex).trim();
                buffer = buffer.slice(newlineIndex + 1);
                this.parseLine(line);
            }
        });

        this.process.on('close', () => {
            this.process = undefined;
            this._onStateChange.fire(false);
        });

        this.process.on('error', (err) => {
            console.error('Serial Connection Process Error:', err);
            this.process = undefined;
            this._onStateChange.fire(false);
        });

        this._onStateChange.fire(true);
    }

    private killProcess(child: ChildProcess): void {
        if (!child || child.killed) { return; }
        if (os.platform() === 'win32' && child.pid) {
            exec(`taskkill /pid ${child.pid} /T /F`, () => {});
        } else {
            child.kill('SIGTERM');
        }
    }

    public stop() {
        if (this.process) {
            this.killProcess(this.process);
            this.process = undefined;
            this._onStateChange.fire(false);
        }
    }

    public sendText(text: string) {
        if (this.process && this.process.stdin) {
            this.process.stdin.write(text);
        }
    }

    public async changeBaudRate(newBaud: string) {
        this.currentBaudRate = newBaud;
        const config = vscode.workspace.getConfiguration('vs-arduino');
        await config.update('baudRate', newBaud, vscode.ConfigurationTarget.Global);

        if (this.process && this.currentPort && this.currentBoard) {
            this.start(this.currentPort, this.currentBoard);
        }
    }

    private parseLine(line: string) {
        if (!line) return;
        const sanitized = line.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        const parts = sanitized.split(/[\s,]+/).filter(p => p !== '');
        const values: number[] = [];
        const labels: string[] = [];

        for (const part of parts) {
            let valStr = part;
            let label = "";
            if (part.includes(':')) {
                const split = part.split(':');
                label = split[0];
                valStr = split[1];
            }
            const num = Number(valStr);
            if (!isNaN(num) && valStr.trim() !== '') {
                values.push(num);
                labels.push(label);
            }
        }

        if (values.length > 0) {
            this._onPlotData.fire({values, labels});
        }
    }

    public isActive(): boolean {
        return this.process !== undefined;
    }

    public getCurrentPort(): string | undefined {
        return this.currentPort;
    }

    public getCurrentBoard(): string | undefined {
        return this.currentBoard;
    }
}
