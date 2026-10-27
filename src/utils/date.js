/**
 * Date utility functions for Compass
 * All dates stored as YYYY-MM-DD strings for IndexedDB indexing
 */

/**
 * Get today's date as YYYY-MM-DD string
 */
export function getTodayString() {
  const now = new Date()
  return formatDate(now)
}

/**
 * Format a Date object to YYYY-MM-DD string
 */
export function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parse a YYYY-MM-DD string to a Date object (local timezone)
 */
export function parseDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Format a time string (HH:MM) to 12-hour display
 * e.g. "14:30" -> "2:30 PM"
 */
export function formatTime12h(timeString) {
  if (!timeString) return ''
  const [hours, minutes] = timeString.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHour = hours % 12 || 12
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${period}`
}

/**
 * Format minutes into human-readable duration
 * e.g. 90 -> "1h 30m", 45 -> "45m"
 */
export function formatDuration(minutes) {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (remainingMinutes === 0) return `${hours}h`
  return `${hours}h ${remainingMinutes}m`
}

/**
 * Format seconds into MM:SS or HH:MM:SS for timer display
 */
export function formatTimerDisplay(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')

  if (hours > 0) {
    const hh = String(hours).padStart(2, '0')
    return `${hh}:${mm}:${ss}`
  }
  return `${mm}:${ss}`
}

/**
 * Get a friendly display name for a date
 * e.g. "Today", "Yesterday", "Mon, Oct 21"
 */
export function getDateDisplayName(dateString) {
  const today = getTodayString()
  if (dateString === today) return 'Today'

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (dateString === formatDate(yesterday)) return 'Yesterday'

  const date = parseDate(dateString)
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${dayNames[date.getDay()]}, ${monthNames[date.getMonth()]} ${date.getDate()}`
}
