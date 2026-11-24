import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fsPromises from 'fs/promises';
import * as fs from 'fs';
import { ArduinoCliManager } from './ArduinoCliManager';

function debounce<T extends (...args: any[]) => void>(fn: T, wait: number): T {
    let timeout: NodeJS.Timeout | undefined;
    return ((...args: any[]) => {
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => fn(...args), wait);
    }) as T;
}

interface BoardProperties {
    includePaths: string[];
    defines: string[];
    compilerPath: string;
}

export class IntelliSenseManager {
    private channel: vscode.OutputChannel;
    private cliManager: ArduinoCliManager;
    private includeActiveCache: { [file: string]: string } = {};
    private debouncedRegenerate: { [file: string]: () => void } = {};
    private _docs: { [file: string]: string } = {};
    private compilationCache: { [file: string]: { activeIncludes: string; fqbn: string; properties: BoardProperties; } } = {};
    private isRegenerating: { [file: string]: boolean } = {};
    private pendingRegenerate: { [file: string]: boolean } = {};
    private context: vscode.ExtensionContext | undefined;

    constructor(channel: vscode.OutputChannel, cliManager: ArduinoCliManager) {
        this.channel = channel;
        this.cliManager = cliManager;
    }

    public initialize(context: vscode.ExtensionContext) {
        this.context = context;

        context.subscriptions.push(vscode.workspace.onDidCreateFiles(event => {
            event.files.forEach(uri => {
                if (uri.fsPath.endsWith('.ino')) {
                    this.handleNewSketch(uri.fsPath);
                }
            });
        }));

        const inoWatcher = vscode.workspace.createFileSystemWatcher('**/*.ino', false, true, true);
        context.subscriptions.push(inoWatcher);
        inoWatcher.onDidCreate(uri => this.handleNewSketch(uri.fsPath));

        vscode.workspace.textDocuments
            .filter(doc => doc.fileName.endsWith('.ino') && !this.isInsideVscodeDir(doc.fileName))
            .forEach(doc => {
                this._docs[doc.fileName] = doc.getText();
                this.checkIncludesAndRegenerate(doc.fileName);
            });

        this.scanWorkspaceSketches();

        context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(doc => {
            if (!doc.fileName.endsWith('.ino') || this.isInsideVscodeDir(doc.fileName)) return;
            this._docs[doc.fileName] = doc.getText();
            this.channel.appendLine(`[IntelliSense] Saved file ${doc.fileName}, checking if #includes have changed`);
            this.checkIncludesAndRegenerate(doc.fileName);
        }));

