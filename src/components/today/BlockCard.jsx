import { formatTime12h, formatDuration } from '../../utils/date.js'

/**
 * BlockCard - A single time block displayed in the Today screen
 *
 * Design: horizontal card with 4px left color bar indicating status
 * - Gray (#E0E0E0): pending
 * - Blue (#2563EB): in-progress
 * - Green (#16A34A): complete
 * - Red (#DC2626): skipped
 * - Orange (#F59E0B): partial
 *
 * Shows block name, time, duration, and category
 * Tap cycles status: pending -> in-progress -> complete
 * Long-press or secondary action: skip / partial
 */

// Map block status to left border color
const STATUS_COLORS = {
  'pending': 'border-l-border',
  'in-progress': 'border-l-accent',
  'complete': 'border-l-success',
  'skipped': 'border-l-danger',
  'partial': 'border-l-warning',
}

// Map category to a subtle background tint for the category badge
const CATEGORY_STYLES = {
  work: 'bg-accent-light text-accent',
  personal: 'bg-bg-tertiary text-text-secondary',
  learning: 'bg-amber-50 text-amber-700',
  health: 'bg-green-50 text-green-700',
}

export default function BlockCard({ block, onStatusChange, onNoteChange }) {
  const borderClass = STATUS_COLORS[block.status] || STATUS_COLORS.pending
  const categoryStyle = CATEGORY_STYLES[block.category] || CATEGORY_STYLES.personal

  /**
   * Cycle through statuses on click:
   * pending -> in-progress -> complete -> pending
   */
  function handleStatusCycle() {
    const nextStatus = {
      'pending': 'in-progress',
      'in-progress': 'complete',
      'complete': 'pending',
      'skipped': 'pending',
      'partial': 'pending',
    }
    onStatusChange(block.blockId, nextStatus[block.status] || 'pending')
  }

  /**
   * Context menu for skip/partial options
   */
  function handleContextMenu(e) {
    e.preventDefault()
    // Simple toggle between skip states
    if (block.status === 'skipped') {
      onStatusChange(block.blockId, 'pending')
    } else {
      onStatusChange(block.blockId, 'skipped')
    }
  }

  return (
    <div
      className={`bg-bg-primary border border-border rounded-lg p-4 border-l-4 ${borderClass}
        cursor-pointer hover:bg-bg-secondary transition-colors active:bg-bg-tertiary`}
      onClick={handleStatusCycle}
      onContextMenu={handleContextMenu}
      role="button"
      tabIndex={0}
      aria-label={`${block.name} - ${block.status}`}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Left side: block info */}
        <div className="flex-1 min-w-0">
          <h3 className={`text-[15px] font-medium truncate ${
            block.status === 'complete' ? 'line-through text-text-muted' : 'text-text-primary'
          }`}>
            {block.name}
          </h3>

          <div className="flex items-center gap-2 mt-1">
            {/* Time display */}
            {block.startTime && (
              <span className="text-xs text-text-secondary">
                {formatTime12h(block.startTime)}
              </span>
            )}
            {/* Duration */}
            <span className="text-xs text-text-muted">
              {formatDuration(block.durationMinutes)}
            </span>
          </div>
        </div>

        {/* Right side: category badge and status indicator */}
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full ${categoryStyle}`}>
            {block.category}
          </span>

          {/* Status checkbox-like indicator */}
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
            block.status === 'complete'
              ? 'bg-success border-success text-white'
              : block.status === 'in-progress'
              ? 'border-accent bg-accent-light'
              : block.status === 'skipped'
              ? 'border-danger bg-red-50'
              : 'border-border'
          }`}>
            {block.status === 'complete' && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            {block.status === 'skipped' && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* Notes (if any) */}
      {block.notes && (
        <p className="text-xs text-text-muted mt-2 italic">{block.notes}</p>
      )}
    </div>
  )
}
