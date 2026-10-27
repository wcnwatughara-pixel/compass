import db from '../db/db.js'

/**
 * Google Drive Sync Module for Compass
 *
 * Strategy: "last-write-wins with conflict log"
 * - On sync trigger (manual button or on-app-open), read JSON file from Google Drive
 * - Compare local syncMeta.lastModified with the Drive file's modified timestamp
 * - If Drive is newer: merge Drive data into local, logging field-level conflicts
 * - If local is newer: overwrite Drive file with local DB export
 * - Conflicts are surfaced in a "Sync Log" panel, not auto-resolved
 *
 * The sync file is a single JSON blob containing all tables.
 * For a single-user app with modest data volume, this is simpler and more
 * reliable than granular per-record sync.
 *
 * SETUP: Replace GOOGLE_CLIENT_ID with your own Google Cloud OAuth client ID.
 * You need to:
 * 1. Create a project in Google Cloud Console
 * 2. Enable the Google Drive API
 * 3. Create OAuth 2.0 credentials (Web application type)
 * 4. Add your app's origin to authorized JavaScript origins
 * 5. Paste the client ID below
 */

// ============================================================================
// CONFIGURATION -- Replace with your own Google Cloud OAuth client ID
// ============================================================================
const GOOGLE_CLIENT_ID = '697820455802-9884ekol3lk1f3u4tka0jc2c9sh6u769.apps.googleusercontent.com'

// Drive API scopes -- we only need access to files we create (appDataFolder)
// drive.file scope limits access to files created by this app only
const SCOPES = 'https://www.googleapis.com/auth/drive.file'

// Name of the sync file stored in the user's Google Drive
const SYNC_FILENAME = 'compass-sync-data.json'

// MIME type for the sync file
const JSON_MIME = 'application/json'

// Google API discovery and token endpoints
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3'

// ============================================================================
// Token Management
// ============================================================================

/**
 * Get the stored OAuth access token from syncMeta
 * Returns null if not connected or token expired
 */
async function getStoredToken() {
  const tokenRecord = await db.syncMeta.get('accessToken')
  const expiryRecord = await db.syncMeta.get('tokenExpiry')

  if (!tokenRecord?.value || !expiryRecord?.value) return null

  // Check if token is expired (with 5-minute buffer)
  const now = Date.now()
  const expiresAt = expiryRecord.value
  if (now >= expiresAt - 300000) return null

  return tokenRecord.value
}

/**
 * Store the OAuth access token and expiry in syncMeta
 * @param {string} token - The access token from Google OAuth
 * @param {number} expiresIn - Token lifetime in seconds
 */
async function storeToken(token, expiresIn) {
  const expiresAt = Date.now() + (expiresIn * 1000)
  await db.syncMeta.bulkPut([
    { key: 'accessToken', value: token },
    { key: 'tokenExpiry', value: expiresAt },
  ])
}

/**
 * Clear stored OAuth credentials (disconnect)
 */
export async function disconnectDrive() {
  await db.syncMeta.bulkDelete([
    'accessToken',
    'tokenExpiry',
    'driveFileId',
    'lastSyncTimestamp',
    'syncEnabled',
  ])
}

// ============================================================================
// OAuth Flow (Google Identity Services implicit grant)
// ============================================================================

/**
 * Load the Google Identity Services (GIS) library dynamically
 * This library handles the OAuth popup flow
 * @returns {Promise<void>} - Resolves when the GIS script is loaded
 */
function loadGisScript() {
  return new Promise((resolve, reject) => {
    // If already loaded, resolve immediately
    if (window.google?.accounts?.oauth2) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = resolve
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'))
    document.head.appendChild(script)
  })
}

/**
 * Initiate the Google OAuth flow using a popup
 * Uses the implicit grant flow (no server needed for a client-side app)
 *
 * @returns {Promise<string>} - The access token on success
 * @throws {Error} - If the user cancels or an error occurs
 */
export async function connectGoogleDrive() {
  if (GOOGLE_CLIENT_ID === 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com') {
    throw new Error(
      'Google Drive sync requires a client ID. ' +
      'Set up a Google Cloud project and paste your client ID in src/utils/sync.js'
    )
  }

  await loadGisScript()

  return new Promise((resolve, reject) => {
    // Initialize the OAuth2 token client
    // This opens a Google sign-in popup for the user
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: async (response) => {
        if (response.error) {
          reject(new Error(`OAuth error: ${response.error}`))
          return
        }

        // Store the token for future API calls
        await storeToken(response.access_token, response.expires_in)
        await db.syncMeta.put({ key: 'syncEnabled', value: true })

        resolve(response.access_token)
      },
    })

    // Trigger the popup
    tokenClient.requestAccessToken()
  })
}

