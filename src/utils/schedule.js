import db from '../db/db.js'
import { getTodayString } from './date.js'

/**
 * Schedule generation utilities
 * Handles creating daily schedule instances from templates
 */

/**
 * Generate a daily schedule from a template for a given date
 * Each block from the template becomes a DayBlock with tracking fields
 *
 * @param {Object} template - The schedule template to use
 * @param {string} date - YYYY-MM-DD date string
 * @returns {number} The ID of the created daily schedule
 */
export async function generateDailySchedule(template, date) {
  // Check if a schedule already exists for this date
  const existing = await db.dailySchedules
    .where('date')
    .equals(date)
    .first()

  if (existing) {
    return existing.id
  }

  // Create DayBlocks from template blocks
  // Each DayBlock starts as 'pending' with 0 actual minutes
  const dayBlocks = template.blocks.map((block) => ({
    blockId: block.id,
    name: block.name,
    startTime: block.startTime,
    durationMinutes: block.durationMinutes,
    category: block.category,
    linkedGoalId: block.linkedGoalId,
    status: 'pending',       // pending | in-progress | complete | skipped | partial
    actualMinutes: 0,        // tracked time spent on this block
    notes: '',               // optional notes for the day's instance
  }))

  const id = await db.dailySchedules.add({
    date,
    templateId: template.id,
    blocks: dayBlocks,
    createdAt: new Date().toISOString(),
  })

  return id
}

/**
 * Get or create today's schedule
 * Uses the active template from settings
 *
 * @returns {Object|null} The daily schedule, or null if no template is set
 */
export async function getOrCreateTodaySchedule() {
  const today = getTodayString()

  // Check for existing schedule first
  const existing = await db.dailySchedules
    .where('date')
    .equals(today)
    .first()

  if (existing) return existing

  // Look up active template from settings
  const activeTemplateSetting = await db.settings.get('activeTemplateId')
  if (!activeTemplateSetting?.value) return null

  const template = await db.scheduleTemplates.get(
    Number(activeTemplateSetting.value)
  )
  if (!template) return null

  // Generate today's schedule from the active template
  const id = await generateDailySchedule(template, today)
  return db.dailySchedules.get(id)
}

/**
 * Update a specific block's status within a daily schedule
 *
 * @param {number} scheduleId - The daily schedule ID
 * @param {string} blockId - The block ID within the schedule
 * @param {Object} updates - Fields to update (status, actualMinutes, notes)
 */
export async function updateBlockStatus(scheduleId, blockId, updates) {
  const schedule = await db.dailySchedules.get(scheduleId)
  if (!schedule) return

  const updatedBlocks = schedule.blocks.map((block) => {
    if (block.blockId === blockId) {
      return { ...block, ...updates }
    }
    return block
  })

  await db.dailySchedules.update(scheduleId, { blocks: updatedBlocks })
}

/**
 * Calculate daily stats from a schedule's blocks
 *
 * @param {Array} blocks - Array of DayBlock objects
 * @returns {Object} Stats: completed, total, totalMinutes, actualMinutes
 */
export function calculateDayStats(blocks) {
  if (!blocks || blocks.length === 0) {
    return { completed: 0, total: 0, totalMinutes: 0, actualMinutes: 0 }
  }

  const completed = blocks.filter((b) => b.status === 'complete').length
  const total = blocks.length
  const totalMinutes = blocks.reduce((sum, b) => sum + b.durationMinutes, 0)
  const actualMinutes = blocks.reduce((sum, b) => sum + (b.actualMinutes || 0), 0)

  return { completed, total, totalMinutes, actualMinutes }
}
