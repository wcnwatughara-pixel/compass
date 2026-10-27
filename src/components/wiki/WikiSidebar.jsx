import { useState, useEffect } from 'react'
import { getWikiFolders, getWikiTagCounts } from '../../utils/wiki.js'

/**
 * WikiSidebar - Folder tree and tag cloud for wiki navigation
 *
 * Shows:
 * - "All Pages" option at top
 * - List of folders extracted from existing pages
 * - Tag cloud below the folders with click-to-filter
 *
 * Props:
 * - activeFolder: currently selected folder (null = all pages)
 * - activeTag: currently selected tag (null = no tag filter)
 * - onSelectFolder: callback(folderName | null)
 * - onSelectTag: callback(tagName | null)
 * - onClose: callback to close sidebar on mobile
 * - pageCount: total number of wiki pages (for "All Pages" badge)
 */
export default function WikiSidebar({
  activeFolder,
  activeTag,
  onSelectFolder,
  onSelectTag,
  onClose,
  pageCount,
}) {
  const [folders, setFolders] = useState([])
  const [tagCounts, setTagCounts] = useState([])

  // Load folders and tags whenever pageCount changes (new page added/deleted)
  useEffect(() => {
    async function loadSidebarData() {
      const [folderList, tags] = await Promise.all([
        getWikiFolders(),
        getWikiTagCounts(),
      ])
      setFolders(folderList)
      setTagCounts(tags)
    }
    loadSidebarData()
  }, [pageCount])

  /**
   * Handle folder selection -- clears any active tag filter
   */
  function handleFolderClick(folder) {
    onSelectTag(null)
    onSelectFolder(folder)
    onClose?.()
  }

  /**
   * Handle tag selection -- clears any active folder filter
   */
  function handleTagClick(tag) {
    onSelectFolder(null)
    // Toggle: clicking the active tag deselects it
    onSelectTag(activeTag === tag ? null : tag)
    onClose?.()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Mobile close button */}
      <div className="flex items-center justify-between mb-4 md:hidden">
        <h3 className="text-sm font-semibold text-text-primary">Browse</h3>
        <button
          onClick={onClose}
          className="text-text-secondary hover:text-text-primary p-1"
          aria-label="Close sidebar"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Folders section */}
      <div className="mb-6">
        <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
          Folders
        </h4>

        {/* All Pages option */}
        <button
          onClick={() => handleFolderClick(null)}
          className={`w-full text-left px-2 py-1.5 text-sm rounded transition-colors flex items-center justify-between ${
            !activeFolder && !activeTag
              ? 'bg-accent-light text-accent font-medium'
              : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
          }`}
        >
          <span className="flex items-center gap-2">
            {/* Folder icon */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
            </svg>
            All Pages
          </span>
          <span className="text-xs text-text-muted">{pageCount}</span>
        </button>

        {/* Individual folders */}
        {folders.map((folder) => (
          <button
            key={folder}
            onClick={() => handleFolderClick(folder)}
            className={`w-full text-left px-2 py-1.5 text-sm rounded transition-colors flex items-center gap-2 ${
              activeFolder === folder
                ? 'bg-accent-light text-accent font-medium'
                : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
            </svg>
            {folder}
          </button>
        ))}

        {folders.length === 0 && (
          <p className="text-xs text-text-muted px-2 py-1">No folders yet</p>
        )}
      </div>

      {/* Tag cloud section */}
      {tagCounts.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            Tags
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {tagCounts.map(({ tag, count }) => (
              <button
                key={tag}
                onClick={() => handleTagClick(tag)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full transition-colors ${
                  activeTag === tag
                    ? 'bg-accent text-white'
                    : 'bg-bg-tertiary text-text-secondary hover:bg-border hover:text-text-primary'
                }`}
              >
                {tag}
                <span className="text-[10px] opacity-70">{count}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
