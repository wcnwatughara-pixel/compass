import { useState } from 'react'

/**
 * GoalForm - Creation form for new goals
 *
 * Fields:
 * - Name (required text input)
 * - Target type selector: hours / count / milestone
 * - Target value (number input, hidden for milestone type)
 * - Sequence parent (optional dropdown of existing active/queued goals)
 *
 * When a sequence parent is selected, the new goal starts as 'queued'
 * and auto-activates when the parent completes.
 */
export default function GoalForm({ existingGoals, onSubmit, onCancel }) {
  const [name, setName] = useState('')
  const [targetType, setTargetType] = useState('hours')
  const [targetValue, setTargetValue] = useState('')
  const [sequenceParentId, setSequenceParentId] = useState('')

  // Only active and queued goals can be sequence parents
  // (complete goals already finished their chain)
  const parentCandidates = existingGoals.filter(
    g => g.status === 'active' || g.status === 'queued'
  )

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    // For hours/count types, a target value is required
    if (targetType !== 'milestone' && (!targetValue || Number(targetValue) <= 0)) return

    onSubmit({
      name: name.trim(),
      targetType,
      targetValue: targetType === 'milestone' ? 1 : Number(targetValue),
      sequenceParentId: sequenceParentId ? Number(sequenceParentId) : null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-bg-secondary rounded-xl p-4 mb-6 border border-border">
      <h3 className="text-sm font-semibold text-text-primary mb-3">New Goal</h3>

      {/* Goal name */}
      <div className="mb-3">
        <label className="text-xs font-medium text-text-secondary block mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Read 20 books this year"
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-bg-primary
            text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          autoFocus
        />
      </div>

      {/* Target type selector */}
      <div className="mb-3">
        <label className="text-xs font-medium text-text-secondary block mb-1">Target Type</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'hours', label: 'Hours', desc: 'Track time' },
            { value: 'count', label: 'Count', desc: 'Track quantity' },
            { value: 'milestone', label: 'Milestone', desc: 'Done / not done' },
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTargetType(opt.value)}
              className={`py-2 px-3 text-xs font-medium rounded-lg border transition-colors ${
                targetType === opt.value
                  ? 'border-accent bg-accent-light text-accent'
                  : 'border-border bg-bg-primary text-text-secondary hover:border-accent/40'
              }`}
            >
              <div>{opt.label}</div>
              <div className="text-[10px] mt-0.5 opacity-70">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Target value -- hidden for milestones */}
      {targetType !== 'milestone' && (
        <div className="mb-3">
          <label className="text-xs font-medium text-text-secondary block mb-1">
            Target {targetType === 'hours' ? '(hours)' : '(count)'}
          </label>
          <input
            type="number"
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            placeholder={targetType === 'hours' ? 'e.g. 100' : 'e.g. 20'}
            min="1"
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-bg-primary
              text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
        </div>
      )}

      {/* Optional: chain this goal after an existing one */}
      {parentCandidates.length > 0 && (
        <div className="mb-4">
          <label className="text-xs font-medium text-text-secondary block mb-1">
            After goal <span className="text-text-muted">(optional sequence)</span>
          </label>
          <select
            value={sequenceParentId}
            onChange={(e) => setSequenceParentId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-bg-primary
              text-text-primary focus:outline-none focus:border-accent"
          >
            <option value="">None (start immediately)</option>
            {parentCandidates.map(g => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.status})
              </option>
            ))}
          </select>
          {sequenceParentId && (
            <p className="text-[10px] text-text-muted mt-1">
              This goal will start as "queued" and auto-activate when the selected goal completes.
            </p>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 py-2.5 text-sm font-medium bg-accent text-white rounded-lg
            hover:bg-blue-700 transition-colors"
        >
          Create Goal
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 text-sm font-medium text-text-secondary border border-border
            rounded-lg hover:bg-bg-secondary transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
