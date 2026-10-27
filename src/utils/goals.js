import db from '../db/db.js'
import { getTodayString } from './date.js'

/**
 * Goal utility functions
 *
 * Handles CRUD operations, progress tracking, sequential chain logic,
 * and branching path resolution for the Goals Engine (Stage 2).
 */

/**
 * Create a new goal and persist it to IndexedDB
 *
 * @param {Object} goalData - partial goal fields from the creation form
 * @param {string} goalData.name - goal name
 * @param {string} goalData.targetType - 'hours' | 'count' | 'milestone'
 * @param {number} goalData.targetValue - target amount (1 for milestones)
 * @param {string} [goalData.status] - defaults to 'active'
 * @param {number|null} [goalData.sequenceParentId] - predecessor goal id
 * @returns {Promise<number>} the new goal's auto-generated id
 */
export async function createGoal(goalData) {
  const now = new Date().toISOString()

  const goal = {
    name: goalData.name,
    targetType: goalData.targetType,
    // Milestones always have targetValue = 1 (done or not done)
    targetValue: goalData.targetType === 'milestone' ? 1 : Number(goalData.targetValue),
    currentValue: 0,
    // If this goal has a sequenceParentId, it starts as 'queued'
    // (auto-activates when the parent completes)
    status: goalData.sequenceParentId ? 'queued' : (goalData.status || 'active'),
    sequenceParentId: goalData.sequenceParentId || null,
    branchSiblingIds: goalData.branchSiblingIds || [],
    wikiPageId: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  }

  const id = await db.goals.add(goal)
  return id
}

/**
 * Update an existing goal's fields
 *
 * @param {number} goalId
 * @param {Object} changes - partial fields to merge
 * @returns {Promise<void>}
 */
export async function updateGoal(goalId, changes) {
  await db.goals.update(goalId, {
    ...changes,
    updatedAt: new Date().toISOString(),
  })
}

/**
 * Delete a goal and all its progress entries
 * Also clears sequenceParentId references from any child goals
 *
 * @param {number} goalId
 * @returns {Promise<void>}
 */
export async function deleteGoal(goalId) {
  await db.transaction('rw', db.goals, db.goalProgress, async () => {
    // Remove all progress entries for this goal
    await db.goalProgress.where('goalId').equals(goalId).delete()

    // Clear sequenceParentId on any goals that pointed to this one
    // (they become standalone active goals)
    const children = await db.goals.where('sequenceParentId').equals(goalId).toArray()
    for (const child of children) {
      await db.goals.update(child.id, {
        sequenceParentId: null,
        status: 'active',
        updatedAt: new Date().toISOString(),
      })
    }

    // Delete the goal itself
    await db.goals.delete(goalId)
  })
}

/**
 * Record progress toward a goal
 * Creates a goalProgress entry and updates the goal's currentValue
 *
 * @param {Object} params
 * @param {number} params.goalId
 * @param {number} params.amount - how much to add
 * @param {string} params.source - 'timer' | 'manual' | 'schedule-block'
 * @param {string|null} [params.sourceBlockId] - which schedule block triggered this
 * @returns {Promise<Object|null>} completion info if the goal just completed, null otherwise
 */
export async function recordGoalProgress({ goalId, amount, source, sourceBlockId = null }) {
  const today = getTodayString()
  const now = new Date().toISOString()

  // Add the progress entry
  await db.goalProgress.add({
    goalId,
    date: today,
    amount,
    source,
    sourceBlockId,
    createdAt: now,
  })

  // Fetch the goal and update its currentValue
  const goal = await db.goals.get(goalId)
  if (!goal) return null

  const newValue = goal.currentValue + amount
  const updates = {
    currentValue: newValue,
    updatedAt: now,
  }

  // Check if the goal has reached its target
  const justCompleted = goal.status === 'active' && newValue >= goal.targetValue
  if (justCompleted) {
    updates.status = 'complete'
    updates.completedAt = now
  }

  await db.goals.update(goalId, updates)

  if (justCompleted) {
    return { goalId, goal: { ...goal, ...updates } }
  }
  return null
}

/**
 * Complete a milestone goal (binary: done or not)
 *
 * @param {number} goalId
 * @returns {Promise<Object>} the updated goal
 */
export async function completeMilestone(goalId) {
  return recordGoalProgress({
    goalId,
    amount: 1,
    source: 'manual',
  })
}

/**
 * Find all goals that are sequenced after a given goal
 * These are goals whose sequenceParentId === goalId
 *
 * @param {number} goalId - the parent/predecessor goal
 * @returns {Promise<Array>} child goals waiting in queue
 */
export async function getSequenceChildren(goalId) {
  return db.goals.where('sequenceParentId').equals(goalId).toArray()
}

