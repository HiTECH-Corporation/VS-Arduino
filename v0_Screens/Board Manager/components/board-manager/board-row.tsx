import { useState } from "react"
import { CornerRightDown, HardDriveDownload, RefreshCw, Trash2, type LucideIcon } from "lucide-react"
import { VersionDropdown } from "./version-dropdown"
import { resolveAction, type ActionKind, type Board } from "./data"

const ACTIONS: Record<ActionKind, { label: string; Icon: LucideIcon }> = {
  download: { label: "Install", Icon: HardDriveDownload },
  update: { label: "Update", Icon: RefreshCw },
  downgrade: { label: "Downgrade", Icon: CornerRightDown },
  uninstall: { label: "Uninstall", Icon: Trash2 },
}

export function BoardRow({
  board,
  onAction,
}: {
  board: Board
  onAction: (board: Board, selectedVersion: string, action: ActionKind) => void
}) {
  // Default to the latest version: when the installed version is older, the
  // action button resolves to "Update" so the user can see an update is available.
  const [selectedVersion, setSelectedVersion] = useState(board.versions[0] ?? board.installedVersion ?? "")
  const action = resolveAction(board, selectedVersion)
  const { label, Icon } = ACTIONS[action]

  return (
    <div className="flex h-[73px] items-center gap-4 rounded-[8px] bg-vs-row pl-[19px] pr-[18px]">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="min-w-0 truncate text-[19px] font-medium text-vs-text">{board.name}</span>
          <span className="shrink-0 text-[10px] font-medium italic text-vs-muted">{board.boardVer}</span>
        </div>
        <p className="mt-1 truncate text-[10px] font-medium text-vs-text">{board.architecture}</p>
      </div>

      <VersionDropdown versions={board.versions} value={selectedVersion} onChange={setSelectedVersion} />

      <button
        type="button"
        onClick={() => onAction(board, selectedVersion, action)}
        className="flex h-[35px] w-[126px] shrink-0 items-center justify-center gap-2 rounded-[5.8px] bg-vs-control text-[14px] font-medium text-vs-text transition-colors hover:bg-vs-control-hover focus:outline-none focus-visible:ring-1 focus-visible:ring-vs-accent"
      >
        <Icon className="size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
        <span className="truncate">{label}</span>
      </button>
    </div>
  )
}
