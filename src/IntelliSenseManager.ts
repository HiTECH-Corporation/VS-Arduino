// Based on vscode-arduino-intellisense by svnty (MIT License). 
// Modified and integrated for VS Arduino.

import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as path from 'path';
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

    constructor(channel: vscode.OutputChannel, cliManager: ArduinoCliManager) {
        this.channel = channel;
        this.cliManager = cliManager;
    }

    public initialize(context: vscode.ExtensionContext) {
        // Watch for file creation from within VS Code
        context.subscriptions.push(vscode.workspace.onDidCreateFiles(event => {
            event.files.forEach(uri => {
                if (uri.fsPath.endsWith('.ino')) {
                    this.handleNewSketch(uri.fsPath);
                }
            });
        }));

        // Watch for .ino files created outside VS Code (file explorer, terminal, git, ...)
        const inoWatcher = vscode.workspace.createFileSystemWatcher('**/*.ino', false, true, true);
        context.subscriptions.push(inoWatcher);
        inoWatcher.onDidCreate(uri => this.handleNewSketch(uri.fsPath));

        // Cover sketches already open when the extension activates
        vscode.workspace.textDocuments
            .filter(doc => doc.fileName.endsWith('.ino'))
            .forEach(doc => {
                this._docs[doc.fileName] = doc.getText();
                this.checkIncludesAndRegenerate(doc.fileName);
            });

        // Watch for file save
        context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(doc => {
            if (!doc.fileName.endsWith('.ino')) return;
            this._docs[doc.fileName] = doc.getText();
            this.channel.appendLine(`[IntelliSense] Saved file ${doc.fileName}, checking if #includes have changed`);
            this.checkIncludesAndRegenerate(doc.fileName);
        }));

        // Watch for file open
        context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(doc => {
            if (!doc.fileName.endsWith('.ino')) return;
            this._docs[doc.fileName] = doc.getText();
            this.channel.appendLine(`[IntelliSense] Opened file ${doc.fileName}, regenerating IntelliSense`);
            this.checkIncludesAndRegenerate(doc.fileName);
        }));

        // Watch for text changes
        context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
            const doc = event.document;
            if (!doc.fileName.endsWith('.ino')) return;
            
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
    }

    private async handleNewSketch(sketchPath: string) {
        // Ignore the temporary sketch copies this manager writes under .vscode/
        // while extracting board properties.
        if (sketchPath.split(/[\\/]/).includes('.vscode')) return;

        this.channel.appendLine(`[IntelliSense] Detected new sketch ${sketchPath}, creating IntelliSense configuration`);
        // Immediately create a default config — even for an empty file — so the
        // C/C++ extension never reports missing includePath/identifiers.
        await this.ensureDefaultConfig(sketchPath);
        // Then trigger the full board-aware regeneration in the background.
        this.checkIncludesAndRegenerate(sketchPath);
    }

    public updateAllSketchesInWorkspace() {
        // Triggered when board changes
        this.compilationCache = {}; // Clear cache on board change
        vscode.workspace.textDocuments
            .filter(doc => doc.fileName.endsWith('.ino'))
            .forEach(doc => this.regenerateIntellisense(doc.fileName));
    }

    private async ensureDefaultConfig(sketchPath: string) {
        const sketchDir = path.dirname(sketchPath);
        const vscodeDir = path.join(sketchDir, '.vscode');
        const configPath = path.join(vscodeDir, 'c_cpp_properties.json');

        if (fs.existsSync(configPath)) {
            this.channel.appendLine(`[IntelliSense] Config already exists at ${configPath}, skipping default creation`);
            return;
        }

        try {
            await fsPromises.mkdir(vscodeDir, { recursive: true });

            const config = vscode.workspace.getConfiguration('vs-arduino');
            const FQBN = config.get<string>('board') || 'arduino:avr:uno';

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

    private async checkIncludesAndRegenerate(sketchPath: string) {
        // Capture whether a config already existed BEFORE creating the fallback,
        // so a freshly created default config still triggers full regeneration.
        const configPath = path.join(path.dirname(sketchPath), '.vscode', 'c_cpp_properties.json');
        const configExists = fs.existsSync(configPath);

        // Always guarantee a config exists first so IntelliSense errors never
        // appear while the full compilation-based generation is in flight.
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

        const includeRegex = /^\s*#include\s+[<"]([^>"]+)[>"]/;
        const lines = text.split(/\r?\n/);
        
        const activeIncludeStatements: string[] = [];
        for (const line of lines) {
            if (line.includes('include')) {
                const match = line.match(includeRegex);
                if (match) {
                    activeIncludeStatements.push(match[1]);
                }
            }
        }

        const newActiveIncludes = activeIncludeStatements.join('\n');
        const oldActive = this.includeActiveCache[sketchPath] || '';

        if (newActiveIncludes !== oldActive || !configExists) {
            this.includeActiveCache[sketchPath] = newActiveIncludes;
            this.channel.appendLine(`[IntelliSense] #includes changed or config missing, regenerating IntelliSense for ${sketchPath}`);
            this.regenerateIntellisense(sketchPath);
        } else {
            this.channel.appendLine(`[IntelliSense] No change in #includes and config exists for ${sketchPath}, skipping regeneration`);
        }
    }

    private async regenerateIntellisense(sketchPath: string) {
        if (this.isRegenerating[sketchPath]) {
            this.channel.appendLine(`[IntelliSense] Skipping regeneration - already running for ${sketchPath}`);
            return;
        }

        this.isRegenerating[sketchPath] = true;

        const sketchDir = path.dirname(sketchPath);
        const vscodeDir = path.join(sketchDir, '.vscode');

        try {
            await fsPromises.mkdir(vscodeDir, { recursive: true });

            const config = vscode.workspace.getConfiguration('vs-arduino');
            const FQBN = config.get<string>('board') || 'arduino:avr:uno';

            const activeIncludes = this.includeActiveCache[sketchPath] || '';
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
                    this.isRegenerating[sketchPath] = false;
                    return;
                }

                props = newProps;

                this.compilationCache[sketchPath] = {
                    activeIncludes,
                    fqbn: FQBN,
                    properties: props
                };
            }

            // Find Arduino.h path for forcedInclude
            const arduinoHPath = this.findArduinoH(props.includePaths);

            const cCppConfig = {
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

            const cCppPath = path.join(vscodeDir, 'c_cpp_properties.json');
            await fsPromises.writeFile(cCppPath, JSON.stringify(cCppConfig, null, 4));
            this.channel.appendLine(`[IntelliSense] Generated IntelliSense configuration at ${cCppPath}`);

        } catch (err) {
            this.channel.appendLine(`[IntelliSense] Error generating IntelliSense configuration: ${err}`);
        } finally {
            this.isRegenerating[sketchPath] = false;
        }
    }

    private async getBoardProperties(FQBN: string, sketchPath: string, activeIncludes?: string): Promise<BoardProperties | null> {
        return new Promise(async (resolve) => {
            let tempSketchPath = sketchPath;
            let tempDir: string | undefined;

            if (activeIncludes) {
                const sketchContent = this._docs[sketchPath] ? this._docs[sketchPath] : await fsPromises.readFile(sketchPath, 'utf8');
                const sketchName = path.basename(sketchPath, '.ino');
                const originalSketchDir = path.dirname(sketchPath);

                tempDir = path.join(originalSketchDir, '.vscode', sketchName);
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
                        const files = await vscode.workspace.findFiles(searchPattern, '**/node_modules/**');

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
            const args = ['compile', ...configArg, '--fqbn', FQBN, tempSketchPath, '--verbose'];
            const proc = spawn(`"${cliPath}"`, args, { shell: true });
            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (data: Buffer) => stdout += data.toString());
            proc.stderr.on('data', (data: Buffer) => stderr += data.toString());

            proc.on('close', async () => {
                try {
                    if (tempDir) {
                        this.channel.appendLine(`[IntelliSense] Cleaning up temp directory: ${tempDir}`);
                        await fsPromises.rm(tempDir, { recursive: true, force: true });
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
                                    // Ignore read errors for includes.txt
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
            // Normalize path separators
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
