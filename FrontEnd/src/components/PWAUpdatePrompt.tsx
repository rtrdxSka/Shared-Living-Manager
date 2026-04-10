import { useRegisterSW } from "virtual:pwa-register/react"

export function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border bg-background px-4 py-3 shadow-lg">
      <p className="text-sm">A new version of HouseMate is available.</p>
      <button
        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        onClick={() => updateServiceWorker(true)}
      >
        Update
      </button>
      <button
        className="text-sm text-muted-foreground hover:text-foreground"
        onClick={() => setNeedRefresh(false)}
      >
        Dismiss
      </button>
    </div>
  )
}