/**
 * Handle post-completion logic for a goal:
 * - If there is exactly one queued child, auto-activate it
 * - If there are multiple children (branching), return them for user choice
 * - If there are no children, nothing to do
 *
 * @param {number} completedGoalId
 * @returns {Promise<{ action: string, children?: Array }>}
 *   action: 'none' | 'auto-activated' | 'branch-choice-needed'
 */
export async function handleGoalCompletion(completedGoalId) {
  const children = await getSequenceChildren(completedGoalId)

  if (children.length === 0) {
    return { action: 'none' }
  }

  if (children.length === 1) {
    // Single successor: auto-activate
    await db.goals.update(children[0].id, {
      status: 'active',
      updatedAt: new Date().toISOString(),
    })
    return { action: 'auto-activated', children }
  }

  // Multiple successors: user must choose which path to take
  // The UI will present these as options in a modal
  return { action: 'branch-choice-needed', children }
}

/**
 * Activate a specific branch child (user chose this path)
 * The unchosen siblings remain queued
 *
 * @param {number} chosenGoalId - the child goal to activate
 * @returns {Promise<void>}
 */
export async function activateBranchChild(chosenGoalId) {
  await db.goals.update(chosenGoalId, {
    status: 'active',
    updatedAt: new Date().toISOString(),
  })
}

/**
 * Get all progress entries for a goal, sorted newest first
 *
 * @param {number} goalId
 * @returns {Promise<Array>}
 */
export async function getGoalProgressEntries(goalId) {
  return db.goalProgress
    .where('goalId')
    .equals(goalId)
    .reverse()
    .sortBy('createdAt')
}

/**
 * Calculate the position of a goal in its sequence chain
 * Returns { position, total } e.g. "Step 2 of 5"
 *
 * Walks up the chain via sequenceParentId to find the root,
 * then walks down to count total length and this goal's position
 *
 * @param {number} goalId
 * @param {Array} allGoals - full goals array (avoids extra DB queries)
 * @returns {{ position: number, total: number } | null}
 */
export function getSequencePosition(goalId, allGoals) {
  const goalMap = new Map(allGoals.map(g => [g.id, g]))
  const goal = goalMap.get(goalId)
  if (!goal) return null

  // Walk up to find the root of the chain
  let root = goal
  const visited = new Set([goal.id])
  while (root.sequenceParentId && goalMap.has(root.sequenceParentId)) {
    // Guard against circular references
    if (visited.has(root.sequenceParentId)) break
    visited.add(root.sequenceParentId)
    root = goalMap.get(root.sequenceParentId)
  }

  // If this goal has no parent and no children, it's not in a sequence
  const hasChildren = allGoals.some(g => g.sequenceParentId === goalId)
  if (!goal.sequenceParentId && !hasChildren) return null

  // Walk down the chain from root, counting position
  // Note: at each step there could be multiple children (branches)
  // We follow the path that leads to our target goal
  let current = root
  let position = 1
  const chain = [root]

  while (current.id !== goalId) {
    const children = allGoals.filter(g => g.sequenceParentId === current.id)
    // Find the child that is either our target or leads to it
    const nextInPath = children.find(c => c.id === goalId || isAncestorOf(c.id, goalId, goalMap, allGoals))
    if (!nextInPath) break
    current = nextInPath
    position++
    chain.push(current)
  }

  // Count total chain length from root (following our specific path and beyond)
  let total = position
  let tail = goalMap.get(goalId)
  while (tail) {
    const children = allGoals.filter(g => g.sequenceParentId === tail.id)
    if (children.length === 0) break
    // Follow the first child for total count (branches create parallel paths)
    tail = children[0]
    total++
  }

  return { position, total }
}

/**
 * Check if a goal is an ancestor of another goal in the sequence chain
 * Helper for getSequencePosition path-finding
 */
function isAncestorOf(potentialAncestorId, targetId, goalMap, allGoals) {
  const children = allGoals.filter(g => g.sequenceParentId === potentialAncestorId)
  for (const child of children) {
    if (child.id === targetId) return true
    if (isAncestorOf(child.id, targetId, goalMap, allGoals)) return true
  }
  return false
}

/**
 * Format a goal's target description for display
 * e.g. "50 hours", "100 reps", "Milestone"
 *
 * @param {Object} goal
 * @returns {string}
 */
export function formatGoalTarget(goal) {
  switch (goal.targetType) {
    case 'hours':
      return `${goal.targetValue} hours`
    case 'count':
      return `${goal.targetValue} total`
    case 'milestone':
      return 'Milestone'
    default:
      return ''
  }
}

/**
 * Calculate progress percentage (0-100) for display
 *
 * @param {Object} goal
 * @returns {number}
 */
export function getProgressPercent(goal) {
  if (goal.targetValue === 0) return 0
  return Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100))
}
