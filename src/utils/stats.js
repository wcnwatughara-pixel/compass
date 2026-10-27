import db from '../db/db.js'
import { formatDate } from './date.js'

/**
 * Stats utility functions for the completion rate dashboard
 * and historical statistics views (Stage 3).
 *
 * Provides aggregated data for:
 * - Daily completion rates (schedule blocks completed vs total)
 * - Weekly completion rates
 * - Hours logged per week (from timer + manual entries)
 * - Goals completed per month
 */

/**
 * Get daily completion rates for the last N days
 *
 * A "completed" entry is one where the block was marked done in the schedule.
 * Rate = (completed blocks) / (total blocks in schedule) * 100
 *
 * @param {number} days - how many days to look back (default 30)
 * @returns {Promise<Array<{ date: string, rate: number, completed: number, total: number }>>}
 */
export async function getDailyCompletionRates(days = 30) {
  const results = []
  const today = new Date()

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = formatDate(d)

    // Find the schedule for this day
    const schedule = await db.dailySchedules
      .where('date')
      .equals(dateStr)
      .first()

    if (schedule && schedule.blocks?.length > 0) {
      const totalBlocks = schedule.blocks.length
      // Count blocks that have been marked as completed
      const completedBlocks = schedule.blocks.filter(b => b.completed).length
      const rate = Math.round((completedBlocks / totalBlocks) * 100)

      results.push({
        date: dateStr,
        rate,
        completed: completedBlocks,
        total: totalBlocks,
      })
    } else {
      // No schedule for this day, skip it (don't show 0% for days off)
      results.push({
        date: dateStr,
        rate: null,
        completed: 0,
        total: 0,
      })
    }
  }

  return results
}

/**
 * Get weekly completion rates for the last N weeks
 * Aggregates daily rates into weekly averages
 *
 * @param {number} weeks - how many weeks to look back (default 12)
 * @returns {Promise<Array<{ weekStart: string, weekEnd: string, rate: number }>>}
 */
export async function getWeeklyCompletionRates(weeks = 12) {
  // Get enough daily data to cover the requested weeks
  const dailyRates = await getDailyCompletionRates(weeks * 7)

  const results = []
  // Group by weeks (Sunday to Saturday)
  for (let w = 0; w < weeks; w++) {
    const startIdx = w * 7
    const weekSlice = dailyRates.slice(startIdx, startIdx + 7)

    // Only include days that had schedules (non-null rates)
    const validDays = weekSlice.filter(d => d.rate !== null)

    if (validDays.length > 0) {
      const avgRate = Math.round(
        validDays.reduce((sum, d) => sum + d.rate, 0) / validDays.length
      )
      results.push({
        weekStart: weekSlice[0]?.date || '',
        weekEnd: weekSlice[weekSlice.length - 1]?.date || '',
        rate: avgRate,
        daysTracked: validDays.length,
      })
    } else {
      results.push({
        weekStart: weekSlice[0]?.date || '',
        weekEnd: weekSlice[weekSlice.length - 1]?.date || '',
        rate: null,
        daysTracked: 0,
      })
    }
  }

  return results
}

/**
 * Get hours logged per week for the last N weeks
 * Sums minutes from all entries (timer + manual) and converts to hours
 *
 * @param {number} weeks - how many weeks to look back (default 12)
 * @returns {Promise<Array<{ weekStart: string, hours: number }>>}
 */
export async function getHoursPerWeek(weeks = 12) {
  const results = []
  const today = new Date()

  for (let w = weeks - 1; w >= 0; w--) {
    // Calculate the start and end dates for this week
    const weekEnd = new Date(today)
    weekEnd.setDate(weekEnd.getDate() - (w * 7))
    const weekStart = new Date(weekEnd)
    weekStart.setDate(weekStart.getDate() - 6)

    const startStr = formatDate(weekStart)
    const endStr = formatDate(weekEnd)

    // Query all entries within this date range
    const entries = await db.entries
      .where('date')
      .between(startStr, endStr, true, true)
      .toArray()

    // Sum up minutes and convert to hours (rounded to 1 decimal)
    const totalMinutes = entries.reduce((sum, e) => sum + (e.minutes || 0), 0)
    const hours = Math.round(totalMinutes / 6) / 10 // round to 1 decimal place

    results.push({
      weekStart: startStr,
      weekEnd: endStr,
      hours,
    })
  }

  return results
}

/**
 * Get goals completed per month for the last N months
 *
 * @param {number} months - how many months to look back (default 6)
 * @returns {Promise<Array<{ month: string, count: number, goals: Array }>>}
 */
export async function getGoalsCompletedPerMonth(months = 6) {
  // Get all completed goals
  const completedGoals = await db.goals
    .where('status')
    .equals('complete')
    .toArray()

  const results = []
  const today = new Date()

  for (let m = months - 1; m >= 0; m--) {
    const d = new Date(today.getFullYear(), today.getMonth() - m, 1)
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const monthLabel = d.toLocaleString('default', { month: 'short', year: 'numeric' })

    // Filter goals completed in this month
    const monthGoals = completedGoals.filter(g => {
      if (!g.completedAt) return false
      const completedDate = new Date(g.completedAt)
      return (
        completedDate.getFullYear() === d.getFullYear() &&
        completedDate.getMonth() === d.getMonth()
      )
    })

    results.push({
      month: monthStr,
      monthLabel,
      count: monthGoals.length,
      goals: monthGoals.map(g => g.name),
    })
  }

  return results
}

