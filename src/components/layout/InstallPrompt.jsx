import { useState, useEffect } from 'react'

/**
 * InstallPrompt - PWA install banner
 *
 * Captures the browser's `beforeinstallprompt` event and shows a
 * non-intrusive banner at the bottom of the screen when the app
 * is installable (i.e. when visited in a browser, not already installed).
 *
 * The banner includes:
 * - A brief message encouraging installation
 * - An "Install" button that triggers the native install dialog
 * - A "Dismiss" button to hide the banner for this session
 *
 * The banner does NOT appear when:
 * - The app is already installed (display-mode: standalone)
 * - The user has dismissed it this session
 * - The browser doesn't support PWA installation
 */
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Listen for the browser's install prompt event
    // This fires when the app meets PWA installability criteria
    function handleBeforeInstall(e) {
      // Prevent the default mini-infobar on mobile browsers
      e.preventDefault()
      // Stash the event so we can trigger it later from our custom UI
      setDeferredPrompt(e)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
    }
  }, [])

  /**
   * Trigger the native install dialog using the stashed prompt event
   * After the user responds (accept or dismiss), clear the prompt
   */
  async function handleInstall() {
    if (!deferredPrompt) return

    // Show the native browser install dialog
    deferredPrompt.prompt()

    // Wait for the user to respond
    await deferredPrompt.userChoice

    // Clear the prompt regardless of outcome (can only be used once)
    setDeferredPrompt(null)
  }

  /**
   * Dismiss the banner for this session
   * The prompt will reappear on the next visit if not installed
   */
  function handleDismiss() {
    setDismissed(true)
    setDeferredPrompt(null)
  }

  // Don't render if there's no install prompt or user dismissed it
  if (!deferredPrompt || dismissed) return null

  return (
    <div className="fixed bottom-16 sm:bottom-0 left-0 right-0 z-50 px-4 pb-4 sm:pb-4">
      <div className="max-w-lg mx-auto bg-bg-primary border border-border rounded-xl shadow-lg p-4
        flex items-center gap-3">
        {/* Compass icon */}
        <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <polygon points="12,2 15,10 12,22 9,10" />
            <circle cx="12" cy="12" r="10" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary">Install Compass</p>
          <p className="text-xs text-text-muted">Add to your home screen for quick access</p>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={handleDismiss}
            className="text-xs text-text-muted hover:text-text-secondary px-2 py-1.5"
          >
            Later
          </button>
          <button
            onClick={handleInstall}
            className="text-xs font-medium bg-accent text-white px-3 py-1.5 rounded-lg
              hover:bg-blue-700 transition-colors"
          >
            Install
          </button>
        </div>
      </div>
    </div>
  )
}
