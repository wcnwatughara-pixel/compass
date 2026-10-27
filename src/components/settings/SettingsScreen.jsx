import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import db from '../../db/db.js'
import {
  connectGoogleDrive,
  disconnectDrive,
  performSync,
  getSyncStatus,
  getSyncConflicts,
  clearSyncConflicts,
  exportLocalData,
} from '../../utils/sync.js'

/**
 * SettingsScreen - App configuration, sync, and data management
 *
 * Sections:
 * 1. Active Template -- select which schedule template auto-generates daily schedules
 * 2. Google Drive Sync -- connect/disconnect, manual sync, sync log viewer
 * 3. Data Management -- export (JSON + CSV), import from JSON, clear all
 * 4. Danger Zone -- clear all data with double confirmation
 * 5. App info -- version string
 */
export default function SettingsScreen() {
  const { settings, templates, updateSetting, refreshTemplates, refreshTodaySchedule, refreshGoals, refreshWikiPages } = useApp()
  const [importStatus, setImportStatus] = useState(null)

  // Google Drive sync state
  const [syncConnected, setSyncConnected] = useState(false)
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncMessage, setSyncMessage] = useState(null)
  const [lastSyncTime, setLastSyncTime] = useState(null)
  const [syncConflicts, setSyncConflicts] = useState([])
  const [showSyncLog, setShowSyncLog] = useState(false)

  // Load sync status on mount so UI reflects current connection state
  useEffect(() => {
    async function loadSyncStatus() {
      try {
        const status = await getSyncStatus()
        setSyncConnected(status.connected)
        setLastSyncTime(status.lastSync)

        const conflicts = await getSyncConflicts()
        setSyncConflicts(conflicts)
      } catch {
        // Sync not configured yet -- that's expected on first launch
      }
    }
    loadSyncStatus()
  }, [])

  /**
   * Change the active template used for daily schedule generation
   * The new template takes effect the next day (or on manual regeneration)
   */
  async function handleTemplateChange(e) {
    const templateId = e.target.value
    await updateSetting('activeTemplateId', templateId ? Number(templateId) : null)
  }

  // ===========================================================================
  // Google Drive Sync Handlers
  // ===========================================================================

  /**
   * Connect to Google Drive via OAuth popup
   * Uses Google Identity Services implicit grant flow (no server needed)
   * After connecting, the user can manually trigger syncs
   */
  async function handleConnectDrive() {
    setSyncLoading(true)
    setSyncMessage(null)
    try {
      await connectGoogleDrive()
      setSyncConnected(true)
      setSyncMessage({ type: 'success', text: 'Connected to Google Drive!' })
    } catch (error) {
      setSyncMessage({ type: 'error', text: error.message })
    } finally {
      setSyncLoading(false)
    }
  }

  /**
   * Disconnect from Google Drive
   * Clears stored OAuth token and sync metadata but preserves local data
   */
  async function handleDisconnectDrive() {
    if (!window.confirm('Disconnect from Google Drive? Your local data will not be affected.')) return
    await disconnectDrive()
    setSyncConnected(false)
    setLastSyncTime(null)
    setSyncMessage({ type: 'success', text: 'Disconnected from Google Drive.' })
  }

  /**
   * Trigger a manual sync with Google Drive
   * Compares local vs remote timestamps and pushes/pulls accordingly
   * Shows result status (pushed/pulled/up-to-date/conflicts) in the UI
   */
  async function handleManualSync() {
    setSyncLoading(true)
    setSyncMessage(null)
    try {
      const result = await performSync()

      // After pulling remote data, refresh all app state to reflect changes
      if (result.status === 'pulled') {
        await refreshTemplates()
        await refreshTodaySchedule()
        await refreshGoals()
        await refreshWikiPages()
      }

      // Map sync result status to human-readable messages
      const statusMessages = {
        'first-sync': 'First sync complete! Your data is now on Google Drive.',
        'pushed': 'Local changes pushed to Google Drive.',
        'pulled': 'Updated local data from Google Drive.',
        'up-to-date': 'Everything is already in sync.',
      }

      let text = statusMessages[result.status] || 'Sync completed.'
      if (result.conflicts > 0) {
        text += ` ${result.conflicts} conflict(s) detected. Check the sync log.`
      }

      setSyncMessage({ type: 'success', text })
      setLastSyncTime(result.timestamp)

      // Refresh conflict log to show any new entries
      const conflicts = await getSyncConflicts()
      setSyncConflicts(conflicts)
    } catch (error) {
      setSyncMessage({ type: 'error', text: `Sync failed: ${error.message}` })
    } finally {
      setSyncLoading(false)
    }
  }

  /**
   * Clear all entries in the sync conflict log
   */
  async function handleClearSyncLog() {
    await clearSyncConflicts()
    setSyncConflicts([])
  }

  // ===========================================================================
  // Data Export Handlers (JSON + CSV)
  // ===========================================================================

  /**
   * Export all data from IndexedDB as a JSON file
   * Uses the shared exportLocalData() utility from sync module
   */
  async function handleExportJSON() {
    try {
      const data = await exportLocalData()
      downloadFile(
        JSON.stringify(data, null, 2),
        `compass-backup-${todayString()}.json`,
        'application/json'
      )
    } catch (error) {
      console.error('Export failed:', error)
      alert('Export failed. Check the console for details.')
    }
  }

  /**
   * Export schedule history as CSV
   * Each row represents one block from a daily schedule
   * Columns: Date, Block Name, Start Time, End Time, Status, Hours Logged
   */
  async function handleExportScheduleCSV() {
    try {
      const schedules = await db.dailySchedules.toArray()
      const entries = await db.entries.toArray()

      // Header row
      const rows = [['Date', 'Block Name', 'Start Time', 'End Time', 'Status', 'Hours Logged']]

      for (const schedule of schedules) {
        if (!schedule.blocks) continue
        for (const block of schedule.blocks) {
          // Sum hours logged for this block from entries table
          // Entries link to blocks via blockId + date compound lookup
          const blockEntries = entries.filter(
            e => e.blockId === block.id && e.date === schedule.date
          )
          const hoursLogged = blockEntries.reduce((sum, e) => sum + (e.hours || 0), 0)

          rows.push([
            schedule.date,
            csvEscape(block.name || ''),
            block.startTime || '',
            block.endTime || '',
            block.status || 'pending',
            hoursLogged.toFixed(2),
          ])
        }
      }

      const csv = rows.map(row => row.join(',')).join('\n')
      downloadFile(csv, `compass-schedule-${todayString()}.csv`, 'text/csv')
    } catch (error) {
      console.error('CSV export failed:', error)
      alert('Schedule CSV export failed.')
    }
  }

  /**
   * Export goal history as CSV
   * Each row represents one goal with its current progress and metadata
   * Columns: Goal Name, Target Type, Target Value, Current Value, Status, Created, Completed, Progress Entries
   */
  async function handleExportGoalCSV() {
    try {
      const goals = await db.goals.toArray()
      const progress = await db.goalProgress.toArray()

      const rows = [['Goal Name', 'Target Type', 'Target Value', 'Current Value', 'Status', 'Created', 'Completed', 'Total Progress Entries']]

      for (const goal of goals) {
        // Count progress entries linked to this goal
        const progressCount = progress.filter(p => p.goalId === goal.id).length

        rows.push([
          csvEscape(goal.name || ''),
          goal.targetType || '',
          goal.targetValue || 0,
          goal.currentValue || 0,
          goal.status || '',
          goal.createdAt ? new Date(goal.createdAt).toISOString().split('T')[0] : '',
          goal.completedAt ? new Date(goal.completedAt).toISOString().split('T')[0] : '',
          progressCount,
        ])
      }

      const csv = rows.map(row => row.join(',')).join('\n')
      downloadFile(csv, `compass-goals-${todayString()}.csv`, 'text/csv')
    } catch (error) {
      console.error('CSV export failed:', error)
      alert('Goal CSV export failed.')
    }
  }

  /**
   * Import data from a previously exported JSON file
   * Replaces all existing data in a single transaction (after confirmation)
   */
  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const data = JSON.parse(text)

      // Basic validation: check for expected structure
      if (!data.version || !data.scheduleTemplates) {
        setImportStatus('Invalid backup file format.')
        return
      }

      if (!window.confirm('This will replace all current data. Continue?')) {
        e.target.value = ''
        return
      }

      // Clear existing data and import new data atomically
      // Includes all tables through Stage 4 (syncMeta excluded -- that's local-only)
      await db.transaction('rw',
        db.scheduleTemplates, db.dailySchedules, db.entries, db.settings,
        db.goals, db.goalProgress, db.wikiPages, db.wikiLinks,
        async () => {
          await db.scheduleTemplates.clear()
          await db.dailySchedules.clear()
          await db.entries.clear()
          await db.settings.clear()
          await db.goals.clear()
          await db.goalProgress.clear()
          await db.wikiPages.clear()
          await db.wikiLinks.clear()

          if (data.scheduleTemplates?.length) await db.scheduleTemplates.bulkAdd(data.scheduleTemplates)
          if (data.dailySchedules?.length) await db.dailySchedules.bulkAdd(data.dailySchedules)
          if (data.entries?.length) await db.entries.bulkAdd(data.entries)
          if (data.settings?.length) await db.settings.bulkAdd(data.settings)
          if (data.goals?.length) await db.goals.bulkAdd(data.goals)
          if (data.goalProgress?.length) await db.goalProgress.bulkAdd(data.goalProgress)
          if (data.wikiPages?.length) await db.wikiPages.bulkAdd(data.wikiPages)
          if (data.wikiLinks?.length) await db.wikiLinks.bulkAdd(data.wikiLinks)
        }
      )

      // Refresh app state from the newly imported data
      await refreshTemplates()
      await refreshTodaySchedule()
      await refreshGoals()
      await refreshWikiPages()
      setImportStatus('Data imported successfully!')
    } catch (error) {
      console.error('Import failed:', error)
      setImportStatus('Import failed. Make sure the file is a valid Compass backup.')
    }

    e.target.value = ''
  }

  /**
   * Clear all data from IndexedDB (nuclear option)
   * Requires double confirmation to prevent accidental data loss
   */
  async function handleClearData() {
    if (!window.confirm('This will permanently delete ALL your data. Are you sure?')) return
    if (!window.confirm('Really? This cannot be undone.')) return

    await db.transaction('rw',
      db.scheduleTemplates, db.dailySchedules, db.entries, db.settings,
      db.goals, db.goalProgress, db.wikiPages, db.wikiLinks,
      async () => {
        await db.scheduleTemplates.clear()
        await db.dailySchedules.clear()
        await db.entries.clear()
        await db.settings.clear()
        await db.goals.clear()
        await db.goalProgress.clear()
        await db.wikiPages.clear()
        await db.wikiLinks.clear()
      }
    )

    await refreshTemplates()
    await refreshTodaySchedule()
    await refreshGoals()
    await refreshWikiPages()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-6">Settings</h1>

      {/* Active Template Selection */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-text-primary mb-2">Active Template</h2>
        <p className="text-sm text-text-muted mb-3">
          This template is used to auto-generate your daily schedule each morning.
        </p>
        <select
          value={settings.activeTemplateId || ''}
          onChange={handleTemplateChange}
          className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-bg-primary
            text-text-primary focus:outline-none focus:border-accent"
        >
          <option value="">None (no auto-generation)</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.type} - {t.blocks?.length || 0} blocks)
            </option>
          ))}
        </select>
      </section>

      {/* Google Drive Sync */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-text-primary mb-2">Google Drive Sync</h2>
        <p className="text-sm text-text-muted mb-4">
          Sync your data across devices using Google Drive.
          Your data is stored as a private JSON file in your Drive.
        </p>

        <div className="flex flex-col gap-3">
          {syncConnected ? (
            <>
              {/* Connected state: show status indicator, sync button, disconnect */}
              <div className="flex items-center gap-2 text-sm text-green-600">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20,6 9,17 4,12" />
                </svg>
                <span>Connected to Google Drive</span>
              </div>

              {lastSyncTime && (
                <p className="text-xs text-text-muted">
                  Last synced: {new Date(lastSyncTime).toLocaleString()}
                </p>
              )}

              <button
                onClick={handleManualSync}
                disabled={syncLoading}
                className="w-full py-2.5 text-sm font-medium bg-accent text-white rounded-lg
                  hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {syncLoading ? 'Syncing...' : 'Sync Now'}
              </button>

              <button
                onClick={handleDisconnectDrive}
                className="w-full py-2.5 text-sm font-medium border border-border rounded-lg
                  text-text-secondary hover:bg-bg-secondary transition-colors"
              >
                Disconnect Google Drive
              </button>
            </>
          ) : (
            /* Disconnected state: show connect button */
            <button
              onClick={handleConnectDrive}
              disabled={syncLoading}
              className="w-full py-2.5 text-sm font-medium bg-accent text-white rounded-lg
                hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {syncLoading ? 'Connecting...' : 'Connect Google Drive'}
            </button>
          )}

          {/* Sync status message (success or error feedback) */}
          {syncMessage && (
            <p className={`text-sm ${syncMessage.type === 'error' ? 'text-danger' : 'text-green-600'}`}>
              {syncMessage.text}
            </p>
          )}

          {/* Sync Log -- shows conflict entries from sync operations */}
          {syncConflicts.length > 0 && (
            <div>
              <button
                onClick={() => setShowSyncLog(!showSyncLog)}
                className="text-sm text-accent hover:underline"
              >
                {showSyncLog ? 'Hide' : 'Show'} Sync Log ({syncConflicts.length} entries)
              </button>

              {showSyncLog && (
                <div className="mt-2 border border-border rounded-lg p-3 max-h-48 overflow-y-auto">
                  {syncConflicts.map((conflict) => (
                    <div
                      key={conflict.key || conflict.id}
                      className="text-xs text-text-secondary mb-2 pb-2 border-b border-border
                        last:border-0 last:mb-0 last:pb-0"
                    >
                      <span className="font-medium text-text-primary">{conflict.table}</span>
                      <span className="mx-1">&middot;</span>
                      <span>{conflict.description}</span>
                      <div className="text-text-muted mt-0.5">
                        {new Date(conflict.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={handleClearSyncLog}
                    className="mt-2 text-xs text-danger hover:underline"
                  >
                    Clear Log
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Data Management */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-text-primary mb-2">Data Management</h2>
        <p className="text-sm text-text-muted mb-4">
          Export your data as JSON backup or CSV spreadsheet, or import from a previous backup.
        </p>

        <div className="flex flex-col gap-3">
          {/* JSON Export -- full backup of all tables */}
          <button
            onClick={handleExportJSON}
            className="w-full py-2.5 text-sm font-medium border border-border rounded-lg
              text-text-primary hover:bg-bg-secondary transition-colors"
          >
            Export All Data (JSON)
          </button>

          {/* CSV Export -- schedule history for spreadsheet analysis */}
          <button
            onClick={handleExportScheduleCSV}
            className="w-full py-2.5 text-sm font-medium border border-border rounded-lg
              text-text-primary hover:bg-bg-secondary transition-colors"
          >
            Export Schedule History (CSV)
          </button>

          {/* CSV Export -- goal progress for spreadsheet analysis */}
          <button
            onClick={handleExportGoalCSV}
            className="w-full py-2.5 text-sm font-medium border border-border rounded-lg
              text-text-primary hover:bg-bg-secondary transition-colors"
          >
            Export Goal History (CSV)
          </button>

          {/* Import from JSON backup */}
          <label
            className="w-full py-2.5 text-sm font-medium border border-border rounded-lg
              text-text-primary hover:bg-bg-secondary transition-colors text-center cursor-pointer block"
          >
            Import Data (JSON)
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </label>

          {importStatus && (
            <p className="text-sm text-accent">{importStatus}</p>
          )}
        </div>
      </section>

      {/* Danger Zone */}
      <section>
        <h2 className="text-base font-semibold text-danger mb-2">Danger Zone</h2>
        <button
          onClick={handleClearData}
          className="w-full py-2.5 text-sm font-medium border border-danger text-danger rounded-lg
            hover:bg-red-50 transition-colors"
        >
          Clear All Data
        </button>
      </section>

      {/* App info */}
      <div className="mt-12 text-center">
        <p className="text-xs text-text-muted">Compass v0.4.0 - Stage 4</p>
      </div>
    </div>
  )
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get today's date as YYYY-MM-DD string for export filenames
 */
function todayString() {
  return new Date().toISOString().split('T')[0]
}

/**
 * Escape a value for safe CSV output
 * Wraps in double quotes if the value contains commas, quotes, or newlines
 * Inner quotes are doubled per RFC 4180
 * @param {string} value - raw cell value
 * @returns {string} CSV-safe string
 */
function csvEscape(value) {
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Trigger a file download in the browser
 * Creates a temporary anchor element, clicks it, then cleans up
 * @param {string} content - file contents as string
 * @param {string} filename - suggested download filename
 * @param {string} mimeType - MIME type for the Blob
 */
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
