import { ControlPanel } from '@/components/control-panel'

export default function Page() {
  return (
    <main className="bg-panel flex h-dvh w-full overflow-hidden">
      <ControlPanel />
      {/* Editor area placeholder — other screens will live here */}
      <div className="bg-arduino-ink/40 border-panel-surface hidden flex-1 border-l md:block" />
    </main>
  )
}
