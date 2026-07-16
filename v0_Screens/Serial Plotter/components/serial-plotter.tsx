import type React from "react"

import { useEffect, useRef, useState } from "react"
import {
  ChartNoAxesCombined,
  ChevronDown,
  FileCodeCorner,
  FileImage,
  Pause,
  Pilcrow,
  Play,
  Trash2,
  X,
  Zap,
} from "lucide-react"
import { vscode } from "../lib/vscode"

type PlotSample = { index: number; values: (number | null)[] }
type HoverPoint = { sample: PlotSample; series: number; px: number; py: number }

const WIDTH = 1200
const HEIGHT = 500
const PAD = { top: 20, right: 24, bottom: 34, left: 54 }
const PLOT_WIDTH = WIDTH - PAD.left - PAD.right
const PLOT_HEIGHT = HEIGHT - PAD.top - PAD.bottom
const WINDOW_SIZE = 120
const MAX_SAMPLES = 2000
const MIN_ZOOM = 1
const MAX_ZOOM = 64

const SERIES_COLORS = [
  "#0ca1a6",
  "#e0533d",
  "#3878af",
  "#d4a72c",
  "#8e5bd8",
  "#4caf50",
  "#e07b39",
  "#c94f7c",
  "#00bcd4",
  "#f44336",
  "#8bc34a",
  "#ffc107",
  "#9c27b0",
  "#03a9f4",
  "#ff9800",
  "#a1887f",
  "#607d8b",
  "#e91e63",
  "#cddc39",
  "#3f51b5",
]

const PLOT_MODES = ["Waveform", "Multi-line", "Sensor", "Digital Pulse", "Step Graph", "Binary Bit Stream"]
const STEPPED_MODES = ["Digital Pulse", "Step Graph", "Binary Bit Stream"]

const LINE_ENDINGS = ["No line ending", "Newline", "Carriage return", "Both NL & CR"]

