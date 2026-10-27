import { useState, useEffect, useRef, useCallback } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { formatTimerDisplay } from '../../utils/date.js'
import db from '../../db/db.js'
import { getTodayString } from '../../utils/date.js'
import { recordGoalProgress } from '../../utils/goals.js'

/**
 * TimerScreen - Stopwatch-style timer with Web Worker backend
 *
 * Features:
 * - Start / Stop / Reset controls
 * - Large JetBrains Mono time display (HH:MM:SS)
 * - Web Worker keeps ticking even when tab is backgrounded
 * - Manual hour logging as an alternative to the timer
 * - Logs entries to IndexedDB for time tracking
 * - Optional block/goal association (dropdowns)
 * - Stage 2: goal association dropdown for tracking progress toward goals
 */
export default function TimerScreen() {
  const { timerState, updateTimer, todaySchedule, goals, refreshGoals } = useApp()
  const workerRef = useRef(null)

  // Manual logging state
  const [manualMinutes, setManualMinutes] = useState('')
  const [manualNote, setManualNote] = useState('')
  const [selectedBlockId, setSelectedBlockId] = useState('')
  const [selectedGoalId, setSelectedGoalId] = useState('')

  // Only show active goals with hours target type in the timer dropdown
  // (count and milestone goals don't track time)
  const activeHoursGoals = goals.filter(g => g.status === 'active' && g.targetType === 'hours')

  // Initialize the Web Worker on mount
  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../../workers/timerWorker.js', import.meta.url),
      { type: 'module' }
    )

    // Listen for tick messages from the worker
    workerRef.current.onmessage = (event) => {
      if (event.data.type === 'tick') {
        updateTimer({ seconds: event.data.seconds })
      }
    }

    // Cleanup: terminate worker when component unmounts
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate()
      }
    }
  }, [updateTimer])

  /**
   * Start the timer
   * Sends current seconds to the worker so it can resume from where it left off
   */
  const handleStart = useCallback(() => {
    updateTimer({ isRunning: true })
    workerRef.current?.postMessage({
      command: 'start',
      initialSeconds: timerState.seconds,
    })
  }, [timerState.seconds, updateTimer])

  /**
   * Pause the timer
   */
  const handleStop = useCallback(() => {
    updateTimer({ isRunning: false })
    workerRef.current?.postMessage({ command: 'stop' })
  }, [updateTimer])

  /**
   * Reset the timer to zero
   * If there was time accumulated, log it as an entry first
   * Stage 2: also records progress toward the associated goal (hours converted)
   */
  const handleReset = useCallback(async () => {
    // If timer had time on it, save it as an entry
    if (timerState.seconds > 0) {
      const minutes = Math.round(timerState.seconds / 60)
      if (minutes > 0) {
        const goalId = timerState.goalId || null

        await db.entries.add({
          date: getTodayString(),
          type: 'timer',
          minutes,
          blockId: timerState.blockId || null,
          goalId,
          note: `Timer session: ${formatTimerDisplay(timerState.seconds)}`,
          createdAt: new Date().toISOString(),
        })

        // If a goal was associated, record progress in hours (minutes / 60)
        if (goalId) {
          const hours = parseFloat((minutes / 60).toFixed(2))
          await recordGoalProgress({
            goalId,
            amount: hours,
            source: 'timer',
          })
          await refreshGoals()
        }
      }
    }

    updateTimer({ isRunning: false, seconds: 0 })
    workerRef.current?.postMessage({ command: 'reset' })
  }, [timerState, updateTimer, refreshGoals])

  /**
   * Log manual hours/minutes
   * Stage 2: also records goal progress if a goal is selected
   */
  async function handleManualLog(e) {
    e.preventDefault()
    const minutes = Number(manualMinutes)
    if (!minutes || minutes <= 0) return

    const goalId = selectedGoalId ? Number(selectedGoalId) : null

    await db.entries.add({
      date: getTodayString(),
      type: 'manual',
      minutes,
      blockId: selectedBlockId || null,
      goalId,
      note: manualNote.trim() || `Manual log: ${minutes} minutes`,
      createdAt: new Date().toISOString(),
    })

    // If a goal was selected, record progress in hours (minutes / 60)
    if (goalId) {
      const hours = parseFloat((minutes / 60).toFixed(2))
      await recordGoalProgress({
        goalId,
        amount: hours,
        source: 'manual',
      })
      await refreshGoals()
    }

    setManualMinutes('')
    setManualNote('')
    setSelectedBlockId('')
    setSelectedGoalId('')
  }

  // Get available blocks from today's schedule for the dropdown
  const availableBlocks = todaySchedule?.blocks || []

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-6">Timer</h1>

      {/* Timer display - large monospace digits */}
      <div className="flex flex-col items-center py-8">
        <div
          className="font-mono text-[64px] md:text-[80px] font-bold text-text-primary leading-none tracking-tight select-none"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {formatTimerDisplay(timerState.seconds)}
        </div>

        {/* Timer controls */}
        <div className="flex items-center gap-3 mt-8">
          {!timerState.isRunning ? (
            <button
              onClick={handleStart}
              className="px-8 py-3 text-base font-semibold bg-accent text-white rounded-full
                hover:bg-blue-700 transition-colors active:scale-95"
            >
              {timerState.seconds > 0 ? 'Resume' : 'Start'}
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="px-8 py-3 text-base font-semibold bg-bg-tertiary text-text-primary rounded-full
                hover:bg-border transition-colors active:scale-95"
            >
              Pause
            </button>
          )}

          {timerState.seconds > 0 && (
            <button
              onClick={handleReset}
              className="px-6 py-3 text-base font-medium text-text-secondary border border-border
                rounded-full hover:bg-bg-secondary transition-colors active:scale-95"
            >
              Reset & Log
            </button>
          )}
        </div>

        {/* Running indicator text */}
        {timerState.isRunning && (
          <p className="text-sm text-accent mt-4 animate-pulse">Timer running...</p>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-border my-6" />

      {/* Manual hour logging */}
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-3">Log Time Manually</h2>
        <form onSubmit={handleManualLog} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1">Minutes</label>
              <input
                type="number"
                value={manualMinutes}
                onChange={(e) => setManualMinutes(e.target.value)}
                placeholder="e.g. 45"
                min="1"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-bg-primary
                  text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1">
                Block <span className="text-text-muted">(optional)</span>
              </label>
              <select
                value={selectedBlockId}
                onChange={(e) => setSelectedBlockId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-bg-primary
                  text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="">None</option>
                {availableBlocks.map((block) => (
                  <option key={block.blockId} value={block.blockId}>
                    {block.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Goal association dropdown (Stage 2) */}
          {activeHoursGoals.length > 0 && (
            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1">
                Goal <span className="text-text-muted">(optional)</span>
              </label>
              <select
                value={selectedGoalId}
                onChange={(e) => setSelectedGoalId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-bg-primary
                  text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="">None</option>
                {activeHoursGoals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.name} ({goal.currentValue}/{goal.targetValue}h)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1">
              Note <span className="text-text-muted">(optional)</span>
            </label>
            <input
              type="text"
              value={manualNote}
              onChange={(e) => setManualNote(e.target.value)}
              placeholder="What did you work on?"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-bg-primary
                text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 text-sm font-medium bg-accent text-white rounded-lg
              hover:bg-blue-700 transition-colors"
          >
            Log Time
          </button>
        </form>
      </div>
    </div>
  )
}
