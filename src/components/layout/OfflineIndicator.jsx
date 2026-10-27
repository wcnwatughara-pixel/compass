import { useState, useEffect } from 'react'

/**
 * OfflineIndicator - Shows a banner when the app is offline
 *
 * Listens to browser online/offline events and displays a subtle
 * top banner when the network connection is lost. The banner
 * auto-dismisses when the connection is restored.
 *
 * Since Compass is offline-first (all data in IndexedDB, served
 * from service worker cache), the app remains fully functional
 * offline. This indicator just lets the user know that sync
 * features won't work until connectivity returns.
 */
export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    function handleOnline() {
      setIsOffline(false)
    }
    function handleOffline() {
      setIsOffline(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-center
      text-xs py-1.5 font-medium">
      You're offline. Compass works without internet, but sync is paused.
    </div>
  )
}
