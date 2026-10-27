import { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import GoalCard from './GoalCard.jsx'
import GoalForm from './GoalForm.jsx'
import GoalDetailView from './GoalDetailView.jsx'
import VisionMissionPanel from './VisionMissionPanel.jsx'
import BranchChoiceModal from './BranchChoiceModal.jsx'
import { createGoal, deleteGoal, recordGoalProgress, completeMilestone, handleGoalCompletion, activateBranchChild } from '../../utils/goals.js'

/**
 * GoalsScreen - Main goals board view (Stage 2)
 *
 * Layout:
 * - Vision & Mission panels at top (editable, saved to settings)
 * - "+ New Goal" button to open creation form
 * - Vertical goal list grouped by status: Active, Queued, Complete
 * - Each goal shows a GoalCard with progress bar and sequence tag
 * - Tapping a card opens GoalDetailView
 * - Completing a goal triggers chain/branch logic
 */
export default function GoalsScreen() {
  const { goals, refreshGoals, settings, updateSetting } = useApp()

  // UI state
  const [showForm, setShowForm] = useState(false)
  const [selectedGoalId, setSelectedGoalId] = useState(null)
  const [branchChoiceData, setBranchChoiceData] = useState(null)

  // Group goals by status for the board layout
  const groupedGoals = useMemo(() => {
    const active = goals.filter(g => g.status === 'active')
    const queued = goals.filter(g => g.status === 'queued')
    const complete = goals.filter(g => g.status === 'complete')
    return { active, queued, complete }
  }, [goals])

  /**
   * Handle creating a new goal from the form
   * After creation, refresh the goals list and close the form
   */
  async function handleCreateGoal(goalData) {
    await createGoal(goalData)
    await refreshGoals()
    setShowForm(false)
  }

  /**
   * Handle deleting a goal
   * Clears detail view if the deleted goal was selected
   */
  async function handleDeleteGoal(goalId) {
    if (!window.confirm('Delete this goal and all its progress? This cannot be undone.')) return
    await deleteGoal(goalId)
    if (selectedGoalId === goalId) setSelectedGoalId(null)
    await refreshGoals()
  }

  /**
   * Handle recording progress on a goal
   * After recording, check if the goal just completed and handle chain logic
   */
  async function handleRecordProgress(goalId, amount, source = 'manual') {
    const result = await recordGoalProgress({ goalId, amount, source })
    await refreshGoals()

    // If the goal just completed, handle sequential chain / branching
    if (result) {
      const chainResult = await handleGoalCompletion(goalId)
      if (chainResult.action === 'auto-activated') {
        // Refresh to show the newly activated goal
        await refreshGoals()
      } else if (chainResult.action === 'branch-choice-needed') {
        // Show the branch choice modal
        setBranchChoiceData({
          completedGoalId: goalId,
          children: chainResult.children,
        })
      }
    }
  }

  /**
   * Handle completing a milestone goal (binary toggle)
   */
  async function handleCompleteMilestone(goalId) {
    const result = await completeMilestone(goalId)
    await refreshGoals()

    if (result) {
      const chainResult = await handleGoalCompletion(goalId)
      if (chainResult.action === 'auto-activated') {
        await refreshGoals()
      } else if (chainResult.action === 'branch-choice-needed') {
        setBranchChoiceData({
          completedGoalId: goalId,
          children: chainResult.children,
        })
      }
    }
  }

  /**
   * Handle user choosing a branch path after goal completion
   */
  async function handleBranchChoice(chosenGoalId) {
    await activateBranchChild(chosenGoalId)
    setBranchChoiceData(null)
    await refreshGoals()
  }

  // If a goal is selected, show its detail view
  if (selectedGoalId) {
    const selectedGoal = goals.find(g => g.id === selectedGoalId)
    if (selectedGoal) {
      return (
        <GoalDetailView
          goal={selectedGoal}
          allGoals={goals}
          onBack={() => setSelectedGoalId(null)}
          onRecordProgress={handleRecordProgress}
          onCompleteMilestone={handleCompleteMilestone}
          onDelete={handleDeleteGoal}
          onRefresh={refreshGoals}
        />
      )
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-6">Goals</h1>

      {/* Vision & Mission panels */}
      <VisionMissionPanel
        vision={settings.vision || ''}
        mission={settings.mission || ''}
        onSaveVision={(text) => updateSetting('vision', text)}
        onSaveMission={(text) => updateSetting('mission', text)}
      />

      {/* New Goal button */}
      <button
        onClick={() => setShowForm(true)}
        className="w-full py-3 text-sm font-semibold text-accent border-2 border-dashed border-accent/30
          rounded-xl hover:bg-accent-light/50 transition-colors mb-6"
      >
        + New Goal
      </button>

      {/* Goal creation form (slides open below the button) */}
      {showForm && (
        <GoalForm
          existingGoals={goals}
          onSubmit={handleCreateGoal}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Active goals section */}
      {groupedGoals.active.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
            Active ({groupedGoals.active.length})
          </h2>
          <div className="flex flex-col gap-2">
            {groupedGoals.active.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                allGoals={goals}
                onClick={() => setSelectedGoalId(goal.id)}
                onCompleteMilestone={handleCompleteMilestone}
              />
            ))}
          </div>
        </section>
      )}

      {/* Queued goals section */}
      {groupedGoals.queued.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
            Queued ({groupedGoals.queued.length})
          </h2>
          <div className="flex flex-col gap-2">
            {groupedGoals.queued.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                allGoals={goals}
                onClick={() => setSelectedGoalId(goal.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Completed goals section */}
      {groupedGoals.complete.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
            Complete ({groupedGoals.complete.length})
          </h2>
          <div className="flex flex-col gap-2">
            {groupedGoals.complete.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                allGoals={goals}
                onClick={() => setSelectedGoalId(goal.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty state when no goals exist */}
      {goals.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-bg-secondary flex items-center justify-center mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" />
            </svg>
          </div>
          <p className="text-sm text-text-muted mb-1">No goals yet.</p>
          <p className="text-xs text-text-muted">Tap "+ New Goal" to create your first one.</p>
        </div>
      )}

      {/* Branch choice modal -- shown when a completed goal has multiple successors */}
      {branchChoiceData && (
        <BranchChoiceModal
          children={branchChoiceData.children}
          onChoose={handleBranchChoice}
          onDismiss={() => setBranchChoiceData(null)}
        />
      )}
    </div>
  )
}
