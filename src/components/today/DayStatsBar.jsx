import { calculateDayStats } from '../../utils/schedule.js'
import { formatDuration } from '../../utils/date.js'

/**
 * DayStatsBar - Shows daily progress at a glance
 *
 * Displays:
 * - Progress bar (6px height, rounded, #EBEBEB track)
 * - Completed / Total blocks count
 * - Actual time tracked vs planned time
 */
export default function DayStatsBar({ blocks }) {
  const stats = calculateDayStats(blocks)
  const progressPercent = stats.total > 0
    ? Math.round((stats.completed / stats.total) * 100)
    : 0

  return (
    <div className="bg-bg-primary border border-border rounded-lg p-4">
      {/* Stats row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-2xl font-semibold text-text-primary">
              {stats.completed}
            </span>
            <span className="text-sm text-text-muted">/{stats.total} blocks</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-sm text-text-secondary">
            {formatDuration(stats.actualMinutes)}
          </span>
          <span className="text-xs text-text-muted"> / {formatDuration(stats.totalMinutes)}</span>
        </div>
      </div>

      {/* Progress bar: 6px height, rounded ends */}
      <div className="w-full h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  )
}
