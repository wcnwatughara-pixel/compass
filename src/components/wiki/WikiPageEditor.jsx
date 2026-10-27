import { useState, useEffect, useCallback, useRef } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { getWikiPage, updateWikiPage, deleteWikiPage, getBacklinks } from '../../utils/wiki.js'
import { getProgressPercent } from '../../utils/goals.js'
import WikiContentRenderer from './WikiContentRenderer.jsx'

/**
 * WikiPageEditor - View and edit a single wiki page
 *
 * Features:
 * - Toggle between view mode (rendered Markdown with clickable [[links]])
 *   and edit mode (textarea with formatting toolbar)
 * - Title editing (inline)
 * - Folder and tags editing
 * - Goal progress bar if linkedGoalId is set
 * - Backlinks section: "Pages that link here"
 * - Delete page with confirmation
 *
 * Props:
 * - pageId: the wiki page ID to display/edit
 * - onNavigate: callback(pageId) to navigate to another page (from clicking a [[link]])
 * - onBack: callback to return to the page list
 * - onDeleted: callback after page deletion
 */
export default function WikiPageEditor({ pageId, onNavigate, onBack, onDeleted }) {
  const { goals, wikiPages, refreshWikiPages } = useApp()

  const [page, setPage] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editFolder, setEditFolder] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editGoalId, setEditGoalId] = useState('')
  const [backlinks, setBacklinks] = useState([])
  const [isSaving, setIsSaving] = useState(false)
  const textareaRef = useRef(null)

  // Load page data whenever pageId changes
  useEffect(() => {
    async function loadPage() {
      const loadedPage = await getWikiPage(pageId)
      if (loadedPage) {
        setPage(loadedPage)
        setEditContent(loadedPage.content || '')
        setEditTitle(loadedPage.title)
        setEditFolder(loadedPage.folder || '')
        setEditTags((loadedPage.tags || []).join(', '))
        setEditGoalId(loadedPage.linkedGoalId ? String(loadedPage.linkedGoalId) : '')
      }
      // Load backlinks for the "Pages that link here" section
      const links = await getBacklinks(pageId)
      setBacklinks(links)
    }
    loadPage()
    // Reset editing state when switching pages
    setIsEditing(false)
  }, [pageId])

  // Active goals for the goal-linking dropdown
  const activeGoals = goals.filter(g => g.status === 'active' || g.status === 'complete')

  // Find the linked goal object (if any) for displaying progress bar
  const linkedGoal = page?.linkedGoalId
    ? goals.find(g => g.id === page.linkedGoalId)
    : null

  /**
   * Save all editable fields back to IndexedDB
   */
  const handleSave = useCallback(async () => {
    if (!page) return
    setIsSaving(true)

    try {
      const tags = editTags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)

      await updateWikiPage(page.id, {
        title: editTitle.trim() || page.title,
        content: editContent,
        folder: editFolder.trim() || 'Uncategorized',
        tags,
        linkedGoalId: editGoalId ? Number(editGoalId) : null,
      })

      // Reload the page and backlinks after save
      const updatedPage = await getWikiPage(page.id)
      setPage(updatedPage)
      await refreshWikiPages()

      const links = await getBacklinks(page.id)
      setBacklinks(links)

      setIsEditing(false)
    } catch (err) {
      console.error('Failed to save wiki page:', err)
    } finally {
      setIsSaving(false)
    }
  }, [page, editTitle, editContent, editFolder, editTags, editGoalId, refreshWikiPages])

  /**
   * Delete the page after double confirmation
   */
  async function handleDelete() {
    if (!page) return
    if (!window.confirm(`Delete "${page.title}"? This cannot be undone.`)) return

    await deleteWikiPage(page.id)
    await refreshWikiPages()
    onDeleted()
  }

  /**
   * Insert formatting text at cursor position in the textarea
   * Used by the toolbar buttons
   */
  function insertFormatting(prefix, suffix = '') {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = editContent.slice(start, end)

    const newContent =
      editContent.slice(0, start) +
      prefix +
      (selected || 'text') +
      suffix +
      editContent.slice(end)

    setEditContent(newContent)

    // Restore cursor position after the inserted text
    requestAnimationFrame(() => {
      textarea.focus()
      const cursorPos = start + prefix.length + (selected || 'text').length + suffix.length
      textarea.setSelectionRange(cursorPos, cursorPos)
    })
  }

  if (!page) {
    return (
      <div className="text-center text-text-muted py-12">Loading page...</div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Top bar: back button, edit/save toggle, delete */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15,18 9,12 15,6" />
          </svg>
          Back
        </button>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 text-sm text-text-secondary border border-border rounded-lg
                  hover:bg-bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-3 py-1.5 text-sm font-medium bg-accent text-white rounded-lg
                  hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 text-sm font-medium bg-accent text-white rounded-lg
                  hover:bg-blue-700 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="px-3 py-1.5 text-sm text-danger border border-danger rounded-lg
                  hover:bg-red-50 transition-colors"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Goal progress bar (if linked to a goal) */}
      {linkedGoal && (
        <div className="mb-4 p-3 bg-bg-secondary rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-text-secondary">
              Goal: {linkedGoal.name}
            </span>
            <span className="text-xs text-text-muted">
              {getProgressPercent(linkedGoal)}%
            </span>
          </div>
          <div className="w-full h-2 bg-bg-tertiary rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: `${getProgressPercent(linkedGoal)}%` }}
            />
          </div>
        </div>
      )}

      {isEditing ? (
        /* ============ EDIT MODE ============ */
        <div className="flex flex-col gap-4">
          {/* Title input */}
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="text-2xl font-bold text-text-primary bg-transparent border-b border-border
              pb-2 focus:outline-none focus:border-accent"
            placeholder="Page title"
          />

          {/* Metadata row: folder, tags, goal */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1">Folder</label>
              <input
                type="text"
                value={editFolder}
                onChange={(e) => setEditFolder(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-border rounded-lg bg-bg-primary
                  text-text-primary focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1">Tags</label>
              <input
                type="text"
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                placeholder="comma-separated"
                className="w-full px-2 py-1.5 text-sm border border-border rounded-lg bg-bg-primary
                  text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1">Goal</label>
              <select
                value={editGoalId}
                onChange={(e) => setEditGoalId(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-border rounded-lg bg-bg-primary
                  text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="">None</option>
                {activeGoals.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Formatting toolbar */}
          <div className="flex items-center gap-1 border border-border rounded-lg p-1 bg-bg-secondary">
            <ToolbarButton
              label="H"
              title="Heading"
              onClick={() => insertFormatting('## ', '')}
            />
            <ToolbarButton
              label="B"
              title="Bold"
              onClick={() => insertFormatting('**', '**')}
              bold
            />
            <ToolbarButton
              label="I"
              title="Italic"
              onClick={() => insertFormatting('*', '*')}
              italic
            />
            <ToolbarButton
              label="Link"
              title="Internal link [[Page]]"
              onClick={() => insertFormatting('[[', ']]')}
            />
            <ToolbarButton
              label="List"
              title="Bullet list"
              onClick={() => insertFormatting('\n- ', '')}
            />
            <ToolbarButton
              label="1."
              title="Numbered list"
              onClick={() => insertFormatting('\n1. ', '')}
            />
          </div>

          {/* Content textarea */}
          <textarea
            ref={textareaRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full min-h-[400px] px-4 py-3 text-sm leading-relaxed border border-border
              rounded-lg bg-bg-primary text-text-primary font-mono resize-y
              focus:outline-none focus:border-accent"
            placeholder="Start writing... Use [[Page Name]] to link to other pages."
          />
        </div>
      ) : (
        /* ============ VIEW MODE ============ */
        <div>
          {/* Page title */}
          <h1 className="text-2xl font-bold text-text-primary mb-2">{page.title}</h1>

          {/* Metadata: folder, tags, updated time */}
          <div className="flex flex-wrap items-center gap-2 mb-6 text-xs text-text-muted">
            <span className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              </svg>
              {page.folder}
            </span>
            {page.tags?.length > 0 && (
              <span className="flex items-center gap-1">
                {page.tags.map(tag => (
                  <span
                    key={tag}
                    className="bg-bg-tertiary px-1.5 py-0.5 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </span>
            )}
            <span>
              Updated {new Date(page.updatedAt).toLocaleDateString()}
            </span>
          </div>

          {/* Rendered content with clickable [[links]] */}
          <div className="prose-like leading-relaxed text-text-primary whitespace-pre-wrap">
            <WikiContentRenderer
              content={page.content}
              allPages={wikiPages}
              onNavigate={onNavigate}
            />
          </div>

          {/* Backlinks section */}
          {backlinks.length > 0 && (
            <div className="mt-8 pt-4 border-t border-border">
              <h3 className="text-sm font-semibold text-text-secondary mb-2">
                Pages that link here
              </h3>
              <ul className="flex flex-col gap-1">
                {backlinks.map((bl) => (
                  <li key={bl.id}>
                    <button
                      onClick={() => onNavigate(bl.id)}
                      className="text-sm text-accent hover:underline"
                    >
                      {bl.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Small toolbar button for the formatting bar
 */
function ToolbarButton({ label, title, onClick, bold, italic }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="px-2 py-1 text-xs text-text-secondary hover:bg-bg-tertiary hover:text-text-primary
        rounded transition-colors"
      style={{
        fontWeight: bold ? 700 : 400,
        fontStyle: italic ? 'italic' : 'normal',
      }}
    >
      {label}
    </button>
  )
}
