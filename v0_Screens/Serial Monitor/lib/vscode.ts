type VsCodeApi = {
  postMessage(message: unknown): void
}

declare function acquireVsCodeApi(): VsCodeApi

export const vscode = acquireVsCodeApi()
