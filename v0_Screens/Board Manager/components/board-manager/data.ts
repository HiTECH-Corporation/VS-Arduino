export type Board = {
  id: string
  name: string
  boardVer: string
  architecture: string
  versions: string[]
  installedVersion: string | null
}

export type ActionKind = "download" | "update" | "downgrade" | "uninstall"

export function compareVersionsDesc(a: string, b: string) {
  return b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" })
}

export function resolveAction(board: Board, selectedVersion: string): ActionKind {
  // Treat empty/blank installed versions as "not installed" so uninstalled
  // boards always resolve to "Download" instead of a bogus "Downgrade".
  if (!board.installedVersion) return "download"
  if (selectedVersion === board.installedVersion) return "uninstall"
  const selectedIdx = board.versions.indexOf(selectedVersion)
  const installedIdx = board.versions.indexOf(board.installedVersion)
  if (installedIdx === -1 || selectedIdx === -1) {
    // Installed version not in the known list — compare versions semantically.
    return compareVersionsDesc(selectedVersion, board.installedVersion) < 0 ? "update" : "downgrade"
  }
  return selectedIdx < installedIdx ? "update" : "downgrade"
}

export function toBoard(item: Record<string, any>): Board {
  const releases = item?.releases ?? {}
  const latestRelease = releases[item?.latest_version]
  const versions = Object.keys(releases).sort(compareVersionsDesc)
  // Normalize empty strings to null so "not installed" is detected reliably.
  const installedVersion = item?.installed_version ? String(item.installed_version) : null
  const displayVersion = installedVersion ?? item?.latest_version ?? ""
  return {
    id: item?.id ?? "",
    name: latestRelease?.name ?? item?.name ?? item?.id ?? "Unknown",
    boardVer: displayVersion ? `v${displayVersion}` : "",
    architecture: latestRelease?.architecture ?? item?.architecture ?? item?.id?.split(":")[1] ?? "",
    versions: versions.length > 0 ? versions : [item?.latest_version].filter(Boolean),
    installedVersion,
  }
}
