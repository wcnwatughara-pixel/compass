import { useState, useEffect } from 'react'
import { formatGoalTarget, getProgressPercent, getSequencePosition, getGoalProgressEntries, updateGoal } from '../../utils/goals.js'

/**
 * GoalDetailView - Full detail screen for a single goal
 *
 * Shows:
 * - Back button to return to the goal board
 * - Goal name (editable), status badge, target info
 * - Large progress bar with current/target values
 * - Add progress form (for hours/count goals)
 * - Sequence chain visualization (if part of a chain)
 * - Entry log (all progress entries, newest first)
 * - Delete button
 */
export default function GoalDetailView({ goal, allGoals, onBack, onRecordProgress, onCompleteMilestone, onDelete, onRefresh }) {
  const [progressEntries, setProgressEntries] = useState([])
  const [addAmount, setAddAmount] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(goal.name)

  const percent = getProgressPercent(goal)
  const seqPosition = getSequencePosition(goal.id, allGoals)

  // Load progress entries when the view mounts or goal changes
  useEffect(() => {
    async function loadEntries() {
      const entries = await getGoalProgressEntries(goal.id)
      setProgressEntries(entries)
    }
    loadEntries()
  }, [goal.id, goal.currentValue]) // Re-fetch when currentValue changes (new progress recorded)

  /**
   * Handle adding manual progress
   */
  async function handleAddProgress(e) {
    e.preventDefault()
    const amount = Number(addAmount)
    if (!amount || amount <= 0) return
    await onRecordProgress(goal.id, amount, 'manual')
    setAddAmount('')
    // Re-fetch entries
    const entries = await getGoalProgressEntries(goal.id)
    setProgressEntries(entries)
  }

  /**
   * Save an edited goal name
   */
  async function handleSaveName() {
    if (editName.trim() && editName.trim() !== goal.name) {
      await updateGoal(goal.id, { name: editName.trim() })
      await onRefresh()
    }
    setIsEditing(false)
  }

  // Build the sequence chain for visualization
  const chainGoals = buildChainVisualization(goal.id, allGoals)

  // Status badge color
  const statusColors = {
    active: 'bg-accent-light text-accent',
    queued: 'bg-bg-tertiary text-text-muted',
    complete: 'bg-green-100 text-success',
  }

  return (
    <div>
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary
          transition-colors mb-4"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Goals
      </button>

      {/* Goal header: name + status */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1">
          {isEditing ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
              className="text-xl font-bold text-text-primary bg-transparent border-b-2 border-accent
                focus:outline-none w-full"
              autoFocus
            />
          ) : (
            <h1
              className="text-xl font-bold text-text-primary cursor-pointer hover:text-accent transition-colors"
              onClick={() => setIsEditing(true)}
              title="Click to edit name"
            >
              {goal.name}
            </h1>
          )}
          <p className="text-sm text-text-secondary mt-1">{formatGoalTarget(goal)}</p>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[goal.status]}`}>
          {goal.status}
        </span>
      </div>

      {/* Progress section */}
      {goal.targetType !== 'milestone' ? (
        <div className="bg-bg-secondary rounded-xl p-4 mb-4">
          <div className="flex items-end justify-between mb-2">
            <div>
              <span className="text-2xl font-bold text-text-primary">{goal.currentValue}</span>
              <span className="text-sm text-text-muted ml-1">/ {goal.targetValue}</span>
            </div>
            <span className="text-lg font-semibold text-text-secondary">{percent}%</span>
          </div>
          <div className="w-full h-2.5 bg-bg-tertiary rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                goal.status === 'complete' ? 'bg-success' : 'bg-accent'
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      ) : (
        // Milestone: show completion status
        <div className="bg-bg-secondary rounded-xl p-4 mb-4 flex items-center justify-between">
          <span className="text-sm text-text-secondary">
            {goal.status === 'complete' ? 'Completed' : 'Not yet completed'}
          </span>
          {goal.status === 'active' && (
            <button
              onClick={() => onCompleteMilestone(goal.id)}
              className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg
                hover:bg-blue-700 transition-colors"
            >
              Mark Complete
            </button>
          )}
          {goal.status === 'complete' && (
            <div className="w-8 h-8 rounded-full bg-success flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white"
                strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          )}
        </div>
      )}

      {/* Add progress form -- only for active hours/count goals */}
      {goal.status === 'active' && goal.targetType !== 'milestone' && (
        <form onSubmit={handleAddProgress} className="flex gap-2 mb-6">
          <input
            type="number"
            value={addAmount}
            onChange={(e) => setAddAmount(e.target.value)}
            placeholder={goal.targetType === 'hours' ? 'Add hours...' : 'Add count...'}
            min="0.1"
            step="any"
            className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-bg-primary
              text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg
              hover:bg-blue-700 transition-colors"
          >
            Add
          </button>
        </form>
      )}

      {/* Sequence chain visualization */}
      {chainGoals.length > 1 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
            Sequence Chain
          </h2>
          <div className="flex flex-col gap-1">
            {chainGoals.map((cg, index) => (
              <div key={cg.id} className="flex items-center gap-2">
                {/* Vertical connector line */}
                {index > 0 && (
                  <div className="w-4 flex justify-center -mt-1 -mb-1">
                    <div className="w-0.5 h-2 bg-border" />
                  </div>
                )}
                {index > 0 && null}
                <div
                  className={`flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${
                    cg.id === goal.id
                      ? 'bg-accent-light border border-accent/30 font-semibold text-accent'
                      : cg.status === 'complete'
                        ? 'bg-green-50 text-success'
                        : 'bg-bg-secondary text-text-secondary'
                  }`}
                >
                  {/* Status indicator */}
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    cg.status === 'complete' ? 'bg-success' :
                    cg.status === 'active' ? 'bg-accent' : 'bg-text-muted'
                  }`} />
                  <span className="truncate">{cg.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress entry log */}
      <div className="mb-6">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
          Progress Log ({progressEntries.length})
        </h2>
        {progressEntries.length > 0 ? (
          <div className="flex flex-col gap-1">
            {progressEntries.map(entry => (
              <div key={entry.id} className="flex items-center justify-between px-3 py-2
                bg-bg-secondary rounded-lg text-xs">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    entry.source === 'timer' ? 'bg-accent-light text-accent' :
                    entry.source === 'schedule-block' ? 'bg-green-100 text-success' :
                    'bg-bg-tertiary text-text-muted'
                  }`}>
                    {entry.source}
                  </span>
                  <span className="text-text-primary font-medium">+{entry.amount}</span>
                </div>
                <span className="text-text-muted">
                  {new Date(entry.createdAt).toLocaleDateString()} {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-text-muted py-2">No progress recorded yet.</p>
        )}
      </div>

      {/* Completion date if completed */}
      {goal.completedAt && (
        <p className="text-xs text-text-muted mb-4">
          Completed on {new Date(goal.completedAt).toLocaleDateString()}
        </p>
      )}

      {/* Delete button */}
      <button
        onClick={() => onDelete(goal.id)}
        className="w-full py-2.5 text-sm font-medium border border-danger text-danger rounded-lg
          hover:bg-red-50 transition-colors"
      >
        Delete Goal
      </button>
    </div>
  )
}

/**
 * Build a linear chain of goals for visualization
 * Walks up from the current goal to the root, then down through successors
 *
 * @param {number} goalId - the current goal
 * @param {Array} allGoals - all goals
 * @returns {Array} ordered chain from root to deepest successor
 */
function buildChainVisualization(goalId, allGoals) {
  const goalMap = new Map(allGoals.map(g => [g.id, g]))
  const goal = goalMap.get(goalId)
  if (!goal) return []

  // Walk up to the root
  let root = goal
  const visitedUp = new Set([goal.id])
  while (root.sequenceParentId && goalMap.has(root.sequenceParentId)) {
    if (visitedUp.has(root.sequenceParentId)) break
    visitedUp.add(root.sequenceParentId)
    root = goalMap.get(root.sequenceParentId)
  }

  // If root has no children and isn't part of a chain, skip visualization
  const rootHasChildren = allGoals.some(g => g.sequenceParentId === root.id)
  if (!root.sequenceParentId && !rootHasChildren && root.id === goalId) return []

  // Walk down the chain from root, following the path through our target goal
  const chain = [root]
  let current = root
  const visitedDown = new Set([root.id])

  while (true) {
    const children = allGoals.filter(g => g.sequenceParentId === current.id)
    if (children.length === 0) break

    // Prefer the path that goes through our target goal
    let next = children.find(c => c.id === goalId)
    if (!next) {
      // Check if any child leads to our target
      next = children.find(c => {
        const descendants = getDescendants(c.id, allGoals, new Set())
        return descendants.has(goalId)
      })
    }
    if (!next) next = children[0] // fallback: follow first child

    if (visitedDown.has(next.id)) break
    visitedDown.add(next.id)
    chain.push(next)
    current = next
  }

  return chain
}

/**
 * Recursively get all descendant goal IDs
 */
function getDescendants(goalId, allGoals, visited) {
  const children = allGoals.filter(g => g.sequenceParentId === goalId)
  for (const child of children) {
    if (!visited.has(child.id)) {
      visited.add(child.id)
      getDescendants(child.id, allGoals, visited)
    }
  }
  return visited
}