// =============================================================================
// Stage 4: Schedule Analytics -- patterns over weeks and months
// =============================================================================

/**
 * Get block-level completion rates across all schedule history
 * Shows which blocks (by name) are most/least consistently completed
 *
 * Groups all schedule blocks by name, calculates completion rate for each
 * Returns sorted by completion rate (highest first)
 *
 * @param {number} days - how many days of history to analyze (default 90)
 * @returns {Promise<Array<{ name: string, completed: number, total: number, rate: number }>>}
 */
export async function getBlockCompletionRates(days = 90) {
  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - days)
  const startStr = formatDate(startDate)

  // Fetch all schedules within the date range
  const schedules = await db.dailySchedules
    .where('date')
    .aboveOrEqual(startStr)
    .toArray()

  // Aggregate completion counts by block name
  const blockStats = {}
  for (const schedule of schedules) {
    if (!schedule.blocks) continue
    for (const block of schedule.blocks) {
      const name = block.name || 'Unnamed'
      if (!blockStats[name]) {
        blockStats[name] = { name, completed: 0, total: 0 }
      }
      blockStats[name].total++
      if (block.completed) blockStats[name].completed++
    }
  }

  // Convert to array, compute rates, sort by rate descending
  return Object.values(blockStats)
    .map(b => ({
      ...b,
      rate: b.total > 0 ? Math.round((b.completed / b.total) * 100) : 0,
    }))
    .sort((a, b) => b.rate - a.rate)
}

/**
 * Get day-of-week completion patterns
 * Shows which days of the week the user is most productive
 *
 * @param {number} weeks - how many weeks of history to analyze (default 12)
 * @returns {Promise<Array<{ day: string, dayIndex: number, rate: number, daysTracked: number }>>}
 */
export async function getDayOfWeekPatterns(weeks = 12) {
  const dailyRates = await getDailyCompletionRates(weeks * 7)

  // Group rates by day of week (0 = Sunday ... 6 = Saturday)
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayBuckets = dayNames.map((name, idx) => ({
    day: name,
    dayIndex: idx,
    rates: [],
  }))

  for (const entry of dailyRates) {
    if (entry.rate === null) continue
    // Parse date to get day of week
    const [year, month, day] = entry.date.split('-').map(Number)
    const d = new Date(year, month - 1, day)
    const dow = d.getDay()
    dayBuckets[dow].rates.push(entry.rate)
  }

  // Average the rates for each day of week
  return dayBuckets.map(bucket => ({
    day: bucket.day,
    dayIndex: bucket.dayIndex,
    rate: bucket.rates.length > 0
      ? Math.round(bucket.rates.reduce((a, b) => a + b, 0) / bucket.rates.length)
      : null,
    daysTracked: bucket.rates.length,
  }))
}

/**
 * Get monthly trend data for completion rates
 * Provides a higher-level view than weekly, showing month-over-month change
 *
 * @param {number} months - how many months to look back (default 6)
 * @returns {Promise<Array<{ month: string, label: string, rate: number, totalBlocks: number, completedBlocks: number }>>}
 */
export async function getMonthlyCompletionTrend(months = 6) {
  const results = []
  const today = new Date()

  for (let m = months - 1; m >= 0; m--) {
    const d = new Date(today.getFullYear(), today.getMonth() - m, 1)
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0) // last day of month
    const startStr = formatDate(d)
    const endStr = formatDate(monthEnd)

    // Fetch schedules for this month
    const schedules = await db.dailySchedules
      .where('date')
      .between(startStr, endStr, true, true)
      .toArray()

    let totalBlocks = 0
    let completedBlocks = 0

    for (const schedule of schedules) {
      if (!schedule.blocks) continue
      totalBlocks += schedule.blocks.length
      completedBlocks += schedule.blocks.filter(b => b.completed).length
    }

    const label = d.toLocaleString('default', { month: 'short', year: 'numeric' })

    results.push({
      month: startStr.slice(0, 7), // YYYY-MM
      label,
      rate: totalBlocks > 0 ? Math.round((completedBlocks / totalBlocks) * 100) : null,
      totalBlocks,
      completedBlocks,
    })
  }

  return results
}

/**
 * Get summary statistics for the dashboard header
 *
 * @returns {Promise<Object>} { totalGoals, completedGoals, activeGoals,
 *   totalHoursLogged, totalWikiPages, streakDays }
 */
export async function getDashboardSummary() {
  const [goals, entries, wikiPages] = await Promise.all([
    db.goals.toArray(),
    db.entries.toArray(),
    db.wikiPages.count(),
  ])

  const totalGoals = goals.length
  const completedGoals = goals.filter(g => g.status === 'complete').length
  const activeGoals = goals.filter(g => g.status === 'active').length

  // Total hours logged (all time)
  const totalMinutes = entries.reduce((sum, e) => sum + (e.minutes || 0), 0)
  const totalHoursLogged = Math.round(totalMinutes / 6) / 10

  // Calculate streak: consecutive days with at least one entry, going back from today
  let streakDays = 0
  const entryDates = new Set(entries.map(e => e.date))
  const checkDate = new Date()
  while (entryDates.has(formatDate(checkDate))) {
    streakDays++
    checkDate.setDate(checkDate.getDate() - 1)
  }

  return {
    totalGoals,
    completedGoals,
    activeGoals,
    totalHoursLogged,
    totalWikiPages: wikiPages,
    streakDays,
  }
}
