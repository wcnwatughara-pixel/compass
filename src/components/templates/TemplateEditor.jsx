import { useState, useCallback } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import db from '../../db/db.js'
import { generateBlockId } from '../../db/seedData.js'
import { formatTime12h, formatDuration } from '../../utils/date.js'

/**
 * TemplateEditor - Create and edit schedule templates
 *
 * Features:
 * - List all templates with expand/collapse
 * - Add/edit/delete blocks within a template
 * - Create new templates, duplicate existing ones
 * - Delete templates (with confirmation)
 * - Both fixed-time (startTime) and duration-based blocks
 */

/**
 * BlockForm - Inline form for adding or editing a single block
 */
function BlockForm({ block, onSave, onCancel }) {
  const [name, setName] = useState(block?.name || '')
  const [startTime, setStartTime] = useState(block?.startTime || '')
  const [durationMinutes, setDurationMinutes] = useState(block?.durationMinutes || 60)
  const [category, setCategory] = useState(block?.category || 'personal')

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return

    onSave({
      id: block?.id || generateBlockId(),
      name: name.trim(),
      startTime: startTime || null,
      durationMinutes: Number(durationMinutes),
      category,
      linkedGoalId: block?.linkedGoalId || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="border border-border rounded-lg p-4 bg-bg-secondary">
      <div className="flex flex-col gap-3">
        {/* Block name */}
        <div>
          <label className="text-xs font-medium text-text-secondary block mb-1">Block Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Deep Work"
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-bg-primary
              text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Start time (optional for duration-based blocks) */}
          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1">
              Start Time <span className="text-text-muted">(optional)</span>
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-bg-primary
                text-text-primary focus:outline-none focus:border-accent"
            />
          </div>

          {/* Duration in minutes */}
          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1">Duration (min)</label>
            <input
              type="number"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              min="5"
              step="5"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-bg-primary
                text-text-primary focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Category selector */}
        <div>
          <label className="text-xs font-medium text-text-secondary block mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-bg-primary
              text-text-primary focus:outline-none focus:border-accent"
          >
            <option value="personal">Personal</option>
            <option value="work">Work</option>
            <option value="learning">Learning</option>
            <option value="health">Health</option>
          </select>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg
              hover:bg-blue-700 transition-colors"
          >
            {block?.id ? 'Update' : 'Add Block'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary
              transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  )
}

/**
 * TemplateCard - Expandable card for a single template
 */
