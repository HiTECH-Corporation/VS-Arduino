import * as vscode from 'vscode';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fsPromises from 'fs/promises';
import * as fs from 'fs';
import * as https from 'https';
import * as os from 'os';

const execAsync = promisify(exec);

export class ArduinoCliManager {
    constructor(
        private context: vscode.ExtensionContext,
        private outputChannel: vscode.OutputChannel
    ) {}

    public async initialize(): Promise<void> {
        this.outputChannel.appendLine('Checking for arduino-cli...');
        
        try {
            const config = vscode.workspace.getConfiguration('vs-arduino');
            const configuredPath = config.get<string>('arduinoCliPath');

            if (configuredPath) {
                this.outputChannel.appendLine(`Configured arduino-cli path found: ${configuredPath}`);
                await this.verifyCliPath(configuredPath);
                return;
            }

            // Check system PATH
            this.outputChannel.appendLine('Checking system PATH for arduino-cli...');
            const { stdout } = await execAsync('arduino-cli version');
            this.outputChannel.appendLine(`Found arduino-cli in PATH: ${stdout.trim()}`);
            
            // Save to configuration
            await config.update('arduinoCliPath', 'arduino-cli', vscode.ConfigurationTarget.Global);
            this.outputChannel.appendLine('Saved "arduino-cli" to workspace configuration.');
            
        } catch (error) {
            this.outputChannel.appendLine('arduino-cli not found in PATH or configured path is invalid.');
            await this.promptUserForCli();
        }
    }

    private async verifyCliPath(cliPath: string): Promise<void> {
        try {
            const { stdout } = await execAsync(`"${cliPath}" version`);
            this.outputChannel.appendLine(`arduino-cli verified successfully: ${stdout.trim()}`);
        } catch (error) {
            this.outputChannel.appendLine(`Configured arduino-cli path is invalid: ${cliPath}`);
            throw error;
        }
    }

    private async promptUserForCli(): Promise<void> {
        const downloadOption = 'Download Automatically';
        const browseOption = 'Browse...';

        const choice = await vscode.window.showInformationMessage(
            'arduino-cli was not found. How would you like to configure it?',
            downloadOption,
            browseOption
        );

        if (choice === downloadOption) {
            await this.downloadArduinoCli();
        } else if (choice === browseOption) {
            await this.browseForArduinoCli();
        } else {
            this.outputChannel.appendLine('arduino-cli configuration skipped by user.');
        }
    }

