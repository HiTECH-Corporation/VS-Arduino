import type React from "react"

import { useEffect, useRef, useState } from "react"
import {
  ArrowDownToLine,
  ChevronDown,
  CornerRightDown,
  HardDriveDownload,
  Library as LibraryIcon,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { vscode } from "../../lib/vscode"

type LibraryData = {
  id: string
  name: string
  author: string
  versions: string[]
  installedVersion: string | null
  installDir: string | null
  about: string
  maintainer: string
  website: string
  category: string
  architecture: string
  provides: string
}

function compareVersionsDesc(a: string, b: string) {
  return b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" })
}

function toLibrary(item: Record<string, any>, isInstalledList: boolean): LibraryData {
  if (isInstalledList) {
    const lib = item.library ?? item
    return {
      id: lib.name ?? "",
      name: lib.name ?? "Unknown",
      author: lib.author ?? "",
      versions: [lib.version].filter(Boolean),
      installedVersion: lib.version ?? null,
      installDir: lib.install_dir ?? item.installDir ?? null,
      about: lib.paragraph || lib.sentence || "",
      maintainer: lib.maintainer ?? "",
      website: lib.website ?? "",
      category: lib.category ?? "",
      architecture: Array.isArray(lib.architectures) ? lib.architectures.join(", ") : "",
      provides: Array.isArray(lib.provides_includes) ? lib.provides_includes.join(", ") : "",
    }
  }
  const latest = item.latest ?? {}
  const versions =
    Array.isArray(item.available_versions) && item.available_versions.length > 0
      ? [...item.available_versions].sort(compareVersionsDesc)
      : [latest.version].filter(Boolean)
  return {
    id: item.name ?? "",
    name: item.name ?? "Unknown",
    author: latest.author ?? "",
    versions,
    installedVersion: item.installed_version ? String(item.installed_version) : null,
    installDir: null,
    about: latest.paragraph || latest.sentence || "",
    maintainer: latest.maintainer ?? "",
    website: latest.website ?? "",
    category: latest.category ?? "",
    architecture: Array.isArray(latest.architectures) ? latest.architectures.join(", ") : "",
    provides: Array.isArray(latest.provides_includes) ? latest.provides_includes.join(", ") : "",
  }
}

function extractDetails(details: Record<string, any> | null | undefined): Partial<LibraryData> {
  if (!details) return {}
  const lib = details.latest ?? details.library ?? details
  return {
    author: lib.author ?? "",
    about: lib.paragraph || lib.sentence || "",
    maintainer: lib.maintainer ?? "",
    website: lib.website ?? "",
    category: lib.category ?? "",
    architecture: Array.isArray(lib.architectures) ? lib.architectures.join(", ") : "",
    provides: Array.isArray(lib.provides_includes) ? lib.provides_includes.join(", ") : "",
  }
}

export function LibraryManager() {
  const [query, setQuery] = useState("")
  const [libraries, setLibraries] = useState<LibraryData[]>([])
  const [isInstalledList, setIsInstalledList] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedVersion, setSelectedVersion] = useState("")
  const [leftWidth, setLeftWidth] = useState(300)
  const [isSearching, setIsSearching] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)

  const bodyRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const queryRef = useRef("")
  const selectedIdRef = useRef<string | null>(null)
  const debounceRef = useRef<number | null>(null)

  const isQuerying = !isInstalledList
  const selected = libraries.find((lib) => lib.id === selectedId) ?? null

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data
      switch (message?.command) {
        case "loading":
          setIsSearching(Boolean(message.state))
          break
        case "loadingDetails":
          setDetailsLoading(Boolean(message.state))
          break
        case "searchResults": {
          const results: Record<string, any>[] = Array.isArray(message.results) ? message.results : []
          const installedList = Boolean(message.isInstalledList)
          setLibraries(results.map((item) => toLibrary(item, installedList)).filter((lib) => lib.id !== ""))
          setIsInstalledList(installedList)
          break
        }
        case "detailsResult": {
          const versions: string[] = Array.isArray(message.versions) ? message.versions : []
          const detailFields = extractDetails(message.details)
          const currentId = selectedIdRef.current
          if (!currentId) break
          setLibraries((prev) =>
            prev.map((lib) =>
              lib.id === currentId
                ? {
                    ...lib,
                    ...detailFields,
                    versions: versions.length > 0 ? versions : lib.versions,
                    installedVersion: message.installedVersion ?? lib.installedVersion,
                  }
                : lib,
            ),
          )
          // Prefer the latest version: when the installed version is older, the
          // action button resolves to "Update" so the user can see an update is available.
          setSelectedVersion(versions[0] ?? message.installedVersion ?? "")
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

  useEffect(() => {
    function onMove(event: PointerEvent) {
      if (!draggingRef.current || !bodyRef.current) return
      const rect = bodyRef.current.getBoundingClientRect()
      const x = event.clientX - rect.left
      const min = 220
      const max = rect.width - 440
      setLeftWidth(Math.max(min, Math.min(x, Math.max(min, max))))
    }
    function onUp() {
      if (!draggingRef.current) return
      draggingRef.current = false
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
  }, [])

  function startDrag(event: React.PointerEvent) {
    event.preventDefault()
    draggingRef.current = true
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
  }

  function selectLibrary(lib: LibraryData) {
    setSelectedId(lib.id)
    selectedIdRef.current = lib.id
    setSelectedVersion(lib.versions[0] ?? lib.installedVersion ?? "")
    vscode.postMessage({
      command: "getDetails",
      name: lib.id,
      isInstalled: lib.installedVersion !== null,
      installDir: lib.installDir,
      installedVersion: lib.installedVersion,
    })
  }

  function handleAction(lib: LibraryData, version: string, mode: string) {
    if (mode === "uninstall") {
      vscode.postMessage({ command: "uninstall", name: lib.id })
    } else {
      vscode.postMessage({ command: "install", name: lib.id, version })
    }
  }

  return (
    <main className="flex h-dvh min-h-[420px] flex-col gap-3 overflow-hidden bg-panel p-3 text-panel-text">
      <div className="relative flex h-10 shrink-0 items-center gap-3 overflow-hidden rounded-[5px] bg-[#21252b]/60 pl-3 pr-4">
        <LibraryIcon className="size-[18px] shrink-0" strokeWidth={2} aria-hidden="true" />
        <span className="h-6 w-px shrink-0 bg-panel-divider/70" aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search libraries..."
          className="min-w-0 flex-1 bg-transparent text-[15px] font-medium placeholder:text-panel-text/60 focus:outline-none"
          aria-label="Search libraries"
        />
        <Search className="size-[18px] shrink-0 text-panel-text" strokeWidth={2} aria-hidden="true" />

        <span
          aria-hidden={!isSearching}
          className={cn(
            "vs-search-loading-bar pointer-events-none absolute inset-x-0 bottom-0 h-[2px] transition-opacity duration-200",
            isSearching ? "opacity-100" : "opacity-0",
          )}
        />
      </div>

      <div ref={bodyRef} className="flex min-h-0 flex-1 items-stretch">
        <aside
          style={{ width: leftWidth }}
          className="flex min-h-0 shrink-0 flex-col overflow-hidden rounded-[10px] bg-[#21252b]/60"
        >
          <div className="flex h-[35px] shrink-0 items-center gap-2 border-b-2 border-panel-muted/70 px-4 text-panel-text">
            {isQuerying ? (
              <Search className="size-[18px] shrink-0" strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <HardDriveDownload className="size-[18px] shrink-0" strokeWidth={1.5} aria-hidden="true" />
            )}
            <span className="truncate text-[14px] font-medium">
              {isQuerying ? `Search Results (${libraries.length} found)` : "Installed"}
            </span>
          </div>

          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-2.5" role="listbox" aria-label="Libraries">
            {libraries.length === 0 ? (
              <p className="px-2 py-4 text-[13px] text-panel-text/60">
                {isQuerying ? "No libraries found." : "No libraries installed yet."}
              </p>
            ) : (
              libraries.map((lib) => (
                <LibraryCard
                  key={lib.id}
                  lib={lib}
                  selected={lib.id === selectedId}
                  onSelect={() => selectLibrary(lib)}
                />
              ))
            )}
          </div>
        </aside>

        <div
          onPointerDown={startDrag}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panels"
          className="group flex w-3 shrink-0 cursor-col-resize items-center justify-center"
        >
          <span className="h-16 w-1 rounded-full bg-panel-muted/40 transition-colors group-hover:bg-panel-muted" />
        </div>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[10px] bg-[#21252b]/60">
          {selected ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              <div className="rounded-[8px] bg-[#1a1d22] p-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                  <div className="flex min-w-0 flex-1 items-baseline gap-3">
                    <h1 className="min-w-0 truncate text-[26px] font-medium leading-none">{selected.name}</h1>
                    {selected.author && (
                      <span className="shrink-0 truncate text-[15px] text-panel-text/90">({selected.author})</span>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-3">
                    <VersionDropdown
                      versions={selected.versions}
                      value={selectedVersion}
                      onChange={setSelectedVersion}
                    />
                    <ActionButton lib={selected} selectedVersion={selectedVersion} onAction={handleAction} />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-6">
                <div className="min-w-[240px] flex-1">
                  <p className="text-[15px] text-panel-text/80">About</p>
                  <p className="mt-1 break-words text-[17px] leading-relaxed">
                    {detailsLoading ? "Loading details..." : selected.about || "No description available."}
                  </p>
                </div>

                <aside className="w-[300px] max-w-full shrink-0 rounded-[8px] bg-[#1a1d22]/80 p-6">
                  <dl className="space-y-4">
                    <InfoRow label="Maintainer" value={selected.maintainer || "Unknown"} />
                    <InfoRow
                      label="Website"
                      value={selected.website ? "Visit Website" : "N/A"}
                      href={selected.website || undefined}
                    />
                    <InfoRow label="Category" value={selected.category || "Uncategorized"} />
                    <InfoRow label="Architecture" value={selected.architecture || "Any"} />
                    {selected.provides && <InfoRow label="Provides Includes" value={selected.provides} />}
                  </dl>
                </aside>
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-[15px] text-panel-text/60">
              Select a library to see its details.
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function LibraryCard({
  lib,
  selected,
  onSelect,
}: {
  lib: LibraryData
  selected: boolean
  onSelect: () => void
}) {
  const displayVersion = lib.installedVersion ?? lib.versions[0] ?? ""
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        "block w-full rounded-[8px] px-4 py-3 text-left transition-colors",
        selected ? "bg-[#23272e]" : "bg-[#1a1d22] hover:bg-[#23272e]",
      )}
    >
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{lib.name}</span>
        {displayVersion && (
          <span className="shrink-0 text-[10px] italic text-panel-text/70">v{displayVersion}</span>
        )}
      </div>
      <p className="mt-1 truncate text-[11px] text-panel-text/80">{lib.author}</p>
    </button>
  )
}

function VersionDropdown({
  versions,
  value,
  onChange,
}: {
  versions: string[]
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const label = value === versions[0] ? `v${value} (Latest)` : `v${value}`
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex h-9 w-[240px] max-w-[52vw] items-center gap-2 bg-panel-surface px-3 text-[14px] font-medium",
          open ? "rounded-t-[6px]" : "rounded-[6px]",
        )}
      >
        <ArrowDownToLine className="size-[18px] shrink-0" strokeWidth={2} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        <ChevronDown
          className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")}
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" aria-hidden="true" onClick={() => setOpen(false)} />
          <ul
            className="vs-dropdown-in absolute left-0 top-full z-30 w-full overflow-hidden rounded-b-[6px] bg-panel-surface shadow-xl shadow-black/40 max-h-[250px] overflow-y-auto"
            role="listbox"
          >
            {versions.map((version) => {
              const isSelected = version === value
              return (
                <li key={version}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(version)
                      setOpen(false)
                    }}
                    className={cn(
                      "block h-[35px] w-full truncate px-3 text-left text-[14px]",
                      isSelected ? "bg-panel-surface-hover" : "hover:bg-panel-surface-hover",
                    )}
                  >
                    {version === versions[0] ? `v${version} (Latest)` : `v${version}`}
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}

function ActionButton({
  lib,
  selectedVersion,
  onAction,
}: {
  lib: LibraryData
  selectedVersion: string
  onAction: (lib: LibraryData, version: string, mode: string) => void
}) {
  const installedIdx = lib.installedVersion ? lib.versions.indexOf(lib.installedVersion) : -1
  const selectedIdx = lib.versions.indexOf(selectedVersion)

  let mode: "download" | "uninstall" | "update" | "downgrade"
  if (!lib.installedVersion) mode = "download"
  else if (selectedVersion === lib.installedVersion) mode = "uninstall"
  else if (installedIdx === -1 || selectedIdx === -1)
    // Installed version missing from the list — fall back to semantic compare.
    mode = compareVersionsDesc(selectedVersion, lib.installedVersion) < 0 ? "update" : "downgrade"
  else if (selectedIdx < installedIdx) mode = "update"
  else mode = "downgrade"

  const config = {
    download: { label: "Install", icon: HardDriveDownload },
    uninstall: { label: "Uninstall", icon: Trash2 },
    update: { label: "Update", icon: RefreshCw },
    downgrade: { label: "Downgrade", icon: CornerRightDown },
  }[mode]

  const Icon = config.icon

  return (
    <button
      type="button"
      onClick={() => onAction(lib, selectedVersion, mode)}
      className="flex h-9 shrink-0 items-center gap-2 rounded-[6px] bg-panel-surface px-4 text-[14px] font-medium transition-colors hover:bg-panel-surface-hover"
    >
      <Icon className="size-[18px] shrink-0" strokeWidth={1.5} aria-hidden="true" />
      {config.label}
    </button>
  )
}

function InfoRow({
  label,
  value,
  href,
}: {
  label: string
  value: string
  href?: string
}) {
  return (
    <div>
      <dt className="text-[15px] text-panel-text/80">{label}</dt>
      <dd className="mt-0.5 break-words text-[17px]">
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-arduino-bright">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  )
}