/**
 * Check if Google Drive sync is currently connected and has a valid token
 * @returns {Promise<boolean>}
 */
export async function isDriveConnected() {
  const token = await getStoredToken()
  return token !== null
}

// ============================================================================
// Drive File Operations
// ============================================================================

/**
 * Make an authenticated request to the Google Drive API
 * @param {string} url - Full API URL
 * @param {object} options - Fetch options (method, headers, body)
 * @returns {Promise<Response>} - The fetch response
 * @throws {Error} - If not connected or request fails
 */
async function driveRequest(url, options = {}) {
  const token = await getStoredToken()
  if (!token) {
    throw new Error('Not connected to Google Drive. Please connect first.')
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    ...options.headers,
  }

  const response = await fetch(url, { ...options, headers })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Drive API error (${response.status}): ${errorText}`)
  }

  return response
}

/**
 * Find the Compass sync file in the user's Google Drive
 * Searches by filename in the root folder
 *
 * @returns {Promise<string|null>} - The file ID if found, null otherwise
 */
async function findSyncFile() {
  // Check if we have a cached file ID
  const cached = await db.syncMeta.get('driveFileId')
  if (cached?.value) {
    // Verify it still exists (user might have deleted it)
    try {
      await driveRequest(
        `${DRIVE_API_BASE}/files/${cached.value}?fields=id`
      )
      return cached.value
    } catch {
      // File no longer exists, clear cache
      await db.syncMeta.delete('driveFileId')
    }
  }

  // Search for the file by name
  const query = encodeURIComponent(
    `name='${SYNC_FILENAME}' and trashed=false`
  )
  const response = await driveRequest(
    `${DRIVE_API_BASE}/files?q=${query}&fields=files(id,name,modifiedTime)&spaces=drive`
  )

  const data = await response.json()
  if (data.files && data.files.length > 0) {
    const fileId = data.files[0].id
    // Cache the file ID for future lookups
    await db.syncMeta.put({ key: 'driveFileId', value: fileId })
    return fileId
  }

  return null
}

/**
 * Read the sync file contents from Google Drive
 * @returns {Promise<{data: object, modifiedTime: string}|null>}
 *   The parsed JSON data and its last modified timestamp, or null if no file exists
 */
async function readSyncFile() {
  const fileId = await findSyncFile()
  if (!fileId) return null

  // Get metadata (for modifiedTime) and content in parallel
  const [metaResponse, contentResponse] = await Promise.all([
    driveRequest(`${DRIVE_API_BASE}/files/${fileId}?fields=modifiedTime`),
    driveRequest(`${DRIVE_API_BASE}/files/${fileId}?alt=media`),
  ])

  const meta = await metaResponse.json()
  const data = await contentResponse.json()

  return {
    data,
    modifiedTime: meta.modifiedTime,
  }
}

/**
 * Write (create or update) the sync file on Google Drive
 * Uses multipart upload for creating, simple upload for updating
 *
 * @param {object} jsonData - The full database export to write
 * @returns {Promise<string>} - The file ID of the created/updated file
 */
async function writeSyncFile(jsonData) {
  const fileId = await findSyncFile()
  const body = JSON.stringify(jsonData, null, 2)

  if (fileId) {
    // Update existing file -- PATCH with media upload
    const response = await driveRequest(
      `${DRIVE_UPLOAD_BASE}/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': JSON_MIME },
        body,
      }
    )
    return (await response.json()).id
  }

  // Create new file -- multipart upload (metadata + content)
  // We use the multipart upload to set the filename in one request
  const metadata = {
    name: SYNC_FILENAME,
    mimeType: JSON_MIME,
  }

  const boundary = 'compass_sync_boundary'
  const multipartBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${JSON_MIME}\r\n\r\n` +
    `${body}\r\n` +
    `--${boundary}--`

  const response = await driveRequest(
    `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart`,
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  )

  const result = await response.json()
  // Cache the new file ID
  await db.syncMeta.put({ key: 'driveFileId', value: result.id })
  return result.id
}

// ============================================================================
// Data Export / Import
// ============================================================================

/**
 * Export the entire local database as a JSON object
 * Includes all tables and a sync timestamp
 *
 * @returns {Promise<object>} - The full database export
 */
export async function exportLocalData() {
  return {
    version: 4,
    exportedAt: new Date().toISOString(),
    lastModified: Date.now(),
    scheduleTemplates: await db.scheduleTemplates.toArray(),
    dailySchedules: await db.dailySchedules.toArray(),
    entries: await db.entries.toArray(),
    settings: await db.settings.toArray(),
    goals: await db.goals.toArray(),
    goalProgress: await db.goalProgress.toArray(),
    wikiPages: await db.wikiPages.toArray(),
    wikiLinks: await db.wikiLinks.toArray(),
  }
}

/**
 * Import data from a JSON object into the local database
 * Replaces all existing data (within a transaction for atomicity)
 *
 * @param {object} data - The data to import (from exportLocalData or Drive)
 */
async function importDataToLocal(data) {
  await db.transaction('rw',
    db.scheduleTemplates, db.dailySchedules, db.entries, db.settings,
    db.goals, db.goalProgress, db.wikiPages, db.wikiLinks,
    async () => {
      // Clear all tables
      await Promise.all([
        db.scheduleTemplates.clear(),
        db.dailySchedules.clear(),
        db.entries.clear(),
        db.settings.clear(),
        db.goals.clear(),
        db.goalProgress.clear(),
        db.wikiPages.clear(),
        db.wikiLinks.clear(),
      ])

      // Bulk-add imported data (skip empty arrays)
      const bulkOps = []
      if (data.scheduleTemplates?.length) bulkOps.push(db.scheduleTemplates.bulkAdd(data.scheduleTemplates))
      if (data.dailySchedules?.length) bulkOps.push(db.dailySchedules.bulkAdd(data.dailySchedules))
      if (data.entries?.length) bulkOps.push(db.entries.bulkAdd(data.entries))
      if (data.settings?.length) bulkOps.push(db.settings.bulkAdd(data.settings))
      if (data.goals?.length) bulkOps.push(db.goals.bulkAdd(data.goals))
      if (data.goalProgress?.length) bulkOps.push(db.goalProgress.bulkAdd(data.goalProgress))
      if (data.wikiPages?.length) bulkOps.push(db.wikiPages.bulkAdd(data.wikiPages))
      if (data.wikiLinks?.length) bulkOps.push(db.wikiLinks.bulkAdd(data.wikiLinks))

      await Promise.all(bulkOps)
    }
  )
}

// ============================================================================
// Conflict Detection
// ============================================================================

/**
 * Log a sync conflict to the syncMeta table
 * Conflicts are stored with a timestamped key for display in the sync log
 *
 * @param {string} table - The table name where the conflict occurred
 * @param {string} description - Human-readable description of the conflict
 * @param {string} resolution - How the conflict was resolved ('local-wins' or 'drive-wins')
 */
async function logConflict(table, description, resolution) {
  const timestamp = Date.now()
  await db.syncMeta.put({
    key: `conflict_${timestamp}_${Math.random().toString(36).slice(2, 6)}`,
    value: {
      table,
      description,
      resolution,
      timestamp,
      date: new Date(timestamp).toISOString(),
    },
  })
}

/**
 * Get all sync conflict log entries, sorted newest first
 * @returns {Promise<Array>} - Array of conflict log entries
 */
export async function getSyncConflicts() {
  const allMeta = await db.syncMeta.toArray()
  return allMeta
    .filter(item => item.key.startsWith('conflict_'))
    .map(item => ({ id: item.key, ...item.value }))
    .sort((a, b) => b.timestamp - a.timestamp)
}

/**
 * Clear the sync conflict log
 */
export async function clearSyncConflicts() {
  const allMeta = await db.syncMeta.toArray()
  const conflictKeys = allMeta
    .filter(item => item.key.startsWith('conflict_'))
    .map(item => item.key)
  await db.syncMeta.bulkDelete(conflictKeys)
}

// ============================================================================
// Main Sync Logic
// ============================================================================

/**
 * Perform a full sync with Google Drive
 *
 * Logic:
 * 1. Export local data
 * 2. Read remote (Drive) data
 * 3. Compare timestamps
 * 4. If Drive is newer: import Drive data locally, log conflicts
 * 5. If local is newer: push local data to Drive
 * 6. If no remote file exists: push local data (first sync)
 *
 * @returns {Promise<object>} Sync result with status and details:
 *   { status: 'pushed'|'pulled'|'up-to-date'|'first-sync', conflicts: number, timestamp: string }
 * @throws {Error} If sync fails
 */
export async function performSync() {
  const connected = await isDriveConnected()
  if (!connected) {
    throw new Error('Not connected to Google Drive. Please connect first.')
  }

  // Step 1: Export current local data
  const localData = await exportLocalData()
  const localTimestamp = await db.syncMeta.get('lastSyncTimestamp')
  const localLastModified = localData.lastModified

  // Step 2: Read the remote file from Drive
  const remote = await readSyncFile()

  // Step 3: Decide sync direction
  if (!remote) {
    // No file on Drive yet -- first sync, push local data up
    await writeSyncFile(localData)
    await db.syncMeta.put({ key: 'lastSyncTimestamp', value: Date.now() })
    return {
      status: 'first-sync',
      conflicts: 0,
      timestamp: new Date().toISOString(),
    }
  }

  const driveModifiedTime = new Date(remote.modifiedTime).getTime()
  const lastSync = localTimestamp?.value || 0

  // Compare: has Drive been updated since our last sync?
  const driveIsNewer = driveModifiedTime > lastSync
  // Compare: has local been modified since our last sync?
  // We use the lastModified field from our own export as the marker
  const remoteLastModified = remote.data?.lastModified || 0
  const localIsNewer = localLastModified > remoteLastModified

  if (driveIsNewer && !localIsNewer) {
    // Drive has changes we don't have -- pull from Drive
    await importDataToLocal(remote.data)
    await db.syncMeta.put({ key: 'lastSyncTimestamp', value: Date.now() })
    return {
      status: 'pulled',
      conflicts: 0,
      timestamp: new Date().toISOString(),
    }
  }

  if (localIsNewer && !driveIsNewer) {
    // Local has changes Drive doesn't -- push to Drive
    await writeSyncFile(localData)
    await db.syncMeta.put({ key: 'lastSyncTimestamp', value: Date.now() })
    return {
      status: 'pushed',
      conflicts: 0,
      timestamp: new Date().toISOString(),
    }
  }

  if (driveIsNewer && localIsNewer) {
    // Both sides changed -- conflict scenario
    // Strategy: last-write-wins (local wins), but log the conflict
    // so the user can review what was overwritten
    const conflictCount = await detectAndLogConflicts(localData, remote.data)
    await writeSyncFile(localData)
    await db.syncMeta.put({ key: 'lastSyncTimestamp', value: Date.now() })
    return {
      status: 'pushed',
      conflicts: conflictCount,
      timestamp: new Date().toISOString(),
    }
  }

  // Neither side has changes since last sync
  return {
    status: 'up-to-date',
    conflicts: 0,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Detect differences between local and remote data and log them as conflicts
 * Compares record counts per table and notes any discrepancies
 *
 * @param {object} localData - The local database export
 * @param {object} remoteData - The Drive file data
 * @returns {Promise<number>} - The number of conflicts detected
 */
async function detectAndLogConflicts(localData, remoteData) {
  let conflictCount = 0

  // Compare each table's record counts to detect divergence
  const tables = [
    'scheduleTemplates', 'dailySchedules', 'entries', 'settings',
    'goals', 'goalProgress', 'wikiPages', 'wikiLinks',
  ]

  for (const table of tables) {
    const localCount = localData[table]?.length || 0
    const remoteCount = remoteData[table]?.length || 0

    if (localCount !== remoteCount) {
      await logConflict(
        table,
        `Record count differs: local has ${localCount}, Drive has ${remoteCount}. Local version kept.`,
        'local-wins'
      )
      conflictCount++
    }
  }

  // Log a general conflict if both sides were modified
  if (conflictCount === 0) {
    await logConflict(
      'general',
      'Both local and Drive were modified since last sync. Local version kept.',
      'local-wins'
    )
    conflictCount = 1
  }

  return conflictCount
}

/**
 * Get the last sync status for display in the UI
 * @returns {Promise<{connected: boolean, lastSync: string|null, syncEnabled: boolean}>}
 */
export async function getSyncStatus() {
  const connected = await isDriveConnected()
  const lastSync = await db.syncMeta.get('lastSyncTimestamp')
  const syncEnabled = await db.syncMeta.get('syncEnabled')

  return {
    connected,
    lastSync: lastSync?.value ? new Date(lastSync.value).toISOString() : null,
    syncEnabled: syncEnabled?.value || false,
  }
}