        context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(doc => {
            if (!doc.fileName.endsWith('.ino') || this.isInsideVscodeDir(doc.fileName)) return;
            this._docs[doc.fileName] = doc.getText();
            this.channel.appendLine(`[IntelliSense] Opened file ${doc.fileName}, regenerating IntelliSense`);
            this.checkIncludesAndRegenerate(doc.fileName);
        }));

        context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
            const doc = event.document;
            if (!doc.fileName.endsWith('.ino') || this.isInsideVscodeDir(doc.fileName)) return;

            this._docs[doc.fileName] = doc.getText();

            if (!this.debouncedRegenerate[doc.fileName]) {
                this.debouncedRegenerate[doc.fileName] = debounce(() => {
                    this.checkIncludesAndRegenerate(doc.fileName);
                }, 2000);
            }

            const includeLineChanged = event.contentChanges.some(change => {
                const startLine = change.range.start.line;
                const endLine = change.range.end.line;
                for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
                    const line = doc.lineAt(lineNum).text;
                    if (line.includes('#include') || line.includes('include') || change.text.includes('#include')) {
                        return true;
                    }
                }
                return false;
            });

            if (includeLineChanged) {
                this.debouncedRegenerate[doc.fileName]();
            }
        }));

        context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(doc => {
            if (!doc.fileName.endsWith('.ino')) return;
            delete this._docs[doc.fileName];
            delete this.includeActiveCache[doc.fileName];
            delete this.debouncedRegenerate[doc.fileName];
            delete this.compilationCache[doc.fileName];
            delete this.isRegenerating[doc.fileName];
            delete this.pendingRegenerate[doc.fileName];
        }));

        context.subscriptions.push(vscode.workspace.onDidDeleteFiles(event => {
            event.files.forEach(uri => {
                const fsPath = uri.fsPath;
                delete this._docs[fsPath];
                delete this.includeActiveCache[fsPath];
                delete this.debouncedRegenerate[fsPath];
                delete this.compilationCache[fsPath];
                delete this.isRegenerating[fsPath];
                delete this.pendingRegenerate[fsPath];
            });
        }));
    }

    private isInsideVscodeDir(filePath: string): boolean {
        return filePath.split(/[\\/]/).includes('.vscode');
    }

    private async scanWorkspaceSketches() {
        try {
            const files = await vscode.workspace.findFiles('**/*.ino', '{**/node_modules/**,**/.vscode/**}', 10);
            for (const file of files) {
                if (this._docs[file.fsPath] !== undefined) continue;
                this.channel.appendLine(`[IntelliSense] Found workspace sketch ${file.fsPath}, ensuring IntelliSense configuration`);
                await this.checkIncludesAndRegenerate(file.fsPath);
            }
        } catch (err) {
            this.channel.appendLine(`[IntelliSense] Workspace sketch scan failed: ${err}`);
        }
    }

    private async removeLegacySketchCopy(sketchPath: string) {
        const sketchName = path.basename(sketchPath, '.ino');
        const legacyDir = path.join(path.dirname(sketchPath), '.vscode', sketchName);
        try {
            const legacyIno = path.join(legacyDir, `${sketchName}.ino`);
            await fsPromises.access(legacyIno);
            await fsPromises.rm(legacyDir, { recursive: true, force: true });
            this.channel.appendLine(`[IntelliSense] Removed legacy sketch copy at ${legacyDir}`);
        } catch {
        }
    }

    private async handleNewSketch(sketchPath: string) {

        if (this.isInsideVscodeDir(sketchPath)) return;

        this.channel.appendLine(`[IntelliSense] Detected new sketch ${sketchPath}, creating IntelliSense configuration`);

        await this.ensureDefaultConfig(sketchPath);

        this.checkIncludesAndRegenerate(sketchPath);
    }

    public updateAllSketchesInWorkspace() {

        this.compilationCache = {};
        vscode.workspace.textDocuments
            .filter(doc => doc.fileName.endsWith('.ino') && !this.isInsideVscodeDir(doc.fileName))
            .forEach(doc => {
                this._docs[doc.fileName] = doc.getText();
                this.regenerateIntellisense(doc.fileName, this.extractIncludes(doc.getText()));
            });
    }

    private async ensureDefaultConfig(sketchPath: string) {
        const sketchDir = path.dirname(sketchPath);
        const vscodeDir = path.join(sketchDir, '.vscode');
        const configPath = path.join(vscodeDir, 'c_cpp_properties.json');

        if (fs.existsSync(configPath)) {
            if (!this.isConfigComplete(configPath)) {
                const config = vscode.workspace.getConfiguration('vs-arduino');
                const FQBN = config.get<string>('board') || 'arduino:avr:uno';
                const cachedProps = this.getCachedBoardProperties(FQBN);
                if (cachedProps) {
                    try {
                        await fsPromises.writeFile(configPath, JSON.stringify(this.buildConfig(FQBN, cachedProps), null, 4));
                        this.channel.appendLine(`[IntelliSense] Upgraded incomplete config from cached board properties at ${configPath}`);
                    } catch (err) {
                        this.channel.appendLine(`[IntelliSense] Error upgrading incomplete config: ${err}`);
                    }
                }
                return;
            }
            this.channel.appendLine(`[IntelliSense] Config already exists at ${configPath}, skipping default creation`);
            return;
        }

        try {
            await fsPromises.mkdir(vscodeDir, { recursive: true });

            const config = vscode.workspace.getConfiguration('vs-arduino');
            const FQBN = config.get<string>('board') || 'arduino:avr:uno';

            const cachedProps = this.getCachedBoardProperties(FQBN);
            if (cachedProps) {
                await fsPromises.writeFile(configPath, JSON.stringify(this.buildConfig(FQBN, cachedProps), null, 4));
                this.channel.appendLine(`[IntelliSense] Created full config from cached board properties at ${configPath}`);
                return;
            }

            const defaultConfig = {
                configurations: [
                    {
                        name: FQBN,
                        includePath: ['${workspaceFolder}/**'],
                        forcedInclude: [],
                        defines: [],
                        compilerPath: '',
                        cStandard: 'c11',
                        cppStandard: 'c++17',
                        intelliSenseMode: 'gcc-x64'
                    }
                ],
                version: 4
            };

            await fsPromises.writeFile(configPath, JSON.stringify(defaultConfig, null, 4));
            this.channel.appendLine(`[IntelliSense] Created default config at ${configPath}`);
        } catch (err) {
            this.channel.appendLine(`[IntelliSense] Error creating default config: ${err}`);
        }
    }

    private fqbnPropsKey(fqbn: string): string {
        return `intellisense.boardProperties.${fqbn}`;
    }

    private getCachedBoardProperties(fqbn: string): BoardProperties | undefined {
        const props = this.context?.globalState.get<BoardProperties>(this.fqbnPropsKey(fqbn));
        if (props && props.compilerPath && fs.existsSync(props.compilerPath)) {
            return props;
        }
        return undefined;
    }

    private async cacheBoardProperties(fqbn: string, props: BoardProperties) {
        try {
            await this.context?.globalState.update(this.fqbnPropsKey(fqbn), props);
        } catch (err) {
            this.channel.appendLine(`[IntelliSense] Failed to cache board properties: ${err}`);
        }
    }

    private isConfigComplete(configPath: string): boolean {
        try {
            const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            const compilerPath = parsed?.configurations?.[0]?.compilerPath;
            return typeof compilerPath === 'string' && compilerPath.length > 0;
        } catch (err) {
            return false;
        }
    }

    private buildConfig(FQBN: string, props: BoardProperties) {
        const arduinoHPath = this.findArduinoH(props.includePaths);
        return {
            configurations: [
                {
                    name: FQBN,
                    includePath: ['${workspaceFolder}/**', ...props.includePaths],
                    forcedInclude: arduinoHPath ? [arduinoHPath] : [],
                    defines: props.defines,
                    compilerPath: props.compilerPath,
                    cStandard: 'c11',
                    cppStandard: 'c++17',
                    intelliSenseMode: this.getIntelliSenseMode(props.compilerPath)
                }
            ],
            version: 4
        };
    }

    private extractIncludes(text: string): string {
        const includeRegex = /^\s*#include\s*[<"]([^>"]+)[>"]/;
        const activeIncludeStatements: string[] = [];
        for (const line of text.split(/\r?\n/)) {
            if (line.includes('include')) {
                const match = line.match(includeRegex);
                if (match) {
                    activeIncludeStatements.push(match[1]);
                }
            }
        }
        return activeIncludeStatements.join('\n');
    }

    private async checkIncludesAndRegenerate(sketchPath: string) {

        const configPath = path.join(path.dirname(sketchPath), '.vscode', 'c_cpp_properties.json');

        await this.ensureDefaultConfig(sketchPath);

        let text = this._docs[sketchPath];
        if (text === undefined) {
            try {
                text = await fsPromises.readFile(sketchPath, 'utf8');
                this._docs[sketchPath] = text;
            } catch (err) {
                return;
            }
        }

        const newActiveIncludes = this.extractIncludes(text);
        const oldActive = this.includeActiveCache[sketchPath] || '';
        const configComplete = this.isConfigComplete(configPath);

        if (newActiveIncludes !== oldActive || !configComplete) {
            this.channel.appendLine(`[IntelliSense] #includes changed or config incomplete, regenerating IntelliSense for ${sketchPath}`);
            this.regenerateIntellisense(sketchPath, newActiveIncludes);
        } else {
            this.channel.appendLine(`[IntelliSense] No change in #includes and config is complete for ${sketchPath}, skipping regeneration`);
        }
    }

    private async regenerateIntellisense(sketchPath: string, activeIncludes?: string) {
        if (activeIncludes === undefined) {
            activeIncludes = this.includeActiveCache[sketchPath] || '';
        }

        if (this.isRegenerating[sketchPath]) {
            this.pendingRegenerate[sketchPath] = true;
            this.channel.appendLine(`[IntelliSense] Regeneration already running for ${sketchPath}, queued a follow-up run`);
            return;
        }

        this.isRegenerating[sketchPath] = true;

        const sketchDir = path.dirname(sketchPath);
        const vscodeDir = path.join(sketchDir, '.vscode');

        try {
            await fsPromises.mkdir(vscodeDir, { recursive: true });
            await this.removeLegacySketchCopy(sketchPath);

            const config = vscode.workspace.getConfiguration('vs-arduino');
            const FQBN = config.get<string>('board') || 'arduino:avr:uno';

            this.channel.appendLine(`[IntelliSense] Active includes found: ${activeIncludes.split('\n').join(', ')}`);

            const cache = this.compilationCache[sketchPath];
            let props: BoardProperties;

            if (cache && cache.activeIncludes === activeIncludes && cache.fqbn === FQBN) {
                this.channel.appendLine('[IntelliSense] Using cached compilation results - skipping compilation');
                props = cache.properties;
            } else {
                this.channel.appendLine(`[IntelliSense] Getting properties for board ${FQBN}...`);
                const newProps = await this.getBoardProperties(FQBN, sketchPath, activeIncludes);

                if (!newProps) {
                    this.channel.appendLine('[IntelliSense] Failed to get board properties');
                    return;
                }

                props = newProps;

                this.compilationCache[sketchPath] = {
                    activeIncludes,
                    fqbn: FQBN,
                    properties: props
                };
            }

            const cCppPath = path.join(vscodeDir, 'c_cpp_properties.json');
            await fsPromises.writeFile(cCppPath, JSON.stringify(this.buildConfig(FQBN, props), null, 4));
            this.includeActiveCache[sketchPath] = activeIncludes;
            await this.cacheBoardProperties(FQBN, props);
            this.channel.appendLine(`[IntelliSense] Generated IntelliSense configuration at ${cCppPath}`);

        } catch (err) {
            this.channel.appendLine(`[IntelliSense] Error generating IntelliSense configuration: ${err}`);
        } finally {
            this.isRegenerating[sketchPath] = false;
            if (this.pendingRegenerate[sketchPath]) {
                this.pendingRegenerate[sketchPath] = false;
                this.channel.appendLine(`[IntelliSense] Running queued regeneration for ${sketchPath}`);
                this.checkIncludesAndRegenerate(sketchPath);
            }
        }
    }

    private async getBoardProperties(FQBN: string, sketchPath: string, activeIncludes?: string): Promise<BoardProperties | null> {
        return new Promise(async (resolve) => {
            let tempSketchPath = sketchPath;
            let tempDir: string | undefined;
            let tempRoot: string | undefined;

            if (activeIncludes) {
                const sketchContent = this._docs[sketchPath] ? this._docs[sketchPath] : await fsPromises.readFile(sketchPath, 'utf8');
                const sketchName = path.basename(sketchPath, '.ino');
                const originalSketchDir = path.dirname(sketchPath);

                tempRoot = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'vs-arduino-sketch-'));
                tempDir = path.join(tempRoot, sketchName);
                await fsPromises.mkdir(tempDir, { recursive: true });

                tempSketchPath = path.join(tempDir, `${sketchName}.ino`);
                await fsPromises.writeFile(tempSketchPath, sketchContent);

                const activeIncludeList = sketchContent.split(/\r?\n/)
                    .filter((line: string) => /^\s*#include\s*"([^"]+)"/.test(line))
                    .map((line: string) => {
                        const match = line.match(/^\s*#include\s*"([^"]+)"/);
                        return match ? match[1] : null;
                    })
                    .filter((name: any): name is string => name !== null);

                for (const headerFile of activeIncludeList) {
                    this.channel.appendLine(`[IntelliSense] Searching for header: ${headerFile}`);
                    try {
                        const searchPattern = `**/${headerFile}`;
                        const files = await vscode.workspace.findFiles(searchPattern, '{**/node_modules/**,**/.vscode/**}');

                        if (files.length > 0) {
                            const sourcePath = files[0].fsPath;
                            const relativePath = headerFile.includes('/') ? headerFile : path.basename(headerFile);
                            const targetPath = path.join(tempDir, relativePath);

                            this.channel.appendLine(`[IntelliSense] Found header at: ${sourcePath}`);
                            await fsPromises.mkdir(path.dirname(targetPath), { recursive: true });
                            await fsPromises.copyFile(sourcePath, targetPath);
                            this.channel.appendLine(`[IntelliSense] Copied local header to: ${targetPath}`);
                        } else {
                            const directPath = path.join(originalSketchDir, headerFile);
                            try {
                                await fsPromises.access(directPath);
                                const relativePath = headerFile.includes('/') ? headerFile : path.basename(headerFile);
                                const targetPath = path.join(tempDir, relativePath);
                                await fsPromises.mkdir(path.dirname(targetPath), { recursive: true });
                                await fsPromises.copyFile(directPath, targetPath);
                                this.channel.appendLine(`[IntelliSense] Copied local header (direct path) to: ${targetPath}`);
                            } catch {
                                this.channel.appendLine(`[IntelliSense] Note: ${headerFile} not found in workspace, assuming it's a library include`);
                            }
                        }
                    } catch (err) {
                        this.channel.appendLine(`[IntelliSense] Error processing ${headerFile}: ${err}`);
                    }
                }
            }

            this.channel.appendLine(`[IntelliSense] Compiling sketch ${tempSketchPath} for board ${FQBN}...`);

            const cliPath = vscode.workspace.getConfiguration('vs-arduino').get<string>('arduinoCliPath') || 'arduino-cli';
            const configArg = await this.cliManager.getConfigFileArg();

            let buildDir: string | undefined;
            try {
                buildDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'vs-arduino-intellisense-'));
            } catch (err) {
                this.channel.appendLine(`[IntelliSense] Warning: Failed to create build directory: ${err}`);
            }

            const buildPathArg = buildDir ? ['--build-path', buildDir] : [];
            const additionalUrlsArgs = this.cliManager.getAdditionalUrlsArgs();
            const args = ['compile', ...configArg, ...additionalUrlsArgs, '--fqbn', FQBN, ...buildPathArg, tempSketchPath, '--verbose'];
            const proc = spawn(`"${cliPath}"`, args, { shell: true });
            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (data: Buffer) => stdout += data.toString());
            proc.stderr.on('data', (data: Buffer) => stderr += data.toString());

            proc.on('error', (err) => {
                this.channel.appendLine(`[IntelliSense] Failed to run arduino-cli: ${err}`);
                resolve(null);
            });

            proc.on('close', async () => {
                try {
                    if (tempRoot) {
                        this.channel.appendLine(`[IntelliSense] Cleaning up temp directory: ${tempRoot}`);
                        await fsPromises.rm(tempRoot, { recursive: true, force: true });
                    }
                    if (buildDir) {
                        await fsPromises.rm(buildDir, { recursive: true, force: true });
                    }
                } catch (err) {
                    this.channel.appendLine(`[IntelliSense] Warning: Failed to clean up directories: ${err}`);
                }

                if (stderr) {
                    this.channel.appendLine(`[IntelliSense] arduino-cli error: ${stderr}`);
                }

                const includePaths: string[] = [];
                const defines: string[] = [];
                let compilerPath = '';

                const gppLines = stdout.split(/\r?\n/).filter(l =>
                    (l.includes('avr-g++') ||
                        l.includes('arm-none-eabi-g++') ||
                        l.includes('xtensa-esp32-elf-g++') ||
                        l.includes('xtensa-lx106-elf-g++') ||
                        l.includes('riscv32-esp-elf-g++')) &&
                    l.includes('-I')
                );

                if (gppLines.length > 0) {
                    let iprefix = '';
                    let firstGpp: string | undefined = undefined;
                    let mmcu = 'atmega2560';

                    for (const line of gppLines) {
                        const parts = line.split(' ');

                        if (!firstGpp) {
                            firstGpp = parts.find(p => p.includes('g++'));
                        }

                        const lineMmcu = parts.find(p => p.startsWith('-mmcu='))?.split('=')[1];
                        if (lineMmcu) mmcu = lineMmcu;

                        parts.forEach(p => {
                            if (p.startsWith('-I')) {
                                const inc = p.substring(2);
                                if (!includePaths.includes(inc)) includePaths.push(inc);
                            }
                            if (p.startsWith('-D')) {
                                const def = p.substring(2);
                                if (!defines.includes(def)) defines.push(def);
                            }
                            if (p.startsWith('-iprefix')) {
                                iprefix = p.substring(8);
                            }
                            if (p.startsWith('@') && p.includes('includes.txt')) {
                                const includesFile = p.substring(1);
                                try {
                                    const includesContent = fs.readFileSync(includesFile, 'utf8');
                                    const additionalIncludes = includesContent
                                        .split(/\s+/)
                                        .filter((line: string) => line.startsWith('-I') || line.startsWith('-iwithprefixbefore'))
                                        .map((line: string) => {
                                            let includePath;
                                            if (line.startsWith('-I')) {
                                                includePath = line.substring(2);
                                            } else if (line.startsWith('-iwithprefixbefore')) {
                                                includePath = line.substring(19);
                                            } else {
                                                return '';
                                            }
                                            if (!includePath.startsWith('/') && iprefix && !includePath.match(/^[a-zA-Z]:\\/)) {
                                                return path.join(iprefix, includePath);
                                            }
                                            return includePath;
                                        })
                                        .filter((p: string) => p.length > 0);

                                    additionalIncludes.forEach(inc => {
                                        if (!includePaths.includes(inc)) includePaths.push(inc);
                                    });
                                } catch (err) {

                                }
                            }
                        });
                    }

                    if (firstGpp) {
                        compilerPath = firstGpp;

                        if (compilerPath.includes('arm-none-eabi-g++')) {
                            const armIncludeDir = path.join(path.dirname(compilerPath), '..', 'arm-none-eabi', 'include');
                            includePaths.push(armIncludeDir);
                        } else if (compilerPath.includes('xtensa-esp32-elf-g++')) {
                            const esp32IncludeDir = path.join(path.dirname(compilerPath), '..', 'xtensa-esp32-elf', 'include');
                            includePaths.push(esp32IncludeDir);
                        } else if (compilerPath.includes('xtensa-lx106-elf-g++')) {
                            const esp8266IncludeDir = path.join(path.dirname(compilerPath), '..', 'xtensa-lx106-elf', 'include');
                            includePaths.push(esp8266IncludeDir);
                        } else if (compilerPath.includes('riscv32-esp-elf-g++')) {
                            const riscvIncludeDir = path.join(path.dirname(compilerPath), '..', 'riscv32-esp-elf', 'include');
                            includePaths.push(riscvIncludeDir);
                        } else {
                            const includeDir = path.join(path.dirname(compilerPath), '..', 'avr', 'include');
                            includePaths.push(includeDir);
                        }

                        const stdLibProc = spawn(compilerPath, ['-dM', '-E', '-x', 'c++', '-']);
                        stdLibProc.on('error', (err) => {
                            this.channel.appendLine(`[IntelliSense] Failed to query compiler defines: ${err}`);
                            resolve({ includePaths, defines: [...new Set(defines)], compilerPath });
                        });
                        stdLibProc.stdin.write('#include <stdint.h>\n#include <stdlib.h>\n#include <string.h>\n#include <stdio.h>\n');
                        stdLibProc.stdin.end();

                        let stdLibOutput = '';
                        stdLibProc.stdout.on('data', (data: Buffer) => stdLibOutput += data.toString());

                        stdLibProc.on('close', () => {
                            const stdLibDefines = new Set(
                                stdLibOutput.split('\n')
                                    .filter((line: string) => line.startsWith('#define '))
                                    .map((line: string) => {
                                        const match = line.match(/#define\s+(\w+)(?:\s+|$)/);
                                        return match ? match[1] : null;
                                    })
                                    .filter((d): d is string => d !== null)
                            );

                            let defineArgs: string[] = ['-dM', '-E', '-x', 'c++'];
                            let includeHeaders = '';

                            if (compilerPath.includes('arm-none-eabi-g++')) {
                                includePaths.forEach(p => defineArgs.push(`-I${p}`));
                                includeHeaders = '#include <Arduino.h>\n';
                            } else if (compilerPath.includes('xtensa-esp32-elf-g++')) {
                                includePaths.forEach(p => defineArgs.push(`-I${p}`));
                                includeHeaders = '#include <Arduino.h>\n#include <esp32-hal.h>\n';
                            } else if (compilerPath.includes('xtensa-lx106-elf-g++')) {
                                includePaths.forEach(p => defineArgs.push(`-I${p}`));
                                includeHeaders = '#include <Arduino.h>\n#include <ESP8266WiFi.h>\n';
                            } else if (compilerPath.includes('riscv32-esp-elf-g++')) {
                                includePaths.forEach(p => defineArgs.push(`-I${p}`));
                                includeHeaders = '#include <Arduino.h>\n#include <esp32-hal.h>\n';
                            } else {
                                defineArgs.push(`-mmcu=${mmcu}`);
                                includePaths.forEach(p => defineArgs.push(`-I${p}`));
                                includeHeaders = '#include <avr/io.h>\n';
                            }

                            defineArgs.push('-');
                            const defineProc = spawn(compilerPath, defineArgs);
                            defineProc.on('error', (err) => {
                                this.channel.appendLine(`[IntelliSense] Failed to query hardware defines: ${err}`);
                                resolve({ includePaths, defines: [...new Set(defines)], compilerPath });
                            });
                            defineProc.stdin.write(includeHeaders);
                            defineProc.stdin.end();

                            let defineOutput = '';
                            defineProc.stdout.on('data', (data: Buffer) => defineOutput += data.toString());

                            defineProc.on('close', () => {
                                const hardwareDefines = defineOutput.split('\n')
                                    .filter((line: string) => line.startsWith('#define '))
                                    .map((line: string) => {
                                        const match = line.match(/#define\s+(\w+)(?:\s+|$)/);
                                        return match ? match[1] : null;
                                    })
                                    .filter((d): d is string => d !== null)
                                    .filter(define => !stdLibDefines.has(define))
                                    .filter(this.isArduinoRelevantDefine);

                                defines.push(...hardwareDefines);

                                resolve({
                                    includePaths,
                                    defines: [...new Set(defines)],
                                    compilerPath
                                });
                            });
                        });
                    } else {
                        this.channel.appendLine('[IntelliSense] Could not identify compiler executable in output');
                        resolve(null);
                    }
                } else {
                    this.channel.appendLine('[IntelliSense] No compiler command found in output');
                    resolve(null);
                }
            });
        });
    }

    private isArduinoRelevantDefine(define: string): boolean {
        const excludePatterns = [
            /^ARDUINO_API_H(=|$)/, /^ARDUINO_H(=|$)/, /^ARDUINO_VARIANT_H(=|$)/,
            /^BSP_API_H(=|$)/, /^BSP_CFG_H_(=|$)/, /^BOARD_CFG_H_(=|$)/,
            /^__/, /^_/, /^STD/, /^__GNUC/, /^__cplusplus/, /^__STDC__/, /^__attribute__/
        ];
        if (excludePatterns.some(re => re.test(define))) return false;

        const keepPrefixes = [
            'ARDUINO', 'SERIAL', 'UBRR', 'USART', 'SPI', 'TWI', 'I2C', 'USB',
            '__AVR_', 'F_CPU', 'BOARD_', 'CORE_', 'HAVE_', 'PIN_', 'PORT_', 'LED_BUILTIN'
        ];
        if (keepPrefixes.some(prefix => define.startsWith(prefix))) return true;

        return false;
    }

    private getIntelliSenseMode(compilerPath: string): string {
        if (compilerPath.includes('arm-none-eabi-g++')) return 'gcc-arm';
        if (compilerPath.includes('xtensa-esp32-elf-g++')) return 'gcc-x64';
        if (compilerPath.includes('xtensa-lx106-elf-g++')) return 'gcc-x64';
        if (compilerPath.includes('riscv32-esp-elf-g++')) return 'gcc-x64';
        return 'gcc-x64';
    }

    private findArduinoH(includePaths: string[]): string | null {
        for (const incPath of includePaths) {

            const normalizedPath = incPath.replace(/\//g, path.sep);
            const candidate = path.join(normalizedPath, 'Arduino.h');
            if (fs.existsSync(candidate)) {
                this.channel.appendLine(`[IntelliSense] Found Arduino.h at: ${candidate}`);
                return candidate;
            }
        }
        this.channel.appendLine('[IntelliSense] Warning: Arduino.h not found in any include path');
        return null;
    }
}