    private async downloadArduinoCli(): Promise<void> {
        this.outputChannel.appendLine('Downloading arduino-cli installation script...');
        
        try {
            const extensionFolder = this.context.globalStorageUri.fsPath;
            await fsPromises.mkdir(extensionFolder, { recursive: true });

            const isWindows = os.platform() === 'win32';
            const scriptUrl = isWindows 
                ? 'https://raw.githubusercontent.com/arduino/arduino-cli/master/install.ps1'
                : 'https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh';
            
            const scriptName = isWindows ? 'install.ps1' : 'install.sh';
            const scriptPath = path.join(extensionFolder, scriptName);

            await this.downloadFile(scriptUrl, scriptPath);
            this.outputChannel.appendLine(`Installation script downloaded to: ${scriptPath}`);
            vscode.window.showInformationMessage('Arduino CLI install script downloaded. Execution will be implemented in Phase 2.');
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`Failed to download arduino-cli script: ${errorMessage}`);
            vscode.window.showErrorMessage(`Failed to download arduino-cli script: ${errorMessage}`);
        }
    }

    private downloadFile(url: string, dest: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(dest);
            https.get(url, (response) => {
                if (response.statusCode === 301 || response.statusCode === 302) {
                    if (response.headers.location) {
                        return this.downloadFile(response.headers.location, dest).then(resolve).catch(reject);
                    } else {
                        return reject(new Error('Redirected without location header'));
                    }
                }
                
                if (response.statusCode !== 200) {
                    return reject(new Error(`Failed to download, status code: ${response.statusCode}`));
                }

                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
            }).on('error', (err) => {
                fsPromises.unlink(dest).catch(() => {});
                reject(err);
            });
        });
    }

    private async browseForArduinoCli(): Promise<void> {
        const uris = await vscode.window.showOpenDialog({
            canSelectMany: false,
            openLabel: 'Select arduino-cli executable',
            filters: os.platform() === 'win32' ? { 'Executables': ['exe'] } : undefined
        });

        if (uris && uris.length > 0) {
            const selectedPath = uris[0].fsPath;
            try {
                await this.verifyCliPath(selectedPath);
                
                const config = vscode.workspace.getConfiguration('vs-arduino');
                await config.update('arduinoCliPath', selectedPath, vscode.ConfigurationTarget.Global);
                
                this.outputChannel.appendLine(`Saved custom path to configuration: ${selectedPath}`);
                vscode.window.showInformationMessage('arduino-cli configured successfully!');
            } catch (error) {
                vscode.window.showErrorMessage('Selected file is not a valid arduino-cli executable.');
            }
        } else {
            this.outputChannel.appendLine('arduino-cli selection cancelled by user.');
        }
    }

    private runCliCommandJson(args: string[]): Promise<any> {
        return new Promise((resolve, reject) => {
            const config = vscode.workspace.getConfiguration('vs-arduino');
            const cliPath = config.get<string>('arduinoCliPath') || 'arduino-cli';
            const dataDir = config.get<string>('arduinoDataDir');
            
            const mappedArgs = args.map(a => a.includes(' ') ? `"${a}"` : a);
            const env = dataDir ? { ...process.env, ARDUINO_DIRECTORIES_USER: dataDir } : process.env;
            const child = spawn(`"${cliPath}"`, mappedArgs, { shell: true, env });
            let stdoutStr = '';
            let stderrStr = '';

            child.stdout.on('data', (data: Buffer) => {
                stdoutStr += data.toString();
            });

            child.stderr.on('data', (data: Buffer) => {
                stderrStr += data.toString();
            });

            child.on('close', (code: number) => {
                if (code === 0) {
                    try {
                        const parsed = JSON.parse(stdoutStr);
                        resolve(parsed);
                    } catch (e) {
                        reject(new Error(`Failed to parse JSON: ${e}`));
                    }
                } else {
                    reject(new Error(`Command failed with exit code ${code}\n${stderrStr}`));
                }
            });
            
            child.on('error', (err: Error) => {
                reject(err);
            });
        });
    }

    public async getBoardListAll(): Promise<any[]> {
        try {
            const data = await this.runCliCommandJson(['board', 'listall', '--format', 'json']);
            return data.boards || [];
        } catch (error) {
            this.outputChannel.appendLine(`Error getting board list: ${error}`);
            throw error;
        }
    }

    public async getProgrammers(fqbn: string): Promise<any[]> {
        try {
            const data = await this.runCliCommandJson(['board', 'details', '-b', fqbn, '--format', 'json']);
            return data.programmers || [];
        } catch (error) {
            this.outputChannel.appendLine(`Error getting programmers: ${error}`);
            throw error;
        }
    }

    public async getDebugInfo(fqbn: string, sketchPath: string, programmer?: string, port?: string, buildPath?: string): Promise<any> {
        try {
            const args = ['debug', '--info', '--format', 'json', '-b', fqbn];
            if (programmer) { args.push('-P', programmer); }
            if (port) { args.push('-p', port); }
            if (buildPath) { args.push('--build-path', buildPath); }
            args.push(sketchPath);
            const data = await this.runCliCommandJson(args);
            return data;
        } catch (error) {
            this.outputChannel.appendLine(`Error getting debug info: ${error}`);
            throw error;
        }
    }

    public async searchLibrary(query: string): Promise<any[]> {
        try {
            const args = ['lib', 'search', '--format', 'json'];
            if (query && query.trim() !== '') {
                args.splice(2, 0, query.trim());
            }
            const data = await this.runCliCommandJson(args);
            return data.libraries || [];
        } catch (error) {
            this.outputChannel.appendLine(`Error searching library: ${error}`);
            throw error;
        }
    }

    public async searchCore(query: string): Promise<any[]> {
        try {
            const args = ['core', 'search', '--format', 'json'];
            if (query && query.trim() !== '') {
                args.splice(2, 0, query.trim());
            }
            const data = await this.runCliCommandJson(args);
            return data?.platforms || [];
        } catch (error) {
            this.outputChannel.appendLine(`Error searching core: ${error}`);
            throw error;
        }
    }

    public async getLibraryDetails(name: string): Promise<any> {
        try {
            const data = await this.runCliCommandJson(['lib', 'search', name, '--format', 'json']);
            const lib = (data.libraries || []).find((l: any) => l.name === name || (l.library && l.library.name === name));
            return lib;
        } catch (error) {
            this.outputChannel.appendLine(`Error getting library details: ${error}`);
            throw error;
        }
    }

    public async getCoreDetails(name: string): Promise<any> {
        try {
            const data = await this.runCliCommandJson(['core', 'search', name, '--all', '--format', 'json']);
            return Array.isArray(data) && data.length > 0 ? data[0] : data;
        } catch (error) {
            this.outputChannel.appendLine(`Error getting core details: ${error}`);
            throw error;
        }
    }

    public async installLibrary(name: string, version?: string): Promise<void> {
        const pkg = version ? `${name}@${version}` : name;
        this.outputChannel.show(true);
        this.outputChannel.appendLine(`Installing library ${pkg}...`);
        await this.runCliCommandStream(['lib', 'install', pkg]);
    }

    public async installCore(name: string, version?: string): Promise<void> {
        const pkg = version ? `${name}@${version}` : name;
        this.outputChannel.show(true);
        this.outputChannel.appendLine(`Installing core ${pkg}...`);
        await this.runCliCommandStream(['core', 'install', pkg]);
    }

    public async uninstallLibrary(name: string): Promise<void> {
        this.outputChannel.show(true);
        this.outputChannel.appendLine(`Uninstalling library ${name}...`);
        await this.runCliCommandStream(['lib', 'uninstall', name]);
    }

    public async uninstallCore(name: string): Promise<void> {
        this.outputChannel.show(true);
        this.outputChannel.appendLine(`Uninstalling core ${name}...`);
        await this.runCliCommandStream(['core', 'uninstall', name]);
    }

    public async listInstalledLibraries(): Promise<any[]> {
        try {
            const data = await this.runCliCommandJson(['lib', 'list', '--format', 'json']);
            return data.installed_libraries || [];
        } catch (error) {
            this.outputChannel.appendLine(`Error getting installed libraries: ${error}`);
            throw error;
        }
    }

    public async listInstalledCores(): Promise<any[]> {
        try {
            const data = await this.runCliCommandJson(['core', 'list', '--format', 'json']);
            return data?.platforms || [];
        } catch (error) {
            this.outputChannel.appendLine(`Error getting installed cores: ${error}`);
            throw error;
        }
    }

    public async getReadmeContent(installDir: string): Promise<string | null> {
        if (!installDir) return null;
        try {
            const readmePath = path.join(installDir, 'README.md');
            await fsPromises.access(readmePath);
            const content = await fsPromises.readFile(readmePath, 'utf-8');
            return content;
        } catch (error) {
            return null;
        }
    }

    public async getConnectedPorts(): Promise<any[]> {
        try {
            const data = await this.runCliCommandJson(['board', 'list', '--format', 'json']);
            return data.detected_ports || [];
        } catch (error) {
            this.outputChannel.appendLine(`Error getting ports: ${error}`);
            throw error;
        }
    }

    public async autoDetectBoardAndPort(): Promise<any> {
        try {
            const data = await this.runCliCommandJson(['board', 'list', '--format', 'json']);
            const ports = data.detected_ports || [];
            for (const p of ports) {
                if (p.matching_boards && p.matching_boards.length > 0) {
                    return {
                        port: p.port.address,
                        boardFqbn: p.matching_boards[0].fqbn,
                        boardName: p.matching_boards[0].name
                    };
                }
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    private async getConfigFileArg(): Promise<string[]> {
        const pathsToCheck = [
            path.join(os.homedir(), '.arduinoIDE', 'arduino-cli.yaml'),
            path.join(os.homedir(), '.arduino15', 'arduino-cli.yaml'),
            os.platform() === 'win32' ? path.join(os.homedir(), 'AppData', 'Local', 'Arduino15', 'arduino-cli.yaml') : ''
        ];
        
        for (const p of pathsToCheck) {
            if (!p) continue;
            try {
                await fsPromises.stat(p);
                return ['--config-file', p];
            } catch (e) {
                // Ignore missing file
            }
        }
        return [];
    }

    public async compile(fqbn: string, sketchPath: string, optimizeForDebug: boolean = false, buildPath?: string): Promise<{ stdout: string, stderr: string }> {
        const configArg = await this.getConfigFileArg();
        const args = ['compile', '--no-color', ...configArg, '-b', fqbn, sketchPath];
        if (optimizeForDebug) { args.push('--optimize-for-debug'); }
        if (buildPath) { args.push('--build-path', buildPath); }
        
        const config = vscode.workspace.getConfiguration('vs-arduino');
        const sketchbookPath = config.get<string>('sketchbookPath');
        if (sketchbookPath) {
            args.push('--libraries', path.join(sketchbookPath, 'libraries'));
        }
        return this.runCliCommandStream(args);
    }

    public async upload(fqbn: string, port: string, sketchPath: string): Promise<{ stdout: string, stderr: string }> {
        const configArg = await this.getConfigFileArg();
        const args = ['compile', '--upload', '--no-color', ...configArg, '-b', fqbn, '-p', port, sketchPath];
        
        const config = vscode.workspace.getConfiguration('vs-arduino');
        const sketchbookPath = config.get<string>('sketchbookPath');
        if (sketchbookPath) {
            args.push('--libraries', path.join(sketchbookPath, 'libraries'));
        }
        return this.runCliCommandStream(args);
    }

    private runCliCommandStream(args: string[]): Promise<{ stdout: string, stderr: string }> {
        return new Promise((resolve, reject) => {
            const config = vscode.workspace.getConfiguration('vs-arduino');
            const cliPath = config.get<string>('arduinoCliPath') || 'arduino-cli';
            const dataDir = config.get<string>('arduinoDataDir');
            
            const mappedArgs = args.map(a => a.includes(' ') ? `"${a}"` : a);
            const env = dataDir ? { ...process.env, ARDUINO_DIRECTORIES_USER: dataDir } : process.env;
            const child = spawn(`"${cliPath}"`, mappedArgs, { shell: true, env });
            let stdoutStr = '';
            let stderrStr = '';

            child.stdout.on('data', (data: Buffer) => {
                const str = data.toString();
                stdoutStr += str;
                this.outputChannel.append(str);
            });

            child.stderr.on('data', (data: Buffer) => {
                const str = data.toString();
                stderrStr += str;
                this.outputChannel.append(str);
            });

            child.on('close', (code: number) => {
                if (code === 0) {
                    resolve({ stdout: stdoutStr, stderr: stderrStr });
                } else {
                    const err = new Error(`Command failed with exit code ${code}`);
                    (err as any).stderr = stderrStr;
                    (err as any).stdout = stdoutStr;
                    reject(err);
                }
            });
            
            child.on('error', (err: Error) => {
                reject(err);
            });
        });
    }
}
