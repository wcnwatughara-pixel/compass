import { useCallback } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { updateBlockStatus } from '../../utils/schedule.js'
import { getDateDisplayName, getTodayString } from '../../utils/date.js'
import BlockCard from './BlockCard.jsx'
import DayStatsBar from './DayStatsBar.jsx'

/**
 * TodayScreen - The main daily view
 *
 * Shows today's schedule auto-generated from the active template:
 * - Date header with friendly name ("Today", "Yesterday", etc.)
 * - Daily stats bar (progress, time tracked)
 * - List of time blocks sorted by start time
 * - Empty state when no template is active
 *
 * Block status changes are saved to IndexedDB immediately
 */
export default function TodayScreen() {
  const { todaySchedule, refreshTodaySchedule } = useApp()
  const today = getTodayString()

  /**
   * Handle block status change
   * Updates the block in IndexedDB and refreshes the schedule in context
   */
  const handleStatusChange = useCallback(async (blockId, newStatus) => {
    if (!todaySchedule) return

    await updateBlockStatus(todaySchedule.id, blockId, {
      status: newStatus,
      // When marking complete, set actualMinutes to planned duration
      ...(newStatus === 'complete' ? {
        actualMinutes: todaySchedule.blocks.find(b => b.blockId === blockId)?.durationMinutes || 0
      } : {}),
    })

    // Refresh the schedule from DB to update the UI
    await refreshTodaySchedule()
  }, [todaySchedule, refreshTodaySchedule])

  // Empty state: no schedule generated (no active template)
  if (!todaySchedule || !todaySchedule.blocks || todaySchedule.blocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-bg-secondary flex items-center justify-center mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-text-primary mb-1">No schedule for today</h2>
        <p className="text-sm text-text-muted max-w-[280px]">
          Create a schedule template and set it as active in Settings to start tracking your day.
        </p>
      </div>
    )
  }

  // Sort blocks by start time (blocks without a start time go to the end)
  const sortedBlocks = [...todaySchedule.blocks].sort((a, b) => {
    if (!a.startTime) return 1
    if (!b.startTime) return -1
    return a.startTime.localeCompare(b.startTime)
  })

  return (
    <div>
      {/* Page header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-text-primary">
          {getDateDisplayName(today)}
        </h1>
      </div>

      {/* Daily stats summary */}
      <div className="mb-4">
        <DayStatsBar blocks={todaySchedule.blocks} />
      </div>

      {/* Time blocks list */}
      <div className="flex flex-col gap-2">
        {sortedBlocks.map((block) => (
          <BlockCard
            key={block.blockId}
            block={block}
            onStatusChange={handleStatusChange}
          />
        ))}
      </div>
    </div>
  )
}
