'use client';

import { useState, useCallback, useMemo } from 'react';
import { PRESET_CATEGORIES, RESOLUTION_PRESETS } from '@/lib/config';

// ─── SVG Icons ──────────────────────────────────────────
const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
);
const GithubIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.73.083-.73 1.205.085 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.418-1.305.762-1.604-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.694.825.576C20.565 21.795 24 17.295 24 12 24 5.37 18.63 0 12 0z"/></svg>
);
const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
);

const EXAMPLE_QUERIES = [
  { label: 'Indian street food', query: 'people cooking street food in Indian night markets' },
  { label: 'Foggy mountains', query: 'foggy mountains in the Western Ghats at sunrise' },
  { label: 'Temples in monsoon', query: 'photos of 19th century Indian temples during monsoon' },
  { label: 'Folk dance costumes', query: 'colorful traditional folk dance costumes' },
  { label: 'Tropical birds', query: 'endangered birds in tropical forests' },
  { label: 'Castle ruins', query: 'medieval European castle ruins at sunset' },
];

/** Export selected images to Excel (matches harvester xlsx format) */
async function exportToExcel(items) {
  const XLSX = await import('xlsx');
  const rows = items.map((it) => ({
    image_page_url: it.pageUrl || '',
    file_url: it.fullUrl || '',
    title: it.title || '',
    author: it.author || '',
    license: it.license || '',
    resolution: it.width && it.height ? `${it.width} × ${it.height}` : '',
    description: it.description || '',
    source: it.source || '',
    wikidata_item: it.wikidataLabel || it.matchedQid || '',
    category: it.matchedCategory || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  // Auto-width columns
  const colWidths = Object.keys(rows[0] || {}).map((key) => ({
    wch: Math.max(key.length + 2, ...rows.map((r) => String(r[key] || '').slice(0, 60).length + 2)),
  }));
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Images');
  XLSX.writeFile(wb, `commons_search_results_${Date.now()}.xlsx`);
}

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState('combined');
  const [loading, setLoading] = useState(false);
  const [modalItem, setModalItem] = useState(null);

  // Selection
  const [selected, setSelected] = useState(new Set());

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [resPreset, setResPreset] = useState(0);
  const [customWidth, setCustomWidth] = useState('');
  const [customHeight, setCustomHeight] = useState('');

  const activeList = useMemo(() => {
    if (!results) return [];
    return results[activeTab] || results.combined || [];
  }, [results, activeTab]);

  const toggleSelect = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selected.size === activeList.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(activeList.map((_, i) => i)));
    }
  }, [activeList, selected]);

  const handleExport = useCallback(() => {
    const items = activeList.filter((_, i) => selected.has(i));
    if (!items.length) return;
    exportToExcel(items);
  }, [activeList, selected]);

  const doSearch = useCallback(async (q, cat) => {
    const searchQuery = q || query;
    const searchCat = cat ?? (customCategory || selectedCategory);

    if (!searchQuery.trim() && !searchCat) return;
    setLoading(true);
    setResults(null);
    setSelected(new Set());

    const preset = RESOLUTION_PRESETS[resPreset];
    const body = {
      query: searchQuery.trim(),
      mode: 'combined',
      category: searchCat || '',
      minWidth: preset?.width || (customWidth ? Number(customWidth) : null),
      minHeight: preset?.height || (customHeight ? Number(customHeight) : null),
      maxResults: 40,
    };

    try {
      const resp = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (data.error) {
        console.error('API Error:', data.error);
      }
      setResults(data);
      setActiveTab('combined');
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  }, [query, selectedCategory, customCategory, resPreset, customWidth, customHeight]);

  return (
    <>
      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <a href="/" className="header-logo">
            <SearchIcon />
            <span>WikiSemanticImgSearch</span>
          </a>
          <nav className="header-nav">
            <a href="https://github.com/dubeysanskar/WikiSemanticImgSearch" target="_blank" rel="noopener noreferrer">
              <GithubIcon /> GitHub
            </a>
            <a href="https://commons.wikimedia.org" target="_blank" rel="noopener noreferrer">Commons</a>
            <a href="https://wd-vectordb.wmcloud.org/docs" target="_blank" rel="noopener noreferrer">Vector DB</a>
          </nav>
        </div>
      </header>

      {/* Hero + Search */}
      <section className="hero">
        <h1>Semantic Image Search for Wikimedia Commons</h1>
        <p>
          Search millions of freely-licensed images using natural language.
          Powered by AI vision embeddings and the Wikidata Vector Database.
        </p>

        <div className="search-area">
          <form onSubmit={(e) => { e.preventDefault(); doSearch(); }} className="search-box">
            <SearchIcon />
            <input
              className="search-input"
              type="text"
              placeholder="Describe what you're looking for..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="search-btn" type="submit" disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>

          <div className="chips">
            {EXAMPLE_QUERIES.map((ex) => (
              <button key={ex.label} className="chip" onClick={() => { setQuery(ex.query); doSearch(ex.query); }}>
                {ex.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="filters-section">
        <div className="filters-inner">
          <div className="filter-group">
            <label>Category</label>
            <select className="filter-select" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
              <option value="">— None —</option>
              {PRESET_CATEGORIES.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.items.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Custom Category</label>
            <input
              className="filter-input"
              style={{ width: 180 }}
              placeholder="e.g. Nature_of_India"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>Resolution</label>
            <select className="filter-select" style={{ minWidth: 160 }} value={resPreset} onChange={(e) => setResPreset(Number(e.target.value))}>
              {RESOLUTION_PRESETS.map((r, i) => (
                <option key={i} value={i}>{r.label}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Min Width</label>
            <input className="filter-input" type="number" placeholder="px" value={customWidth} onChange={(e) => setCustomWidth(e.target.value)} />
          </div>

          <div className="filter-group">
            <label>Min Height</label>
            <input className="filter-input" type="number" placeholder="px" value={customHeight} onChange={(e) => setCustomHeight(e.target.value)} />
          </div>
        </div>
      </section>

      {/* Results */}
      <section className="results-section container">
        {loading && (
          <div className="loading-area">
            <div className="spinner" />
            <p>Searching Wikimedia Commons with AI embeddings...</p>
          </div>
        )}

        {results && !loading && (
          <>
            <div className="results-header">
              <h2>Results{results.meta?.query ? ` for "${results.meta.query}"` : ''}</h2>
              <div className="results-meta">
                <span>{activeList.length} images</span>
                {results.meta?.elapsed && <span>{results.meta.elapsed}s</span>}
              </div>
            </div>

            {/* Tabs + Actions bar */}
            <div className="results-toolbar">
              <div className="tabs">
                {[
                  { key: 'combined', label: 'All' },
                  { key: 'semantic', label: 'Semantic' },
                  { key: 'keyword', label: 'Keyword' },
                  ...(results.category?.length ? [{ key: 'category', label: 'Category' }] : []),
                ].map((t) => (
                  <button
                    key={t.key}
                    className={`tab-btn ${activeTab === t.key ? 'active' : ''}`}
                    onClick={() => { setActiveTab(t.key); setSelected(new Set()); }}
                  >
                    {t.label} ({(results[t.key] || []).length})
                  </button>
                ))}
              </div>

              {activeList.length > 0 && (
                <div className="selection-bar">
                  <label className="select-all-label">
                    <input
                      type="checkbox"
                      checked={selected.size > 0 && selected.size === activeList.length}
                      onChange={selectAll}
                    />
                    <span>{selected.size > 0 ? `${selected.size} selected` : 'Select all'}</span>
                  </label>
                  {selected.size > 0 && (
                    <button className="btn btn-export" onClick={handleExport}>
                      <DownloadIcon /> Export to Excel
                    </button>
                  )}
                </div>
              )}
            </div>

            {activeList.length === 0 ? (
              <div className="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6"/></svg>
                <h3>No results found</h3>
                <p>Try a different query, remove filters, or use an example search.</p>
              </div>
            ) : (
              <div className="results-grid">
                {activeList.map((item, i) => (
                  <div key={`${item.pageId}-${i}`} className={`image-card ${selected.has(i) ? 'card-selected' : ''}`}>
                    {/* Selection checkbox */}
                    <label className="card-checkbox" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(i)}
                        onChange={() => toggleSelect(i)}
                      />
                    </label>
                    <div className="card-clickable" onClick={() => setModalItem(item)}>
                      <img
                        className="card-thumb"
                        src={item.thumbUrl}
                        alt={item.title}
                        loading="lazy"
                        onError={(e) => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect fill="%23f0f0f2" width="400" height="300"/><text x="50%" y="50%" fill="%238c8fa3" font-family="sans-serif" font-size="13" text-anchor="middle" dominant-baseline="middle">Image unavailable</text></svg>'; }}
                      />
                      <div className="card-body">
                        <div className="card-title" title={item.title}>{item.title}</div>
                        <div className="card-footer">
                          <span className={`badge badge-${item.source}`}>
                            {item.source === 'both' ? 'Both' : item.source === 'semantic' ? 'Semantic' : item.source === 'keyword' ? 'Keyword' : 'Category'}
                          </span>
                          <span className="card-sub">
                            {item.wikidataLabel || item.matchedCategory || (item.width && item.height ? `${item.width}×${item.height}` : '')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!results && !loading && (
          <div className="empty-state" style={{ paddingTop: 80 }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <h3>Search Wikimedia Commons</h3>
            <p>Type a natural language description or select a category to discover images.</p>
          </div>
        )}
      </section>

      {/* Modal */}
      {modalItem && (
        <div className="modal-overlay" onClick={() => setModalItem(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-grid">
              <div className="modal-img-wrap">
                <img src={modalItem.thumbUrl} alt={modalItem.title} />
              </div>
              <div className="modal-info">
                <button className="modal-close" onClick={() => setModalItem(null)}>×</button>
                <h3>{modalItem.title}</h3>
                <div className="modal-meta">
                  <div className="meta-row"><span className="meta-label">Author</span><span className="meta-value">{modalItem.author}</span></div>
                  <div className="meta-row"><span className="meta-label">License</span><span className="meta-value">{modalItem.license || 'Unknown'}</span></div>
                  <div className="meta-row"><span className="meta-label">Resolution</span><span className="meta-value">{modalItem.width && modalItem.height ? `${modalItem.width} × ${modalItem.height}` : 'N/A'}</span></div>
                  <div className="meta-row"><span className="meta-label">Found via</span><span className={`badge badge-${modalItem.source}`}>{modalItem.source === 'both' ? 'Keyword + Semantic' : modalItem.source}</span></div>
                  {modalItem.wikidataLabel && <div className="meta-row"><span className="meta-label">Wikidata</span><span className="meta-value">{modalItem.wikidataLabel}</span></div>}
                </div>
                {modalItem.description && <p className="modal-desc">{modalItem.description}</p>}
                <div className="modal-actions">
                  <a className="btn btn-primary" href={modalItem.pageUrl} target="_blank" rel="noopener noreferrer">View on Commons</a>
                  <a className="btn btn-outline" href={modalItem.fullUrl} target="_blank" rel="noopener noreferrer">Full Resolution</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="footer">
        <p>Semantic Image Search for <a href="https://commons.wikimedia.org" target="_blank" rel="noopener noreferrer">Wikimedia Commons</a></p>
        <p className="sub">
          Powered by <a href="https://wd-vectordb.wmcloud.org/docs" target="_blank" rel="noopener noreferrer">Wikidata Vector DB</a> · <a href="https://www.mediawiki.org/wiki/API:Main_page" target="_blank" rel="noopener noreferrer">MediaWiki API</a> · All images under free licenses
        </p>
      </footer>
    </>
  );
}
