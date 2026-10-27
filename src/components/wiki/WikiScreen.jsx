import { useState, useEffect, useMemo } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { getWikiPages, searchWikiPages, getWikiFolders } from '../../utils/wiki.js'
import WikiSidebar from './WikiSidebar.jsx'
import WikiPageEditor from './WikiPageEditor.jsx'
import WikiNewPageForm from './WikiNewPageForm.jsx'

/**
 * WikiScreen - Main wiki/knowledge base screen
 *
 * Layout:
 * - Desktop: sidebar (folders + tags) on the left, page list or editor on the right
 * - Mobile: sidebar collapses, accessible via hamburger button
 *
 * Views:
 * - Page list (default): shows all pages or filtered by folder/tag, with search
 * - Page editor: shows when a page is selected for viewing/editing
 * - New page form: modal overlay for creating a new page
 *
 * The screen manages its own navigation state (which page is open)
 * without using React Router sub-routes -- keeps it simple.
 */
export default function WikiScreen() {
  const { wikiPages } = useApp()

  // Navigation state: null = page list, number = viewing a specific page
  const [activePageId, setActivePageId] = useState(null)
  // Filtering state
  const [activeFolder, setActiveFolder] = useState(null)
  const [activeTag, setActiveTag] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  // UI state
  const [showNewPageForm, setShowNewPageForm] = useState(false)
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)
  // Filtered page list (loaded async from IndexedDB for folder/tag filtering)
  const [filteredPages, setFilteredPages] = useState([])
  const [existingFolders, setExistingFolders] = useState([])

  // Reload filtered pages when filter criteria or wikiPages change
  useEffect(() => {
    async function loadPages() {
      let pages

      if (searchQuery.trim()) {
        // Full-text search takes priority over folder/tag filters
        pages = await searchWikiPages(searchQuery)
      } else if (activeFolder) {
        pages = await getWikiPages({ folder: activeFolder })
      } else if (activeTag) {
        pages = await getWikiPages({ tag: activeTag })
      } else {
        pages = await getWikiPages()
      }

      setFilteredPages(pages)
    }
    loadPages()
  }, [activeFolder, activeTag, searchQuery, wikiPages])

  // Load folder list for the new-page form autocomplete
  useEffect(() => {
    async function loadFolders() {
      const folders = await getWikiFolders()
      setExistingFolders(folders)
    }
    loadFolders()
  }, [wikiPages])

  /**
   * Navigate to a specific wiki page (from page list or from a [[link]])
   */
  function handleNavigate(pageId) {
    setActivePageId(pageId)
  }

  /**
   * Return to the page list from the editor
   */
  function handleBack() {
    setActivePageId(null)
  }

  /**
   * After creating a new page, navigate directly to it
   */
  function handlePageCreated(newPageId) {
    setShowNewPageForm(false)
    setActivePageId(newPageId)
  }

  /**
   * After deleting a page, return to the page list
   */
  function handlePageDeleted() {
    setActivePageId(null)
  }

  // If a specific page is selected, show the editor
  if (activePageId !== null) {
    return (
      <WikiPageEditor
        pageId={activePageId}
        onNavigate={handleNavigate}
        onBack={handleBack}
        onDeleted={handlePageDeleted}
      />
    )
  }

  // Otherwise show the page list with sidebar
  return (
    <div className="flex gap-6 min-h-[calc(100vh-8rem)]">
      {/* Desktop sidebar */}
      <div className="hidden md:block w-48 flex-shrink-0">
        <WikiSidebar
          activeFolder={activeFolder}
          activeTag={activeTag}
          onSelectFolder={setActiveFolder}
          onSelectTag={setActiveTag}
          pageCount={wikiPages.length}
        />
      </div>

      {/* Mobile sidebar overlay */}
      {showMobileSidebar && (
        <div className="fixed inset-0 z-[55] md:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowMobileSidebar(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-bg-primary p-4 shadow-lg overflow-y-auto">
            <WikiSidebar
              activeFolder={activeFolder}
              activeTag={activeTag}
              onSelectFolder={setActiveFolder}
              onSelectTag={setActiveTag}
              onClose={() => setShowMobileSidebar(false)}
              pageCount={wikiPages.length}
            />
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 min-w-0">
        {/* Header row: title, mobile sidebar button, search, new page */}
        <div className="flex items-center gap-3 mb-4">
          {/* Mobile sidebar toggle */}
          <button
            onClick={() => setShowMobileSidebar(true)}
            className="md:hidden p-2 text-text-secondary hover:text-text-primary"
            aria-label="Open sidebar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <h1 className="text-2xl font-bold text-text-primary">Wiki</h1>

          <div className="flex-1" />

          {/* New page button */}
          <button
            onClick={() => setShowNewPageForm(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-accent text-white
              rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Page
          </button>
        </div>

        {/* Search bar */}
        <div className="relative mb-4">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search wiki pages..."
            className="w-full pl-10 pr-3 py-2 text-sm border border-border rounded-lg bg-bg-primary
              text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Filter indicator */}
        {(activeFolder || activeTag) && (
          <div className="flex items-center gap-2 mb-3 text-sm text-text-secondary">
            <span>
              Filtered by: {activeFolder ? `folder "${activeFolder}"` : `tag "${activeTag}"`}
            </span>
            <button
              onClick={() => { setActiveFolder(null); setActiveTag(null) }}
              className="text-accent hover:underline text-xs"
            >
              Clear
            </button>
          </div>
        )}

        {/* Page list */}
        {filteredPages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-text-muted mb-2">
              {searchQuery
                ? `No pages found for "${searchQuery}"`
                : wikiPages.length === 0
                  ? 'No wiki pages yet.'
                  : 'No pages in this filter.'}
            </p>
            {wikiPages.length === 0 && (
              <button
                onClick={() => setShowNewPageForm(true)}
                className="text-sm text-accent hover:underline"
              >
                Create your first page
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredPages.map((page) => (
              <button
                key={page.id}
                onClick={() => handleNavigate(page.id)}
                className="w-full text-left p-3 border border-border rounded-lg hover:bg-bg-secondary
                  transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors truncate">
                      {page.title}
                    </h3>
                    {/* Content preview: first 100 chars */}
                    {page.content && (
                      <p className="text-xs text-text-muted mt-0.5 truncate">
                        {page.content.slice(0, 100).replace(/\n/g, ' ')}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0 ml-3 text-right">
                    <span className="text-[10px] text-text-muted">
                      {page.folder}
                    </span>
                  </div>
                </div>
                {/* Tags row */}
                {page.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {page.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] bg-bg-tertiary text-text-muted px-1.5 py-0.5 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* New page form modal */}
      {showNewPageForm && (
        <WikiNewPageForm
          onClose={() => setShowNewPageForm(false)}
          onCreated={handlePageCreated}
          existingFolders={existingFolders}
        />
      )}
    </div>
  )
}
