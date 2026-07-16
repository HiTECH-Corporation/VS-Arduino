import { useEffect, useRef, useState } from "react"
import { CircuitBoard, HardDriveDownload, Search } from "lucide-react"
import { toBoard, type Board } from "./data"
import { BoardRow } from "./board-row"
import { vscode } from "../../lib/vscode"

export function BoardManager() {
  const [query, setQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [boards, setBoards] = useState<Board[]>([])
  const [isInstalledList, setIsInstalledList] = useState(true)
  const queryRef = useRef("")
  const debounceRef = useRef<number | null>(null)

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data
      switch (message?.command) {
        case "loading":
          setIsSearching(Boolean(message.state))
          break
        case "searchResults": {
          const results: Record<string, any>[] = Array.isArray(message.results) ? message.results : []
          setBoards(results.map(toBoard).filter((board) => board.id !== ""))
          setIsInstalledList(Boolean(message.isInstalledList))
          break
        }
        case "installComplete":
        case "uninstallComplete":
          vscode.postMessage({ command: "search", query: queryRef.current })
          break
      }
    }
    window.addEventListener("message", handleMessage)
    vscode.postMessage({ command: "init" })
    return () => window.removeEventListener("message", handleMessage)
  }, [])

  useEffect(() => {
    queryRef.current = query.trim()
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      vscode.postMessage({ command: "search", query: queryRef.current })
    }, 500)
    return () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current)
    }
  }, [query])

  function handleAction(board: Board, selectedVersion: string, action: string) {
    if (action === "uninstall") {
      vscode.postMessage({ command: "uninstall", name: board.id })
    } else {
      vscode.postMessage({ command: "install", name: board.id, version: selectedVersion })
    }
  }

  const hasQuery = !isInstalledList

  return (
    <div className="mx-auto flex h-dvh min-h-[320px] w-full max-w-[1352px] flex-col overflow-hidden bg-vs-bg">
      <div className="px-[5px] pt-[9px]">
        <div className="relative flex h-[39px] w-full items-center overflow-hidden rounded-[4.92px] bg-vs-panel">
          <span className="flex w-[47px] shrink-0 items-center justify-center text-vs-text">
            <CircuitBoard className="size-[18px]" strokeWidth={2} aria-hidden="true" />
          </span>
          <span className="h-full w-px shrink-0 bg-vs-divider-strong/80" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search boards..."
            aria-label="Search boards"
            className="h-full min-w-0 flex-1 bg-transparent pl-[13px] pr-3 text-[16px] font-medium text-white placeholder:text-vs-placeholder focus:outline-none"
          />
          <button
            type="button"
            aria-label="Search"
            className="flex w-[42px] shrink-0 items-center justify-center text-vs-text"
          >
            <Search className="size-[18px]" strokeWidth={2} aria-hidden="true" />
          </button>

          <span
            aria-hidden={!isSearching}
            className={`vs-search-loading-bar pointer-events-none absolute inset-x-0 bottom-0 h-[2px] transition-opacity duration-200 ${
              isSearching ? "opacity-100" : "opacity-0"
            }`}
          />
        </div>
      </div>

      <div className="mt-[8px] border-b-2 border-vs-divider" aria-hidden="true" />

      <div className="flex min-h-0 flex-1 justify-center px-[5px] pb-[12px] pt-[12px]">
        <section className="flex min-h-0 w-full max-w-[1352px] flex-1 flex-col overflow-hidden rounded-[10px] bg-vs-panel">
          <div className="flex h-[35px] shrink-0 items-center gap-2 border-b-2 border-vs-divider px-[19px] text-vs-text">
            {hasQuery ? (
              <Search className="size-[18px] shrink-0" strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <HardDriveDownload className="size-[18px] shrink-0" strokeWidth={1.5} aria-hidden="true" />
            )}
            <span className="truncate text-[14px] font-medium">
              {hasQuery ? `Search Results (${boards.length} found)` : "Installed"}
            </span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-[11px] py-[19px]">
            {boards.length === 0 ? (
              <p className="px-2 py-8 text-center text-[14px] font-medium text-vs-muted">
                {hasQuery ? `No boards match "${query.trim()}".` : "No board packages installed yet."}
              </p>
            ) : (
              boards.map((board) => (
                <BoardRow key={board.id} board={board} onAction={handleAction} />
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
