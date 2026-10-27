import { useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { createWikiPage } from '../../utils/wiki.js'

/**
 * WikiNewPageForm - Modal form for creating a new wiki page
 *
 * Collects:
 * - Title (required, unique)
 * - Folder (text input with datalist of existing folders)
 * - Tags (comma-separated input)
 * - Linked goal (optional dropdown of active goals)
 *
 * Props:
 * - onClose: callback to dismiss the form
 * - onCreated: callback(newPageId) after successful creation
 * - existingFolders: string[] of folders for autocomplete
 */
export default function WikiNewPageForm({ onClose, onCreated, existingFolders = [] }) {
  const { goals, refreshWikiPages } = useApp()

  const [title, setTitle] = useState('')
  const [folder, setFolder] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [linkedGoalId, setLinkedGoalId] = useState('')
  const [error, setError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Only show active goals in the linking dropdown
  const activeGoals = goals.filter(g => g.status === 'active')

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError('Title is required.')
      return
    }

    setIsSubmitting(true)

    try {
      // Parse comma-separated tags, trim whitespace, filter empty
      const tags = tagsInput
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)

      const pageId = await createWikiPage({
        title: trimmedTitle,
        folder: folder.trim() || 'Uncategorized',
        tags,
        linkedGoalId: linkedGoalId ? Number(linkedGoalId) : null,
      })

      await refreshWikiPages()
      onCreated(pageId)
    } catch (err) {
      console.error('Failed to create wiki page:', err)
      setError('Failed to create page. The title may already exist.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-bg-primary rounded-xl shadow-lg w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">New Wiki Page</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Title */}
          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1">
              Title <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Microeconomics"
              autoFocus
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-bg-primary
                text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
          </div>

          {/* Folder */}
          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1">
              Folder
            </label>
            <input
              type="text"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              placeholder="e.g. Study, Work, Personal"
              list="folder-suggestions"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-bg-primary
                text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
            {/* Autocomplete datalist from existing folders */}
            <datalist id="folder-suggestions">
              {existingFolders.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1">
              Tags <span className="text-text-muted">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. economics, midterm, chapter-3"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-bg-primary
                text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
          </div>

          {/* Link to goal */}
          {activeGoals.length > 0 && (
            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1">
                Link to Goal <span className="text-text-muted">(optional)</span>
              </label>
              <select
                value={linkedGoalId}
                onChange={(e) => setLinkedGoalId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-bg-primary
                  text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="">None</option>
                {activeGoals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Error message */}
          {error && (
            <p className="text-sm text-danger">{error}</p>
          )}

          {/* Buttons */}
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-medium border border-border rounded-lg
                text-text-primary hover:bg-bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 text-sm font-medium bg-accent text-white rounded-lg
                hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Page'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
