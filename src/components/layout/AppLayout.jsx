import { Outlet } from 'react-router-dom'
import BottomNav from './BottomNav.jsx'
import Sidebar from './Sidebar.jsx'
import InstallPrompt from './InstallPrompt.jsx'
import OfflineIndicator from './OfflineIndicator.jsx'
import { useApp } from '../../context/AppContext.jsx'

/**
 * Root layout component
 *
 * Mobile: single column with bottom navigation, 16px side padding
 * Desktop: centered content (max 720px) with 56px sidebar on the left
 *
 * Shows a loading spinner while initial data loads from IndexedDB
 */
export default function AppLayout() {
  const { isLoading } = useApp()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-border border-t-accent rounded-full animate-spin" />
          <p className="text-text-muted text-sm">Loading Compass...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Offline indicator banner -- shows at top when network is unavailable */}
      <OfflineIndicator />

      {/* Desktop sidebar - hidden on mobile */}
      <Sidebar />

      {/* Main content area */}
      {/* On desktop: offset by sidebar width (56px), centered with max-width */}
      {/* On mobile: full width with 16px side padding, bottom padding for nav */}
      <main className="md:ml-14 pb-20 md:pb-6">
        <div className="max-w-[720px] mx-auto px-4 py-4 md:py-6">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom navigation - hidden on desktop */}
      <BottomNav />

      {/* PWA install prompt -- shows when app is installable but not yet installed */}
      <InstallPrompt />
    </div>
  )
}
