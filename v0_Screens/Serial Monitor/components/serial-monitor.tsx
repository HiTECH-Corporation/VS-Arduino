import type React from "react"

import { useEffect, useRef, useState } from "react"
import { ChevronDown, Pilcrow, Trash2, Zap } from "lucide-react"
import { vscode } from "../lib/vscode"

const LINE_ENDINGS = ["No line ending", "Newline (\\n)", "Carriage return (\\r)", "Both NL & CR"]

const LINE_ENDING_CODES: Record<string, string> = {
  "No line ending": "none",
  "Newline (\\n)": "nl",
  "Carriage return (\\r)": "cr",
  "Both NL & CR": "nlcr",
}

const BAUD_RATES = [
  "300 baud",
  "1200 baud",
  "2400 baud",
  "4800 baud",
  "9600 baud",
  "14400 baud",
  "19200 baud",
  "28800 baud",
  "38400 baud",
  "57600 baud",
  "74880 baud",
  "115200 baud",
  "230400 baud",
  "250000 baud",
  "500000 baud",
  "1000000 baud",
  "2000000 baud",
]

const MAX_LOG_LINES = 5000

type SerialLine = { id: number; text: string }

export function SerialMonitor() {
  const [lineEnding, setLineEnding] = useState(LINE_ENDINGS[3])
  const [baudRate, setBaudRate] = useState("115200 baud")
  const [autoscroll, setAutoscroll] = useState(true)
  const [message, setMessage] = useState("")
  const [log, setLog] = useState<SerialLine[]>([])
  const [boardName, setBoardName] = useState("")
  const [port, setPort] = useState("")
  const nextId = useRef(1)
  const pendingChunk = useRef("")
  const outputRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data
      switch (data?.type) {
        case "data": {
          const combined = pendingChunk.current + String(data.value ?? "")
          const parts = combined.split("\n")
          pendingChunk.current = parts.pop() ?? ""
          if (parts.length > 0) {
            setLog((prev) => {
              const appended = parts.map((text) => ({
                id: nextId.current++,
                text: text.replace(/\r$/, ""),
              }))
              const merged = [...prev, ...appended]
              return merged.length > MAX_LOG_LINES ? merged.slice(merged.length - MAX_LOG_LINES) : merged
            })
          }
          break
        }
        case "baudRate": {
          const match = BAUD_RATES.find((rate) => rate.startsWith(`${data.value} `))
          if (match) setBaudRate(match)
          break
        }
        case "config":
          setBoardName(data.boardName ?? "")
          setPort(data.port ?? "")
          break
      }
    }
    window.addEventListener("message", handleMessage)
    vscode.postMessage({ type: "ready" })
    return () => window.removeEventListener("message", handleMessage)
  }, [])

  useEffect(() => {
    if (autoscroll && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [log, autoscroll])

  function changeBaudRate(value: string) {
    setBaudRate(value)
    vscode.postMessage({ type: "changeBaudRate", value: value.replace(" baud", "") })
  }

  function sendMessage() {
    const trimmed = message.trim()
    if (!trimmed) return
    vscode.postMessage({ type: "send", value: trimmed, newline: LINE_ENDING_CODES[lineEnding] })
    setMessage("")
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    event.preventDefault()
    sendMessage()
  }

  const targetLabel =
    boardName && port
      ? `Message (Enter to send message to '${boardName}' on '${port}')`
      : "Message (Enter to send)"

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-panel text-panel-text">
      <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-3 border-b-2 border-panel-muted px-3 py-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <SimpleSelect
            icon={<Pilcrow className="size-5" strokeWidth={1.7} aria-hidden="true" />}
            label="Line ending"
            value={lineEnding}
            values={LINE_ENDINGS}
            onChange={setLineEnding}
            minWidthClass="min-w-[168px]"
          />
          <SimpleSelect
            icon={<Zap className="size-5" strokeWidth={1.7} aria-hidden="true" />}
            label="Baud rate"
            value={baudRate}
            values={BAUD_RATES}
            onChange={changeBaudRate}
            minWidthClass="min-w-[160px]"
          />
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setLog([])}
            className="rounded p-1 text-panel-text hover:bg-panel-surface"
            aria-label="Clear output"
            title="Clear output"
          >
            <Trash2 className="size-5" strokeWidth={1.7} aria-hidden="true" />
          </button>

          <label className="flex cursor-pointer items-center gap-2 text-[15px] font-medium">
            Autoscroll
            <button
              type="button"
              role="switch"
              aria-checked={autoscroll}
              aria-label="Toggle autoscroll"
              onClick={() => setAutoscroll((value) => !value)}
              className={`relative h-2 w-5 rounded-full ${autoscroll ? "bg-arduino-bright" : "bg-[#d9d9d9]"}`}
            >
              <span
                className={`absolute left-0 top-1/2 size-3 -translate-y-1/2 rounded-full transition-transform ${
                  autoscroll ? "translate-x-3 bg-panel-surface-hover" : "-translate-x-1 bg-panel-divider"
                }`}
              />
            </button>
          </label>
        </div>
      </header>

      <section
        ref={outputRef}
        className="min-h-0 flex-1 overflow-auto px-3 py-3 font-mono text-sm leading-relaxed"
        aria-label="Serial output"
      >
        {log.length === 0 ? (
          <p className="text-panel-text/50">No output yet. Waiting for data&hellip;</p>
        ) : (
          <ul className="space-y-0.5">
            {log.map((line) => (
              <li key={line.id} className="whitespace-pre-wrap break-words text-panel-text/90">
                {line.text}
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="flex shrink-0 flex-wrap items-center gap-3 border-t-2 border-panel-muted px-3 py-1.5">
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={targetLabel}
          className="h-9 min-w-52 flex-1 rounded-md bg-[#21252b]/60 px-3 text-sm text-panel-text placeholder:text-panel-text/50 focus:outline-none"
          aria-label="Serial message"
        />
      </footer>
    </main>
  )
}

function SimpleSelect({
  icon,
  label,
  value,
  values,
  onChange,
  minWidthClass = "min-w-40",
}: {
  icon: React.ReactNode
  label: string
  value: string
  values: string[]
  onChange: (value: string) => void
  minWidthClass?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex h-9 items-center gap-2 bg-panel-surface px-3 text-sm font-medium ${minWidthClass} ${open ? "rounded-t-md" : "rounded-md"}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        title={label}
      >
        {icon}
        <span className="flex-1 truncate text-left">{value}</span>
        <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={1.5} aria-hidden="true" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            className="absolute left-0 top-full z-30 max-h-[250px] min-w-full overflow-y-auto rounded-b-md bg-panel-surface shadow-xl shadow-black/40"
            role="listbox"
            aria-label={label}
          >
            {values
              .filter((item) => item !== value)
              .map((item) => (
                <button
                  key={item}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => {
                    onChange(item)
                    setOpen(false)
                  }}
                  className="block h-[35px] w-full whitespace-nowrap pl-10 pr-3 text-left text-sm hover:bg-panel-surface-hover"
                >
                  {item}
                </button>
              ))}
          </div>
        </>
      )}
    </div>
  )
}