function TemplateCard({ template, onUpdate, onDelete, onDuplicate }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [editingBlock, setEditingBlock] = useState(null) // block object or 'new'
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(template.name)
  const [editType, setEditType] = useState(template.type)

  // Sort blocks by start time for display
  const sortedBlocks = [...(template.blocks || [])].sort((a, b) => {
    if (!a.startTime) return 1
    if (!b.startTime) return -1
    return a.startTime.localeCompare(b.startTime)
  })

  /**
   * Save a new or edited block to the template
   */
  async function handleBlockSave(blockData) {
    const existingIndex = template.blocks.findIndex((b) => b.id === blockData.id)
    let updatedBlocks

    if (existingIndex >= 0) {
      // Update existing block
      updatedBlocks = template.blocks.map((b) =>
        b.id === blockData.id ? blockData : b
      )
    } else {
      // Add new block
      updatedBlocks = [...template.blocks, blockData]
    }

    await db.scheduleTemplates.update(template.id, {
      blocks: updatedBlocks,
      updatedAt: new Date().toISOString(),
    })
    setEditingBlock(null)
    onUpdate()
  }

  /**
   * Remove a block from the template
   */
  async function handleBlockDelete(blockId) {
    const updatedBlocks = template.blocks.filter((b) => b.id !== blockId)
    await db.scheduleTemplates.update(template.id, {
      blocks: updatedBlocks,
      updatedAt: new Date().toISOString(),
    })
    onUpdate()
  }

  /**
   * Save template name/type edits
   */
  async function handleTemplateSave() {
    await db.scheduleTemplates.update(template.id, {
      name: editName.trim(),
      type: editType,
      updatedAt: new Date().toISOString(),
    })
    setIsEditing(false)
    onUpdate()
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Template header - click to expand */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-bg-secondary transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          {/* Expand/collapse chevron */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`text-text-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>

          <div>
            <h3 className="text-[15px] font-semibold text-text-primary">{template.name}</h3>
            <p className="text-xs text-text-muted">
              {template.type} - {template.blocks?.length || 0} blocks
            </p>
          </div>
        </div>

        {/* Quick actions (stop propagation so they don't toggle expand) */}
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onDuplicate(template)}
            className="p-1.5 text-text-muted hover:text-text-primary rounded transition-colors"
            title="Duplicate template"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(template.id)}
            className="p-1.5 text-text-muted hover:text-danger rounded transition-colors"
            title="Delete template"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded content: blocks list and editor */}
      {isExpanded && (
        <div className="border-t border-border p-4">
          {/* Template name/type editing */}
          {isEditing ? (
            <div className="flex items-center gap-2 mb-4">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="flex-1 px-3 py-1.5 text-sm border border-border rounded-lg bg-bg-primary
                  text-text-primary focus:outline-none focus:border-accent"
              />
              <select
                value={editType}
                onChange={(e) => setEditType(e.target.value)}
                className="px-3 py-1.5 text-sm border border-border rounded-lg bg-bg-primary
                  text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="weekday">Weekday</option>
                <option value="weekend">Weekend</option>
                <option value="custom">Custom</option>
              </select>
              <button
                onClick={handleTemplateSave}
                className="px-3 py-1.5 text-sm font-medium bg-accent text-white rounded-lg"
              >
                Save
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 text-sm text-text-muted"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs text-accent hover:underline mb-4 block"
            >
              Edit name / type
            </button>
          )}

          {/* Blocks list */}
          <div className="flex flex-col gap-2 mb-3">
            {sortedBlocks.map((block) => (
              <div
                key={block.id}
                className="flex items-center justify-between p-3 bg-bg-secondary rounded-lg"
              >
                <div>
                  <p className="text-sm font-medium text-text-primary">{block.name}</p>
                  <p className="text-xs text-text-muted">
                    {block.startTime ? formatTime12h(block.startTime) + ' - ' : ''}
                    {formatDuration(block.durationMinutes)} - {block.category}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingBlock(block)}
                    className="p-1 text-text-muted hover:text-accent rounded"
                    title="Edit block"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleBlockDelete(block.id)}
                    className="p-1 text-text-muted hover:text-danger rounded"
                    title="Delete block"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Block form (add new or edit existing) */}
          {editingBlock ? (
            <BlockForm
              block={editingBlock === 'new' ? null : editingBlock}
              onSave={handleBlockSave}
              onCancel={() => setEditingBlock(null)}
            />
          ) : (
            <button
              onClick={() => setEditingBlock('new')}
              className="w-full py-2 text-sm font-medium text-accent border border-dashed border-accent
                rounded-lg hover:bg-accent-light transition-colors"
            >
              + Add Block
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * TemplateEditor - Main templates screen
 */
export default function TemplateEditor() {
  const { templates, refreshTemplates, refreshTodaySchedule } = useApp()
  const [showNewForm, setShowNewForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('weekday')

  /**
   * Create a new empty template
   */
  async function handleCreateTemplate(e) {
    e.preventDefault()
    if (!newName.trim()) return

    await db.scheduleTemplates.add({
      name: newName.trim(),
      type: newType,
      blocks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    setNewName('')
    setShowNewForm(false)
    await refreshTemplates()
  }

  /**
   * Duplicate a template with " (Copy)" suffix
   */
  async function handleDuplicate(template) {
    await db.scheduleTemplates.add({
      name: `${template.name} (Copy)`,
      type: template.type,
      // Deep clone blocks with new IDs to avoid collisions
      blocks: template.blocks.map((b) => ({ ...b, id: generateBlockId() })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    await refreshTemplates()
  }

  /**
   * Delete a template with confirmation
   */
  async function handleDelete(templateId) {
    // Simple confirmation via native dialog
    if (!window.confirm('Delete this template? This cannot be undone.')) return

    await db.scheduleTemplates.delete(templateId)
    await refreshTemplates()
  }

  /**
   * Refresh handler passed to child cards
   */
  const handleUpdate = useCallback(async () => {
    await refreshTemplates()
    // Also refresh today's schedule in case the active template was edited
    await refreshTodaySchedule()
  }, [refreshTemplates, refreshTodaySchedule])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-text-primary">Templates</h1>
        <button
          onClick={() => setShowNewForm(true)}
          className="px-3 py-1.5 text-sm font-medium bg-accent text-white rounded-lg
            hover:bg-blue-700 transition-colors"
        >
          + New
        </button>
      </div>

      {/* New template form */}
      {showNewForm && (
        <form onSubmit={handleCreateTemplate} className="border border-border rounded-lg p-4 mb-4 bg-bg-secondary">
          <div className="flex flex-col gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Template name"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-bg-primary
                text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              autoFocus
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-bg-primary
                text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="weekday">Weekday</option>
              <option value="weekend">Weekend</option>
              <option value="custom">Custom</option>
            </select>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                className="px-4 py-2 text-sm text-text-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Templates list */}
      <div className="flex flex-col gap-3">
        {templates.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-8">
            No templates yet. Create one to get started.
          </p>
        ) : (
          templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
            />
          ))
        )}
      </div>
    </div>
  )
}
