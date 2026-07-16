import { useEffect, useState } from 'react'
import {
  Activity,
  ArrowRight,
  BugPlay,
  Check,
  ChevronsLeftRightEllipsis,
  CircuitBoard,
  EthernetPort,
  LibraryBig,
} from 'lucide-react'
import { vscode } from '../lib/vscode'

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2" role="separator" aria-label={title}>
      <span className="bg-panel-muted h-0.5 flex-1 rounded-full" aria-hidden="true" />
      <span className="text-panel-muted text-[13px] font-medium whitespace-nowrap">
        {title}
      </span>
      <span className="bg-panel-muted h-0.5 flex-1 rounded-full" aria-hidden="true" />
    </div>
  )
}

export function ControlPanel() {
  const [boardName, setBoardName] = useState('')
  const [port, setPort] = useState('')

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data
      if (message?.command === 'updateConfig') {
        setBoardName(message.boardName ?? '')
        setPort(message.port ?? '')
      }
    }
    window.addEventListener('message', handleMessage)
    vscode.postMessage({ command: 'ready' })
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const sendCommand = (command: string) => () => vscode.postMessage({ command })

  return (
    <aside
      aria-label="VS Arduino Control Panel"
      className="bg-panel flex h-full w-full shrink-0 flex-col gap-6 px-[25px] pt-[70px] pb-6"
    >
      <button
        type="button"
        onClick={sendCommand('selectBoard')}
        title="Select Board"
        className="bg-panel-surface hover:bg-panel-surface-hover flex h-[43px] items-center rounded-[9px] transition-colors"
      >
        <div className="flex h-full w-[43px] items-center justify-center">
          <CircuitBoard className="text-panel-text size-5" strokeWidth={2} aria-hidden="true" />
        </div>
        <div className="bg-panel-divider h-full w-px" aria-hidden="true" />
        <p className="text-panel-text flex-1 truncate px-2 text-center text-base font-medium">
          {boardName || 'Select Board'}
        </p>
      </button>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={sendCommand('selectPort')}
          title="Select Port"
          className="bg-panel-surface hover:bg-panel-surface-hover flex h-[39px] w-[107px] items-center gap-2 rounded-[9px] px-3 transition-colors"
        >
          <EthernetPort className="text-panel-text size-5" strokeWidth={2} aria-hidden="true" />
          <span className="text-panel-text flex-1 truncate text-center text-base font-medium">
            {port || 'Port'}
          </span>
          <span className="sr-only">Select serial port</span>
        </button>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={sendCommand('compile')}
            aria-label="Verify sketch"
            title="Compile / Verify"
            className="bg-arduino text-arduino-ink flex size-[38px] items-center justify-center rounded-full transition-opacity hover:opacity-85"
          >
            <Check className="size-5" strokeWidth={2.6} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={sendCommand('upload')}
            aria-label="Upload sketch"
            title="Upload"
            className="bg-arduino-bright text-arduino-ink flex size-[38px] items-center justify-center rounded-full transition-opacity hover:opacity-85"
          >
            <ArrowRight className="size-5" strokeWidth={2.6} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={sendCommand('debug')}
            aria-label="Start debugging"
            title="Debug"
            className="bg-arduino text-arduino-ink flex size-[38px] items-center justify-center rounded-full transition-opacity hover:opacity-85"
          >
            <BugPlay className="size-5" strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
      </div>

      <section aria-labelledby="serial-tools" className="flex flex-col gap-[22px] pt-1">
        <span id="serial-tools" className="sr-only">
          Serial Tools
        </span>
        <SectionHeader title="Serial Tools" />
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={sendCommand('openMonitor')}
            title="Open Serial Monitor"
            className="bg-panel-surface hover:bg-panel-surface-hover flex h-[39px] flex-1 items-center justify-center gap-2.5 rounded-[9px] transition-colors"
          >
            <ChevronsLeftRightEllipsis
              className="text-panel-text size-5"
              strokeWidth={2}
              aria-hidden="true"
            />
            <span className="text-panel-text text-base font-medium">Monitor</span>
          </button>
          <button
            type="button"
            onClick={sendCommand('openPlotter')}
            title="Open Serial Plotter"
            className="bg-panel-surface hover:bg-panel-surface-hover flex h-[39px] flex-1 items-center justify-center gap-2.5 rounded-[9px] transition-colors"
          >
            <Activity className="text-panel-text size-5" strokeWidth={2} aria-hidden="true" />
            <span className="text-panel-text text-base font-medium">Plotter</span>
          </button>
        </div>
      </section>

      <section aria-labelledby="arduino-managers" className="flex flex-col gap-[22px] pt-1">
        <span id="arduino-managers" className="sr-only">
          Arduino Managers
        </span>
        <SectionHeader title="Arduino Managers" />
        <div className="flex flex-col gap-[11px]">
          <button
            type="button"
            onClick={sendCommand('openBoardManager')}
            title="Open Board Manager"
            className="bg-panel-surface hover:bg-panel-surface-hover flex h-[39px] items-center justify-center gap-2.5 rounded-[9px] transition-colors"
          >
            <CircuitBoard className="text-panel-text size-5" strokeWidth={2} aria-hidden="true" />
            <span className="text-panel-text text-base font-medium">Board Manager</span>
          </button>
          <button
            type="button"
            onClick={sendCommand('openLibraryManager')}
            title="Open Library Manager"
            className="bg-panel-surface hover:bg-panel-surface-hover flex h-[39px] items-center justify-center gap-2.5 rounded-[9px] transition-colors"
          >
            <LibraryBig className="text-panel-text size-5" strokeWidth={2} aria-hidden="true" />
            <span className="text-panel-text text-base font-medium">Library Manager</span>
          </button>
        </div>
      </section>
    </aside>
  )
}
