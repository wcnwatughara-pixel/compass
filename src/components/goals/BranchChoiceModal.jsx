/**
 * BranchChoiceModal - Shown when a completed goal has multiple successors
 *
 * When a goal in a sequence chain completes and has more than one child goal,
 * the user must choose which path to activate. This modal presents the options
 * and lets the user pick one. The unchosen siblings remain queued.
 *
 * Props:
 * - children: array of child goals to choose from
 * - onChoose: callback with the chosen goal's id
 * - onDismiss: close the modal without choosing (children stay queued)
 */
export default function BranchChoiceModal({ children, onChoose, onDismiss }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onDismiss} />

      {/* Modal content */}
      <div className="relative bg-bg-primary rounded-2xl shadow-xl w-full max-w-sm p-5 z-10">
        <h2 className="text-base font-semibold text-text-primary mb-1">
          Choose your next goal
        </h2>
        <p className="text-xs text-text-muted mb-4">
          The completed goal has multiple follow-ups. Pick which one to activate next.
          The others will remain queued.
        </p>

        <div className="flex flex-col gap-2 mb-4">
          {children.map(child => (
            <button
              key={child.id}
              onClick={() => onChoose(child.id)}
              className="w-full text-left px-4 py-3 rounded-xl border border-border
                hover:border-accent hover:bg-accent-light/30 transition-colors"
            >
              <div className="text-sm font-medium text-text-primary">{child.name}</div>
              <div className="text-xs text-text-muted mt-0.5">
                {child.targetType === 'milestone'
                  ? 'Milestone'
                  : `${child.targetValue} ${child.targetType}`
                }
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={onDismiss}
          className="w-full py-2 text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          Decide later (all stay queued)
        </button>
      </div>
    </div>
  )
}
