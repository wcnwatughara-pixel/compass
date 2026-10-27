import { formatGoalTarget, getProgressPercent, getSequencePosition } from '../../utils/goals.js'

/**
 * GoalCard - Displays a single goal in the board list
 *
 * Shows:
 * - Goal name (bold)
 * - Target description (e.g. "50 hours", "Milestone")
 * - Progress bar (colored by status: blue for active, gray for queued, green for complete)
 * - Sequence position tag if part of a chain (e.g. "Step 2 of 5")
 * - Quick-complete checkbox for milestone goals
 *
 * Tapping the card opens GoalDetailView (handled by parent via onClick)
 */
export default function GoalCard({ goal, allGoals, onClick, onCompleteMilestone }) {
  const percent = getProgressPercent(goal)
  const seqPosition = getSequencePosition(goal.id, allGoals)

  // Progress bar color based on goal status
  const barColor = goal.status === 'complete'
    ? 'bg-success'
    : goal.status === 'queued'
      ? 'bg-text-muted'
      : 'bg-accent'

  // Card opacity is reduced for queued goals to visually distinguish them
  const cardOpacity = goal.status === 'queued' ? 'opacity-60' : ''

  return (
    <div
      onClick={onClick}
      className={`bg-bg-primary border border-border rounded-xl p-4 cursor-pointer
        hover:border-accent/40 transition-colors ${cardOpacity}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Goal name */}
          <h3 className="text-sm font-semibold text-text-primary truncate">
            {goal.name}
          </h3>

          {/* Target description */}
          <p className="text-xs text-text-secondary mt-0.5">
            {formatGoalTarget(goal)}
            {goal.status === 'complete' && ' -- Complete'}
          </p>
        </div>

        {/* Quick-complete button for active milestone goals */}
        {goal.targetType === 'milestone' && goal.status === 'active' && onCompleteMilestone && (
          <button
            onClick={(e) => {
              e.stopPropagation() // Don't open detail view
              onCompleteMilestone(goal.id)
            }}
            className="w-6 h-6 rounded-full border-2 border-accent flex items-center justify-center
              hover:bg-accent-light transition-colors flex-shrink-0 mt-0.5"
            title="Mark complete"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
        )}

        {/* Completed checkmark for finished goals */}
        {goal.status === 'complete' && (
          <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white"
              strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
      </div>

      {/* Progress bar -- hidden for milestones since they're binary */}
      {goal.targetType !== 'milestone' && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-text-muted">
              {goal.currentValue} / {goal.targetValue}
            </span>
            <span className="text-[10px] text-text-muted">{percent}%</span>
          </div>
          <div className="w-full h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${barColor}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Sequence position tag -- shown if this goal is part of a chain */}
      {seqPosition && (
        <div className="mt-2">
          <span className="inline-block text-[10px] font-medium text-accent bg-accent-light
            px-2 py-0.5 rounded-full">
            Step {seqPosition.position} of {seqPosition.total}
          </span>
        </div>
      )}
    </div>
  )
}
