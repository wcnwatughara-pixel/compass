import { useState, useEffect } from 'react'
import {
  getDailyCompletionRates,
  getWeeklyCompletionRates,
  getHoursPerWeek,
  getGoalsCompletedPerMonth,
  getDashboardSummary,
  getBlockCompletionRates,
  getDayOfWeekPatterns,
  getMonthlyCompletionTrend,
} from '../../utils/stats.js'

/**
 * StatsScreen - Completion rate dashboard and historical statistics
 *
 * Sections:
 * 1. Summary cards (total goals, completed, hours logged, streak, wiki pages)
 * 2. Daily completion rate chart (last 30 days, horizontal bar chart)
 * 3. Weekly completion rate chart (last 12 weeks)
 * 4. Hours logged per week (last 12 weeks)
 * 5. Goals completed per month (last 6 months)
 * 6. Schedule Analytics (Stage 4):
 *    - Block completion rates (which blocks are most/least completed)
 *    - Day-of-week patterns (which weekdays are most productive)
 *    - Monthly completion trend (month-over-month direction)
 */
export default function StatsScreen() {
  const [summary, setSummary] = useState(null)
  const [dailyRates, setDailyRates] = useState([])
  const [weeklyRates, setWeeklyRates] = useState([])
  const [hoursPerWeek, setHoursPerWeek] = useState([])
  const [goalsPerMonth, setGoalsPerMonth] = useState([])
  // Stage 4 analytics state
  const [blockRates, setBlockRates] = useState([])
  const [dayOfWeekPatterns, setDayOfWeekPatterns] = useState([])
  const [monthlyTrend, setMonthlyTrend] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // Load all stats data on mount (including Stage 4 analytics)
  useEffect(() => {
    async function loadStats() {
      try {
        const [sum, daily, weekly, hours, goalsMonthly, blocks, dowPatterns, monthly] = await Promise.all([
          getDashboardSummary(),
          getDailyCompletionRates(30),
          getWeeklyCompletionRates(12),
          getHoursPerWeek(12),
          getGoalsCompletedPerMonth(6),
          getBlockCompletionRates(90),
          getDayOfWeekPatterns(12),
          getMonthlyCompletionTrend(6),
        ])
        setSummary(sum)
        setDailyRates(daily)
        setWeeklyRates(weekly)
        setHoursPerWeek(hours)
        setGoalsPerMonth(goalsMonthly)
        setBlockRates(blocks)
        setDayOfWeekPatterns(dowPatterns)
        setMonthlyTrend(monthly)
      } catch (err) {
        console.error('Failed to load stats:', err)
      } finally {
        setIsLoading(false)
      }
    }
    loadStats()
  }, [])

  if (isLoading) {
    return (
      <div className="text-center text-text-muted py-12">Loading statistics...</div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-6">Statistics</h1>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          <SummaryCard label="Active Goals" value={summary.activeGoals} />
          <SummaryCard label="Completed" value={summary.completedGoals} />
          <SummaryCard label="Hours Logged" value={`${summary.totalHoursLogged}h`} />
          <SummaryCard label="Day Streak" value={summary.streakDays} />
          <SummaryCard label="Wiki Pages" value={summary.totalWikiPages} />
          <SummaryCard label="Total Goals" value={summary.totalGoals} />
        </div>
      )}

      {/* Daily completion rates (last 30 days) */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-text-primary mb-3">
          Daily Completion Rate (Last 30 Days)
        </h2>
        <div className="border border-border rounded-lg p-4 overflow-x-auto">
          <div className="flex flex-col gap-1 min-w-[300px]">
            {dailyRates.filter(d => d.rate !== null).length === 0 ? (
              <p className="text-sm text-text-muted text-center py-4">
                No schedule data yet. Complete schedule blocks to see your rates.
              </p>
            ) : (
              dailyRates
                .filter(d => d.rate !== null)
                .slice(-14) // Show last 14 days with data for readability
                .map((day) => (
                  <div key={day.date} className="flex items-center gap-2">
                    <span className="text-[11px] text-text-muted w-16 flex-shrink-0 text-right">
                      {formatShortDate(day.date)}
                    </span>
                    <div className="flex-1 h-5 bg-bg-secondary rounded overflow-hidden">
                      <div
                        className="h-full rounded transition-all duration-300"
                        style={{
                          width: `${day.rate}%`,
                          backgroundColor: getRateColor(day.rate),
                        }}
                      />
                    </div>
                    <span className="text-xs text-text-secondary w-12 text-right">
                      {day.rate}%
                    </span>
                  </div>
                ))
            )}
          </div>
        </div>
      </section>

      {/* Weekly completion rates */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-text-primary mb-3">
          Weekly Completion Rate (Last 12 Weeks)
        </h2>
        <div className="border border-border rounded-lg p-4 overflow-x-auto">
          <div className="flex items-end gap-2 h-40 min-w-[300px]">
            {weeklyRates.filter(w => w.rate !== null).length === 0 ? (
              <p className="text-sm text-text-muted text-center py-4 w-full">
                No weekly data yet.
              </p>
            ) : (
              weeklyRates.map((week, i) => (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center justify-end"
                >
                  {week.rate !== null && (
                    <>
                      <span className="text-[10px] text-text-muted mb-1">
                        {week.rate}%
                      </span>
                      <div
                        className="w-full rounded-t transition-all duration-300"
                        style={{
                          height: `${Math.max(week.rate * 1.2, 4)}px`,
                          backgroundColor: getRateColor(week.rate),
                        }}
                      />
                    </>
                  )}
                  <span className="text-[9px] text-text-muted mt-1 truncate w-full text-center">
                    {formatShortDate(week.weekStart)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Hours logged per week */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-text-primary mb-3">
          Hours Logged Per Week (Last 12 Weeks)
        </h2>
        <div className="border border-border rounded-lg p-4 overflow-x-auto">
          <div className="flex items-end gap-2 h-40 min-w-[300px]">
            {hoursPerWeek.every(w => w.hours === 0) ? (
              <p className="text-sm text-text-muted text-center py-4 w-full">
                No time logged yet.
              </p>
            ) : (
              (() => {
                const maxHours = Math.max(...hoursPerWeek.map(w => w.hours), 1)
                return hoursPerWeek.map((week, i) => (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center justify-end"
                  >
                    {week.hours > 0 && (
                      <>
                        <span className="text-[10px] text-text-muted mb-1">
                          {week.hours}h
                        </span>
                        <div
                          className="w-full bg-accent rounded-t transition-all duration-300"
                          style={{
                            height: `${Math.max((week.hours / maxHours) * 120, 4)}px`,
                          }}
                        />
                      </>
                    )}
                    <span className="text-[9px] text-text-muted mt-1 truncate w-full text-center">
                      {formatShortDate(week.weekStart)}
                    </span>
                  </div>
                ))
              })()
            )}
          </div>
        </div>
      </section>

      {/* Goals completed per month */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-text-primary mb-3">
          Goals Completed Per Month (Last 6 Months)
        </h2>
        <div className="border border-border rounded-lg p-4">
          {goalsPerMonth.every(m => m.count === 0) ? (
            <p className="text-sm text-text-muted text-center py-4">
              No goals completed yet.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {goalsPerMonth.map((month) => (
                <div key={month.month} className="flex items-center gap-3">
                  <span className="text-sm text-text-secondary w-20 flex-shrink-0">
                    {month.monthLabel}
                  </span>
                  <div className="flex-1 flex items-center gap-2">
                    {/* Dot indicators for each completed goal */}
                    {Array.from({ length: month.count }).map((_, i) => (
                      <div
                        key={i}
                        className="w-4 h-4 bg-success rounded-full flex-shrink-0"
                        title={month.goals[i] || ''}
                      />
                    ))}
                    {month.count === 0 && (
                      <span className="text-xs text-text-muted">None</span>
                    )}
                  </div>
                  <span className="text-sm font-medium text-text-primary w-6 text-right">
                    {month.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ================================================================= */}
      {/* Stage 4: Schedule Analytics                                       */}
      {/* ================================================================= */}

      <h2 className="text-lg font-bold text-text-primary mb-4 mt-10">Schedule Analytics</h2>

      {/* Block completion rates -- which schedule blocks are most/least completed */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-text-primary mb-3">
          Block Completion Rates (Last 90 Days)
        </h2>
        <div className="border border-border rounded-lg p-4">
          {blockRates.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-4">
              No schedule data yet. Complete schedule blocks to see patterns.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {blockRates.map((block) => (
                <div key={block.name} className="flex items-center gap-2">
                  <span className="text-xs text-text-secondary w-28 flex-shrink-0 truncate" title={block.name}>
                    {block.name}
                  </span>
                  <div className="flex-1 h-5 bg-bg-secondary rounded overflow-hidden">
                    <div
                      className="h-full rounded transition-all duration-300"
                      style={{
                        width: `${block.rate}%`,
                        backgroundColor: getRateColor(block.rate),
                      }}
                    />
                  </div>
                  <span className="text-xs text-text-secondary w-20 text-right flex-shrink-0">
                    {block.rate}% ({block.completed}/{block.total})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Day-of-week patterns -- which weekdays are most productive */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-text-primary mb-3">
          Day-of-Week Patterns (Last 12 Weeks)
        </h2>
        <div className="border border-border rounded-lg p-4">
          {dayOfWeekPatterns.every(d => d.rate === null) ? (
            <p className="text-sm text-text-muted text-center py-4">
              Not enough data yet.
            </p>
          ) : (
            <div className="flex items-end gap-2 h-40">
              {dayOfWeekPatterns.map((dow) => (
                <div
                  key={dow.dayIndex}
                  className="flex-1 flex flex-col items-center justify-end"
                >
                  {dow.rate !== null && (
                    <>
                      <span className="text-[10px] text-text-muted mb-1">
                        {dow.rate}%
                      </span>
                      <div
                        className="w-full rounded-t transition-all duration-300"
                        style={{
                          height: `${Math.max(dow.rate * 1.2, 4)}px`,
                          backgroundColor: getRateColor(dow.rate),
                        }}
                      />
                    </>
                  )}
                  <span className="text-[10px] text-text-muted mt-1">
                    {dow.day.slice(0, 3)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Monthly completion trend -- month-over-month direction */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-text-primary mb-3">
          Monthly Completion Trend (Last 6 Months)
        </h2>
        <div className="border border-border rounded-lg p-4">
          {monthlyTrend.every(m => m.rate === null) ? (
            <p className="text-sm text-text-muted text-center py-4">
              Not enough data yet.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {monthlyTrend.map((month, i) => {
                // Calculate trend arrow compared to previous month
                const prev = i > 0 ? monthlyTrend[i - 1] : null
                const trend = prev?.rate !== null && month.rate !== null
                  ? month.rate - prev.rate
                  : null

                return (
                  <div key={month.month} className="flex items-center gap-2">
                    <span className="text-sm text-text-secondary w-20 flex-shrink-0">
                      {month.label}
                    </span>
                    <div className="flex-1 h-5 bg-bg-secondary rounded overflow-hidden">
                      {month.rate !== null && (
                        <div
                          className="h-full rounded transition-all duration-300"
                          style={{
                            width: `${month.rate}%`,
                            backgroundColor: getRateColor(month.rate),
                          }}
                        />
                      )}
                    </div>
                    <span className="text-xs text-text-secondary w-10 text-right">
                      {month.rate !== null ? `${month.rate}%` : '-'}
                    </span>
                    {/* Trend indicator: up/down/flat compared to previous month */}
                    <span className="w-6 text-center text-sm">
                      {trend !== null && trend > 0 && <span className="text-green-600">&#9650;</span>}
                      {trend !== null && trend < 0 && <span className="text-danger">&#9660;</span>}
                      {trend !== null && trend === 0 && <span className="text-text-muted">&#8212;</span>}
                      {trend === null && ''}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

/**
 * Summary card with a label and prominent value
 */
function SummaryCard({ label, value }) {
  return (
    <div className="border border-border rounded-lg p-3 text-center">
      <div className="text-2xl font-bold text-text-primary">{value}</div>
      <div className="text-xs text-text-muted mt-1">{label}</div>
    </div>
  )
}

/**
 * Format a YYYY-MM-DD date to a short display format (M/D)
 */
function formatShortDate(dateStr) {
  if (!dateStr) return ''
  const [, month, day] = dateStr.split('-')
  return `${parseInt(month)}/${parseInt(day)}`
}

/**
 * Get a color based on completion rate
 * Red (<40%) -> Yellow (40-70%) -> Green (>70%)
 */
function getRateColor(rate) {
  if (rate >= 70) return '#16A34A' // success green
  if (rate >= 40) return '#F59E0B' // warning yellow
  return '#DC2626' // danger red
}
