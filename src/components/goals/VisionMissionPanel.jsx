import { useState, useRef } from 'react'

/**
 * VisionMissionPanel - Editable Vision & Mission reference cards
 *
 * Two full-width cards displayed at the top of the Goals screen.
 * Each has a tinted background (#F8FAFC), a title, editable body text,
 * and a pencil icon to enter edit mode. Content is saved on blur
 * to IndexedDB via the settings key-value store.
 *
 * Props:
 * - vision: current vision text from settings
 * - mission: current mission text from settings
 * - onSaveVision: callback to persist vision text
 * - onSaveMission: callback to persist mission text
 */
export default function VisionMissionPanel({ vision, mission, onSaveVision, onSaveMission }) {
  return (
    <div className="flex flex-col gap-3 mb-6">
      <EditablePanel
        title="Vision"
        placeholder="What does your ideal future look like? Write your vision here..."
        value={vision}
        onSave={onSaveVision}
      />
      <EditablePanel
        title="Mission"
        placeholder="What is your core purpose? Write your mission here..."
        value={mission}
        onSave={onSaveMission}
      />
    </div>
  )
}

/**
 * EditablePanel - A single editable reference card
 *
 * Displays text in read mode with a pencil icon.
 * Clicking the pencil or the empty placeholder switches to edit mode.
 * On blur, the new text is saved via the onSave callback.
 */
function EditablePanel({ title, placeholder, value, onSave }) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const textareaRef = useRef(null)

  function handleStartEdit() {
    setDraft(value)
    setIsEditing(true)
    // Focus the textarea on next render
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  function handleBlur() {
    setIsEditing(false)
    // Only save if the text actually changed
    if (draft.trim() !== value) {
      onSave(draft.trim())
    }
  }

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: '#F8FAFC' }}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
          {title}
        </h3>
        {!isEditing && (
          <button
            onClick={handleStartEdit}
            className="text-text-muted hover:text-text-primary transition-colors"
            title={`Edit ${title.toLowerCase()}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
          </button>
        )}
      </div>

      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder}
          rows={3}
          className="w-full text-sm text-text-primary bg-transparent resize-none
            focus:outline-none placeholder:text-text-muted leading-relaxed"
        />
      ) : (
        <div
          onClick={!value ? handleStartEdit : undefined}
          className={`text-sm leading-relaxed ${
            value ? 'text-text-primary' : 'text-text-muted cursor-pointer'
          }`}
        >
          {value || placeholder}
        </div>
      )}
    </div>
  )
}