const LINE_ENDING_CODES: Record<string, string> = {
  "No line ending": "none",
  Newline: "nl",
  "Carriage return": "cr",
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

function seriesLabel(labels: string[], index: number) {
  const label = labels[index]?.trim()
  return label && label.length > 0 ? label : `Plot ${String.fromCharCode(65 + index)}`
}

function seriesColor(index: number) {
  return SERIES_COLORS[index % SERIES_COLORS.length]
}

export function SerialPlotter() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [samples, setSamples] = useState<PlotSample[]>([])
  const [labels, setLabels] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [interpolate, setInterpolate] = useState(true)
  const [hidden, setHidden] = useState<Record<number, boolean>>({})
  const [hover, setHover] = useState<HoverPoint | null>(null)
  const [chartMenu, setChartMenu] = useState(false)
  const [chartMode, setChartMode] = useState(PLOT_MODES[0])
  const [lineEnding, setLineEnding] = useState(LINE_ENDINGS[3])
  const [baud, setBaud] = useState("115200 baud")
  const [message, setMessage] = useState("")
  const [boardName, setBoardName] = useState("")
  const [port, setPort] = useState("")
  const [zoomScale, setZoomScale] = useState(1)
  const [panOffset, setPanOffset] = useState(0)
  // Actual on-screen scale factors of the SVG viewBox — used to keep circular
  // markers round even though the SVG stretches (preserveAspectRatio="none").
  const [viewScale, setViewScale] = useState({ sx: 1, sy: 1 })
  const sampleCounter = useRef(0)
  const viewRef = useRef({ scale: 1, offset: 0 })
  const domainRef = useRef({ min: -1.2, max: 1.2 })
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const gestureRef = useRef<
    | { mode: "pan"; lastY: number }
    | { mode: "pinch"; startDistance: number; startScale: number }
    | null
  >(null)

  viewRef.current = { scale: zoomScale, offset: panOffset }

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data
      switch (data?.type) {
        case "data": {
          const values: number[] = Array.isArray(data.values) ? data.values : []
          if (values.length === 0) break
          if (Array.isArray(data.labels)) setLabels(data.labels)
          setSamples((prev) => {
            const next = [...prev, { index: sampleCounter.current++, values }]
            return next.length > MAX_SAMPLES ? next.slice(next.length - MAX_SAMPLES) : next
          })
          break
        }
        case "state":
          setRunning(Boolean(data.isActive))
          break
        case "clear":
          sampleCounter.current = 0
          setSamples([])
          setHover(null)
          break
        case "baudRate": {
          const match = BAUD_RATES.find((rate) => rate.startsWith(`${data.value} `))
          if (match) setBaud(match)
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

  // Ctrl + wheel (and trackpad pinch, which browsers report as ctrl+wheel) zooms the plot.
  // Attached natively because React registers wheel listeners as passive.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      const { scale, offset } = viewRef.current
      const factor = event.deltaY < 0 ? 1.2 : 1 / 1.2
      const nextScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale * factor))
      if (nextScale === scale) return
      const rect = svg.getBoundingClientRect()
      const fy = (event.clientY - rect.top) / rect.height
      const { min, max } = domainRef.current
      const range = max - min || 1
      const baseMid = (min + max) / 2
      const mid = baseMid + offset * range
      const half = range / (2 * scale)
      const anchorValue = mid + half * (1 - 2 * fy)
      const nextHalf = range / (2 * nextScale)
      const nextMid = anchorValue - nextHalf * (1 - 2 * fy)
      setZoomScale(nextScale)
      setPanOffset((nextMid - baseMid) / range)
    }
    svg.addEventListener("wheel", onWheel, { passive: false })
    return () => svg.removeEventListener("wheel", onWheel)
  }, [])

  // Track the rendered aspect ratio so hover markers can compensate for the
  // non-uniform viewBox stretch and stay perfectly circular.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const update = () => {
      const rect = svg.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setViewScale({ sx: rect.width / WIDTH, sy: rect.height / HEIGHT })
      }
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(svg)
    return () => observer.disconnect()
  }, [])

  const windowSamples = samples.slice(-(WINDOW_SIZE + 1))
  const windowStart = windowSamples.length > 0 ? windowSamples[0].index : 0
  const seriesCount = Math.max(labels.length, ...windowSamples.map((sample) => sample.values.length), 0)

  let yBaseMin = Number.POSITIVE_INFINITY
  let yBaseMax = Number.NEGATIVE_INFINITY
  for (const sample of windowSamples) {
    sample.values.forEach((value, index) => {
      if (hidden[index] || value === null || !Number.isFinite(value)) return
      if (value < yBaseMin) yBaseMin = value
      if (value > yBaseMax) yBaseMax = value
    })
  }
  if (!Number.isFinite(yBaseMin) || !Number.isFinite(yBaseMax)) {
    yBaseMin = -1.2
    yBaseMax = 1.2
  } else if (yBaseMin === yBaseMax) {
    yBaseMin -= 1
    yBaseMax += 1
  } else {
    const padding = (yBaseMax - yBaseMin) * 0.1
    yBaseMin -= padding
    yBaseMax += padding
  }
  domainRef.current = { min: yBaseMin, max: yBaseMax }

  const baseRange = yBaseMax - yBaseMin
  const viewMid = (yBaseMin + yBaseMax) / 2 + panOffset * baseRange
  const viewHalf = baseRange / (2 * zoomScale)
  const yMin = viewMid - viewHalf
  const yMax = viewMid + viewHalf
  const isViewModified = zoomScale !== 1 || panOffset !== 0

  function xFor(sampleIndex: number) {
    return Math.round((PAD.left + ((sampleIndex - windowStart) / WINDOW_SIZE) * PLOT_WIDTH) * 100) / 100
  }

  function yFor(value: number) {
    return Math.round((PAD.top + ((yMax - value) / (yMax - yMin)) * PLOT_HEIGHT) * 100) / 100
  }

  function formatTick(value: number) {
    const range = yMax - yMin
    if (range >= 100) return String(Math.round(value))
    if (range >= 10) return value.toFixed(1)
    return value.toFixed(2)
  }

  const isBitStream = chartMode === "Binary Bit Stream"
  const isDigitalPulse = chartMode === "Digital Pulse"

  // Per-series min/max over the visible window — used by the digital modes to
  // threshold analog values into high/low levels.
  const seriesStats = Array.from({ length: seriesCount }, (_, series) => {
    let lo = Number.POSITIVE_INFINITY
    let hi = Number.NEGATIVE_INFINITY
    for (const sample of windowSamples) {
      const value = sample.values[series]
      if (value === null || value === undefined || !Number.isFinite(value)) continue
      if (value < lo) lo = value
      if (value > hi) hi = value
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
      lo = 0
      hi = 1
    } else if (lo === hi) {
      hi = lo + 1
    }
    return { lo, hi, mid: (lo + hi) / 2 }
  })

  const laneHeight = PLOT_HEIGHT / Math.max(seriesCount, 1)

  // Maps a raw value to its on-plot Y for the active plot view. Rendering and
  // hover detection both go through this so markers always sit on the line.
  function displayY(series: number, value: number) {
    if (isDigitalPulse) {
      const stats = seriesStats[series]
      return yFor(value >= stats.mid ? stats.hi : stats.lo)
    }
    if (isBitStream) {
      const laneTop = PAD.top + series * laneHeight
      const stats = seriesStats[series]
      return value >= stats.mid ? laneTop + laneHeight * 0.18 : laneTop + laneHeight * 0.82
    }
    return yFor(value)
  }

  type PlotPoint = { x: number; y: number }

  // Splits a series into continuous segments (null values break the line).
  function segmentsFor(series: number): PlotPoint[][] {
    const segments: PlotPoint[][] = []
    let current: PlotPoint[] = []
    for (const sample of windowSamples) {
      const value = sample.values[series]
      if (value === null || value === undefined || !Number.isFinite(value)) {
        if (current.length > 0) segments.push(current)
        current = []
        continue
      }
      current.push({ x: xFor(sample.index), y: displayY(series, value) })
    }
    if (current.length > 0) segments.push(current)
    return segments
  }

  function linearPath(segments: PlotPoint[][]) {
    return segments
      .map((points) => points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" "))
      .join(" ")
  }

  function stepPath(segments: PlotPoint[][]) {
    return segments
      .map((points) =>
        points
          .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${points[i - 1].y} L ${p.x} ${p.y}`))
          .join(" "),
      )
      .join(" ")
  }

  function smoothPath(segments: PlotPoint[][]) {
    return segments
      .map((points) => {
        if (points.length < 3) return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")
        let path = `M ${points[0].x} ${points[0].y}`
        for (let i = 1; i < points.length - 1; i++) {
          const midX = Math.round(((points[i].x + points[i + 1].x) / 2) * 100) / 100
          const midY = Math.round(((points[i].y + points[i + 1].y) / 2) * 100) / 100
          path += ` Q ${points[i].x} ${points[i].y} ${midX} ${midY}`
        }
        const last = points[points.length - 1]
        path += ` L ${last.x} ${last.y}`
        return path
      })
      .join(" ")
  }

  // Each plot view renders with a distinct geometry:
  //   Waveform          smooth curves (or linear when interpolate is off)
  //   Multi-line        straight lines between points
  //   Sensor            straight lines plus a dot at every sample
  //   Digital Pulse     values thresholded to high/low square pulses
  //   Step Graph        staircase (step-after) rendering
  //   Binary Bit Stream one thresholded square-wave lane per series
  function pathFor(series: number) {
    const segments = segmentsFor(series)
    switch (chartMode) {
      case "Waveform":
        return interpolate ? smoothPath(segments) : linearPath(segments)
      case "Multi-line":
      case "Sensor":
        return interpolate ? linearPath(segments) : stepPath(segments)
      case "Digital Pulse":
      case "Step Graph":
      case "Binary Bit Stream":
      default:
        return stepPath(segments)
    }
  }

  // Waveform gets a soft area fill under each curve for a scope-like look.
  function areaPathFor(series: number) {
    const segments = segmentsFor(series)
    const bottom = HEIGHT - PAD.bottom
    return segments
      .map((points) => {
        if (points.length < 2) return ""
        const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")
        const last = points[points.length - 1]
        return `${line} L ${last.x} ${bottom} L ${points[0].x} ${bottom} Z`
      })
      .join(" ")
  }

  function resetView() {
    setZoomScale(1)
    setPanOffset(0)
  }

  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current
    if (!svg) return
    svg.setPointerCapture(event.pointerId)
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const pointers = Array.from(pointersRef.current.values())
    if (pointers.length === 2) {
      const distance = Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y)
      gestureRef.current = { mode: "pinch", startDistance: Math.max(distance, 1), startScale: viewRef.current.scale }
    } else if (pointers.length === 1) {
      gestureRef.current = { mode: "pan", lastY: event.clientY }
    }
    setHover(null)
  }

  function handlePointerUp(event: React.PointerEvent<SVGSVGElement>) {
    pointersRef.current.delete(event.pointerId)
    const remaining = Array.from(pointersRef.current.entries())
    if (remaining.length === 1) {
      gestureRef.current = { mode: "pan", lastY: remaining[0][1].y }
    } else if (remaining.length === 0) {
      gestureRef.current = null
    }
  }

  function handlePlotMove(event: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current
    if (!svg) return

    const tracked = pointersRef.current.get(event.pointerId)
    if (tracked) {
      tracked.x = event.clientX
      tracked.y = event.clientY
    }

    const gesture = gestureRef.current
    if (gesture?.mode === "pinch") {
      const pointers = Array.from(pointersRef.current.values())
      if (pointers.length >= 2) {
        const distance = Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y)
        const nextScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, gesture.startScale * (distance / gesture.startDistance)))
        setZoomScale(nextScale)
      }
      return
    }
    if (gesture?.mode === "pan" && tracked) {
      const deltaY = event.clientY - gesture.lastY
      gesture.lastY = event.clientY
      if (deltaY !== 0) {
        const rect = svg.getBoundingClientRect()
        const { min, max } = domainRef.current
        const range = max - min || 1
        const visibleRange = range / viewRef.current.scale
        setPanOffset((offset) => (offset * range + (deltaY / rect.height) * visibleRange) / range)
      }
      return
    }

    if (running || windowSamples.length === 0) return
    const rect = svg.getBoundingClientRect()
    const mouseX = ((event.clientX - rect.left) / rect.width) * WIDTH
    const mouseY = ((event.clientY - rect.top) / rect.height) * HEIGHT
    if (mouseX < PAD.left || mouseX > WIDTH - PAD.right || mouseY < PAD.top || mouseY > HEIGHT - PAD.bottom) {
      setHover(null)
      return
    }

    const approximateIndex = Math.round(((mouseX - PAD.left) / PLOT_WIDTH) * WINDOW_SIZE)
    const searchRadius = 5
    let nearest: HoverPoint | null = null
    let nearestDistance = Number.POSITIVE_INFINITY

    for (
      let offset = Math.max(0, approximateIndex - searchRadius);
      offset <= Math.min(windowSamples.length - 1, approximateIndex + searchRadius);
      offset++
    ) {
      const sample = windowSamples[offset]
      for (let series = 0; series < seriesCount; series++) {
        if (hidden[series]) continue
        const value = sample.values[series]
        if (value === null || value === undefined || !Number.isFinite(value)) continue
        const px = xFor(sample.index)
        const py = displayY(series, value)
        const distance = Math.hypot(px - mouseX, py - mouseY)
        if (distance < nearestDistance) {
          nearestDistance = distance
          nearest = { sample, series, px, py }
        }
      }
    }

    setHover(nearestDistance <= 42 ? nearest : null)
  }

  function clearPlot() {
    sampleCounter.current = 0
    setSamples([])
    setHover(null)
    vscode.postMessage({ type: "clear" })
  }

  function toggleStartStop() {
    setHover(null)
    vscode.postMessage({ type: "toggleStartStop" })
  }

  function changeBaud(value: string) {
    setBaud(value)
    vscode.postMessage({ type: "changeBaudRate", value: value.replace(" baud", "") })
  }

  function sendMessage() {
    const trimmed = message.trim()
    if (!trimmed) return
    vscode.postMessage({ type: "send", value: trimmed, newline: LINE_ENDING_CODES[lineEnding] })
    setMessage("")
  }

  function exportCsv() {
    const header = ["Point", ...Array.from({ length: seriesCount }, (_, index) => seriesLabel(labels, index))].join(", ")
    const rows = samples.map((sample) =>
      [
        String(sample.index),
        ...Array.from({ length: seriesCount }, (_, index) => {
          const value = sample.values[index]
          return value === null || value === undefined ? "" : String(value)
        }),
      ].join(", "),
    )
    vscode.postMessage({ type: "exportCsv", data: [header, ...rows].join("\n") })
  }

  function exportImage() {
    const svg = svgRef.current
    if (!svg) return
    const xml = new XMLSerializer().serializeToString(svg)
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = WIDTH * 2
      canvas.height = HEIGHT * 2
      const context = canvas.getContext("2d")
      if (!context) return
      context.fillStyle = "#282c34"
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      vscode.postMessage({ type: "exportImage", data: canvas.toDataURL("image/png") })
    }
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`
  }

  const xTicks = [0, 20, 40, 60, 80, 100, 120]
  const yTicks = Array.from({ length: 5 }, (_, index) => yMin + ((yMax - yMin) / 4) * index)

  const targetLabel =
    boardName && port
      ? `Message (Enter to send message to '${boardName}' on '${port}')`
      : "Message (Enter to send)"

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-panel text-panel-text">
      <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-3 border-b-2 border-panel-muted px-3 py-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          {Array.from({ length: seriesCount }, (_, series) => {
            const selected = !hidden[series]
            return (
              <button
                key={series}
                type="button"
                onClick={() => setHidden((current) => ({ ...current, [series]: !current[series] }))}
                className="flex h-9 items-center gap-2 rounded-md px-1.5 text-[15px] font-medium transition-opacity hover:opacity-80"
                aria-pressed={selected}
                title={selected ? `Hide ${seriesLabel(labels, series)}` : `Show ${seriesLabel(labels, series)}`}
              >
                <span
                  className={`flex size-6 items-center justify-center rounded-full ${selected ? "border-2 border-white" : "border border-[#d9d9d9]"}`}
                  style={{ backgroundColor: seriesColor(series) }}
                  aria-hidden="true"
                >
                  {selected && <X className="size-4 text-white" strokeWidth={3} />}
                </span>
                {seriesLabel(labels, series)}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={exportCsv}
            className="rounded p-1 text-panel-text hover:bg-panel-surface"
            aria-label="Export data as CSV"
            title="Export data as CSV"
          >
            <FileCodeCorner className="size-5" strokeWidth={1.7} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={exportImage}
            className="rounded p-1 text-panel-text hover:bg-panel-surface"
            aria-label="Export chart as image"
            title="Export chart as image"
          >
            <FileImage className="size-5" strokeWidth={1.7} aria-hidden="true" />
          </button>
          <label className="flex cursor-pointer items-center gap-2 text-[15px] font-medium">
            Interpolate
            <ToggleSwitch checked={interpolate} label="Toggle interpolate" onToggle={() => setInterpolate((value) => !value)} />
          </label>
          <button
            type="button"
            onClick={toggleStartStop}
            className={`flex size-[38px] items-center justify-center rounded-full text-arduino-ink ${running ? "bg-[#af3838]" : "bg-arduino"}`}
            aria-label={running ? "Stop plotting" : "Start plotting"}
            title={running ? "Stop" : "Start"}
          >
            {running ? <Pause className="size-5 fill-current" strokeWidth={2} aria-hidden="true" /> : <Play className="size-5 fill-current" strokeWidth={2} aria-hidden="true" />}
          </button>
          <button type="button" onClick={clearPlot} className="rounded p-1 hover:bg-panel-surface" aria-label="Clear plot" title="Clear plot">
            <Trash2 className="size-5" strokeWidth={1.7} aria-hidden="true" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setChartMenu((value) => !value)}
              className={`flex h-9 min-w-[195px] items-center gap-2 bg-panel-surface px-3 text-sm font-medium ${chartMenu ? "rounded-t-md" : "rounded-md"}`}
              aria-haspopup="listbox"
              aria-expanded={chartMenu}
              title="Select plot view"
            >
              <ChartNoAxesCombined className="size-5" strokeWidth={1.7} aria-hidden="true" />
              <span className="flex-1 text-left">{chartMode}</span>
              <ChevronDown className={`size-4 transition-transform ${chartMenu ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
            {chartMenu && (
              <div className="absolute right-0 top-full z-30 w-full overflow-hidden rounded-b-md bg-panel-surface shadow-xl">
                {PLOT_MODES.filter((mode) => mode !== chartMode).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setChartMode(mode)
                      setChartMenu(false)
                      setInterpolate(!STEPPED_MODES.includes(mode))
                    }}
                    className="block h-[35px] w-full pl-10 pr-3 text-left text-sm hover:bg-panel-surface-hover"
                  >
                    {mode}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <section className="relative min-h-0 flex-1 overflow-hidden" aria-label="Serial data plot">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          className={`size-full touch-none select-none ${running ? "cursor-default" : "cursor-crosshair"}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePlotMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={resetView}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label="Serial data plot"
        >
          {xTicks.map((tick) => (
            <g key={`x-${tick}`}>
              <line
                x1={PAD.left + (tick / WINDOW_SIZE) * PLOT_WIDTH}
                x2={PAD.left + (tick / WINDOW_SIZE) * PLOT_WIDTH}
                y1={PAD.top}
                y2={HEIGHT - PAD.bottom}
                stroke="#586a74"
                strokeOpacity="0.28"
              />
              <text
                x={PAD.left + (tick / WINDOW_SIZE) * PLOT_WIDTH}
                y={HEIGHT - 10}
                fill="#9aa8ad"
                fontSize="13"
                textAnchor="middle"
              >
                {windowStart + tick}
              </text>
            </g>
          ))}
          {yTicks.map((tick) => (
            <g key={`y-${tick}`}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={yFor(tick)}
                y2={yFor(tick)}
                stroke="#586a74"
                strokeOpacity={Math.abs(tick) < 1e-9 ? "0.7" : "0.28"}
              />
              {!isBitStream && (
                <text x={PAD.left - 10} y={yFor(tick) + 4} fill="#9aa8ad" fontSize="13" textAnchor="end">
                  {formatTick(tick)}
                </text>
              )}
            </g>
          ))}
          {isBitStream &&
            Array.from({ length: seriesCount }, (_, series) => (
              <g key={`lane-${series}`}>
                <line
                  x1={PAD.left}
                  x2={WIDTH - PAD.right}
                  y1={PAD.top + (series + 1) * laneHeight}
                  y2={PAD.top + (series + 1) * laneHeight}
                  stroke="#586a74"
                  strokeOpacity="0.45"
                />
                <text
                  x={PAD.left - 10}
                  y={PAD.top + series * laneHeight + laneHeight / 2 + 4}
                  fill={seriesColor(series)}
                  fontSize="12"
                  textAnchor="end"
                >
                  {seriesLabel(labels, series)}
                </text>
              </g>
            ))}
          <clipPath id="plot-area">
            <rect x={PAD.left} y={PAD.top} width={PLOT_WIDTH} height={PLOT_HEIGHT} />
          </clipPath>
          <g clipPath="url(#plot-area)">
            {chartMode === "Waveform" &&
              Array.from({ length: seriesCount }, (_, series) =>
                !hidden[series] ? (
                  <path
                    key={`area-${series}`}
                    d={areaPathFor(series)}
                    fill={seriesColor(series)}
                    fillOpacity="0.12"
                    stroke="none"
                  />
                ) : null,
              )}
            {Array.from({ length: seriesCount }, (_, series) =>
              !hidden[series] ? (
                <path
                  key={series}
                  d={pathFor(series)}
                  fill="none"
                  stroke={seriesColor(series)}
                  strokeWidth={isDigitalPulse || isBitStream ? "2" : "2.25"}
                  vectorEffect="non-scaling-stroke"
                />
              ) : null,
            )}
            {chartMode === "Sensor" &&
              Array.from({ length: seriesCount }, (_, series) =>
                !hidden[series]
                  ? segmentsFor(series).flatMap((segment, segIndex) =>
                      segment.map((point, pointIndex) => (
                        <ellipse
                          key={`dot-${series}-${segIndex}-${pointIndex}`}
                          cx={point.x}
                          cy={point.y}
                          rx={3.2 / viewScale.sx}
                          ry={3.2 / viewScale.sy}
                          fill={seriesColor(series)}
                        />
                      )),
                    )
                  : null,
              )}
          </g>
          {!running && hover && (
            <g pointerEvents="none">
              <line x1={hover.px} x2={hover.px} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="#dae3e3" strokeOpacity="0.65" strokeDasharray="6 6" vectorEffect="non-scaling-stroke" />
              <line x1={PAD.left} x2={WIDTH - PAD.right} y1={hover.py} y2={hover.py} stroke="#dae3e3" strokeOpacity="0.65" strokeDasharray="6 6" vectorEffect="non-scaling-stroke" />
              {/* Ellipse with axis-corrected radii renders as a true circle even
                  though the viewBox is stretched non-uniformly. */}
              <ellipse
                cx={hover.px}
                cy={hover.py}
                rx={6 / viewScale.sx}
                ry={6 / viewScale.sy}
                fill={seriesColor(hover.series)}
                stroke="#dae3e3"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          )}
        </svg>

        {isViewModified && (
          <div className="pointer-events-none absolute right-3 top-3 rounded bg-panel-surface/90 px-2.5 py-1 text-xs text-panel-text/80">
            Zoom {zoomScale.toFixed(1)}&times; &mdash; double-click to reset
          </div>
        )}

        {!running && hover && (
          <div
            className="pointer-events-none absolute z-20 min-w-36 rounded-md border border-panel-muted bg-panel-surface px-3 py-2 text-sm shadow-xl"
            style={{
              left: `clamp(8px, calc(${(hover.px / WIDTH) * 100}% + 14px), calc(100% - 160px))`,
              top: `clamp(8px, calc(${(hover.py / HEIGHT) * 100}% - 54px), calc(100% - 72px))`,
            }}
          >
            <div className="font-semibold" style={{ color: seriesColor(hover.series) }}>
              {seriesLabel(labels, hover.series)}
            </div>
            <div className="mt-1 text-panel-text/90">Point: {hover.sample.index}</div>
            <div className="text-panel-text/90">Value: {hover.sample.values[hover.series]?.toFixed(4)}</div>
          </div>
        )}

        {samples.length === 0 && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded bg-panel-surface/90 px-3 py-1.5 text-xs text-panel-text/70">
            No data yet. Waiting for serial input&hellip;
          </div>
        )}

        {!running && !hover && samples.length > 0 && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded bg-panel-surface/90 px-3 py-1.5 text-xs text-panel-text/70">
            Move near a point to inspect its value &middot; Ctrl+scroll or pinch to zoom &middot; drag to pan
          </div>
        )}
      </section>

      <footer className="flex shrink-0 flex-wrap items-center gap-3 border-t-2 border-panel-muted px-3 py-1.5">
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || event.keyCode === 229) return
            if (event.key === "Enter") {
              event.preventDefault()
              sendMessage()
            }
          }}
          placeholder={targetLabel}
          className="h-9 min-w-52 flex-1 rounded-md bg-[#21252b]/60 px-3 text-sm text-panel-text placeholder:text-panel-text/50 focus:outline-none"
          aria-label="Serial message"
        />
        <SimpleSelect icon={<Pilcrow className="size-5" aria-hidden="true" />} label="Line ending" value={lineEnding} values={LINE_ENDINGS} onChange={setLineEnding} />
        <SimpleSelect icon={<Zap className="size-5" aria-hidden="true" />} label="Baud rate" value={baud} values={BAUD_RATES} onChange={changeBaud} />
      </footer>
    </main>
  )
}

function ToggleSwitch({ checked, label, onToggle }: { checked: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className={`relative h-2 w-5 rounded-full ${checked ? "bg-arduino-bright" : "bg-[#d9d9d9]"}`}
    >
      <span
        className={`absolute left-0 top-1/2 size-3 -translate-y-1/2 rounded-full transition-transform ${
          checked ? "translate-x-3 bg-panel-surface-hover" : "-translate-x-1 bg-panel-divider"
        }`}
      />
    </button>
  )
}

function SimpleSelect({ icon, label, value, values, onChange }: { icon: React.ReactNode; label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex h-9 min-w-40 items-center gap-2 bg-panel-surface px-3 text-sm font-medium ${open ? "rounded-b-md" : "rounded-md"}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        title={label}
      >
        {icon}<span className="flex-1 text-left">{value}</span><ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute bottom-full right-0 z-30 max-h-[250px] min-w-full overflow-y-auto rounded-t-md bg-panel-surface shadow-xl" role="listbox" aria-label={label}>
            {values
              .filter((item) => item !== value)
              .map((item) => (
                <button
                  key={item}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => { onChange(item); setOpen(false) }}
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
