import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { registerSW } from 'virtual:pwa-register'

/**
 * Register the service worker for offline-first support
 *
 * Using vite-plugin-pwa's autoUpdate strategy:
 * - New service worker installs silently in the background
 * - On next navigation or reload, the updated SW takes over
 * - onOfflineReady fires when all assets are cached for offline use
 *
 * The registerSW call returns an update function, but with autoUpdate
 * the browser handles the update lifecycle automatically
 */
registerSW({
  onOfflineReady() {
    console.log('[Compass] App is ready for offline use')
  },
  onRegisteredSW(swUrl) {
    console.log('[Compass] Service worker registered:', swUrl)
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
