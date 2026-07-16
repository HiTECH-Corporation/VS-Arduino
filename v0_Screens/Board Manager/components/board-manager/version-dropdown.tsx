import { useEffect, useRef, useState } from "react"
import { ArrowDownToLine, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

type VersionDropdownProps = {
  versions: string[]
  value: string
  onChange: (version: string) => void
}

function label(version: string, latest: string) {
  const display = version.startsWith("v") ? version : `v${version}`
  return version === latest ? `${display} (Latest)` : display
}

export function VersionDropdown({ versions, value, onChange }: VersionDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const latest = versions[0]

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  return (
    <div ref={ref} className="relative w-[240px] shrink-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-[35px] w-full items-center gap-2 bg-vs-control px-3 text-left text-vs-text transition-colors",
          "hover:bg-vs-control-hover focus:outline-none focus-visible:ring-1 focus-visible:ring-vs-accent",
          open ? "rounded-t-[5.8px]" : "rounded-[5.8px]",
        )}
      >
        <ArrowDownToLine className="size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{label(value, latest)}</span>
        <ChevronDown
          className={cn("size-3.5 shrink-0 transition-transform duration-150", open && "rotate-180")}
          strokeWidth={1.5}
          aria-hidden="true"
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="vs-dropdown-in absolute left-0 right-0 top-[35px] z-30 max-h-[250px] overflow-y-auto rounded-b-[5.8px] bg-vs-control shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
        >
          {versions.map((version) => {
            const selected = version === value
            return (
              <li key={version} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(version)
                    setOpen(false)
                  }}
                  className={cn(
                    "flex h-[35px] w-full items-center px-3 text-left text-[14px] font-medium text-vs-text transition-colors",
                    "hover:bg-vs-control-hover",
                    selected ? "bg-vs-control-hover" : "bg-vs-control",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{label(version, latest)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
