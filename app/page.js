'use client';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { PRESET_CATEGORIES, RESOLUTION_PRESETS } from '@/lib/config';
import AuthModal from './components/AuthModal';
import HistoryPanel from './components/HistoryPanel';

const SearchIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>);
const GithubIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.73.083-.73 1.205.085 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.418-1.305.762-1.604-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.694.825.576C20.565 21.795 24 17.295 24 12 24 5.37 18.63 0 12 0z"/></svg>);
const DownloadIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>);
const ResetIcon = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>);
const CatIcon = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>);

const EXAMPLES = [
  { label: 'Indian street food', query: 'people cooking street food in Indian night markets' },
  { label: 'Foggy mountains', query: 'foggy mountains in the Western Ghats at sunrise' },
  { label: 'Temples in monsoon', query: 'photos of 19th century Indian temples during monsoon' },
  { label: 'Folk dance costumes', query: 'colorful traditional folk dance costumes' },
  { label: 'Tropical birds', query: 'endangered birds in tropical forests' },
  { label: 'Castle ruins', query: 'medieval European castle ruins at sunset' },
];

/** Generate smart fallback suggestions from a query */
function getSmartFallbacks(q) {
  const words = q.replace(/\b(pictures?|photos?|images?|of|a|an|the|in|at|on|for|with|during)\b/gi, '').replace(/\s+/g, ' ').trim().split(' ').filter(w => w.length > 2);
  if (words.length <= 2) return [];
  const suggestions = [];
  if (words.length >= 3) suggestions.push(words.slice(0, 3).join(' '));
  if (words.length >= 2) suggestions.push(words.slice(0, 2).join(' '));
  if (words.length >= 4) suggestions.push(words.slice(1, 4).join(' '));
  suggestions.push(words[words.length - 1] + ' ' + words[0]);
  return [...new Set(suggestions)].slice(0, 4);
}

async function exportToExcel(items) {
  const XLSX = await import('xlsx');
  const rows = items.map(it => ({ image_page_url: it.pageUrl||'', file_url: it.fullUrl||'', title: it.title||'', author: it.author||'', license: it.license||'', resolution: it.width&&it.height?`${it.width}×${it.height}`:'', description: it.description||'', source: it.source||'', wikidata_item: it.wikidataLabel||it.matchedQid||'', category: it.matchedCategory||'' }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = Object.keys(rows[0]||{}).map(k => ({ wch: Math.max(k.length+2, ...rows.map(r => String(r[k]||'').slice(0,60).length+2)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Images');
  XLSX.writeFile(wb, `commons_results_${Date.now()}.xlsx`);
}

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState('combined');
  const [loading, setLoading] = useState(false);
  const [modalItem, setModalItem] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [selectedCategory, setSelectedCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [resPreset, setResPreset] = useState(0);
  const [customWidth, setCustomWidth] = useState('');
  const [customHeight, setCustomHeight] = useState('');
  // Autocomplete
  const [suggestions, setSuggestions] = useState({ suggestions: [], categories: [] });
  const [showSugg, setShowSugg] = useState(false);
  const sugRef = useRef(null);
  const debRef = useRef(null);
  // Category search
  const [catQ, setCatQ] = useState('');
  const [catResults, setCatResults] = useState([]);
  const [showCatDD, setShowCatDD] = useState(false);
  const catDebRef = useRef(null);
  const catRef = useRef(null);
  // Auth
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  // Pagination
  const [visibleCount, setVisibleCount] = useState(40);
  // Special search
  const [specialMode, setSpecialMode] = useState(false);
  const [specialFile, setSpecialFile] = useState(null);
  const [specialLoading, setSpecialLoading] = useState(false);

  // Load auth from localStorage
  useEffect(() => {
    const t = localStorage.getItem('wks_token');
    const u = localStorage.getItem('wks_user');
    if (t && u) { setToken(t); setUser(JSON.parse(u)); }
  }, []);

  const handleLogin = (t, u) => {
    setToken(t); setUser(u);
    localStorage.setItem('wks_token', t);
    localStorage.setItem('wks_user', JSON.stringify(u));
    setShowAuth(false);
  };

  const handleLogout = () => {
    setToken(null); setUser(null);
    localStorage.removeItem('wks_token');
    localStorage.removeItem('wks_user');
  };

  const activeList = useMemo(() => results?.[activeTab] || results?.combined || [], [results, activeTab]);

  // Autocomplete
  useEffect(() => {
    if (debRef.current) clearTimeout(debRef.current);
    if (!query || query.length < 2) { setSuggestions({ suggestions: [], categories: [] }); setShowSugg(false); return; }
    debRef.current = setTimeout(async () => {
      try { const r = await fetch(`/api/suggest?q=${encodeURIComponent(query)}`); const d = await r.json(); setSuggestions(d); setShowSugg(true); } catch (_) {}
    }, 300);
    return () => clearTimeout(debRef.current);
  }, [query]);

  // Category search
  useEffect(() => {
    if (catDebRef.current) clearTimeout(catDebRef.current);
    if (!catQ || catQ.length < 2) { setCatResults([]); setShowCatDD(false); return; }
    catDebRef.current = setTimeout(async () => {
      try { const r = await fetch(`/api/categories?q=${encodeURIComponent(catQ)}`); const d = await r.json(); setCatResults(d.categories||[]); setShowCatDD(true); } catch (_) {}
    }, 300);
    return () => clearTimeout(catDebRef.current);
  }, [catQ]);

  // Click outside
  useEffect(() => {
    const h = (e) => { if (sugRef.current && !sugRef.current.contains(e.target)) setShowSugg(false); if (catRef.current && !catRef.current.contains(e.target)) setShowCatDD(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const toggleSelect = useCallback((id) => setSelected(p => { const n = new Set(p); n.has(id)?n.delete(id):n.add(id); return n; }), []);
  const selectAll = useCallback(() => selected.size===activeList.length?setSelected(new Set()):setSelected(new Set(activeList.map((_,i)=>i))), [activeList, selected]);
  const handleExport = useCallback(() => { const items = activeList.filter((_,i)=>selected.has(i)); if(items.length) exportToExcel(items); }, [activeList, selected]);
  const resetFilters = useCallback(() => { setSelectedCategory(''); setCustomCategory(''); setResPreset(0); setCustomWidth(''); setCustomHeight(''); setCatQ(''); }, []);
  const resetSearch = useCallback(() => { setQuery(''); setResults(null); setSelected(new Set()); setSpecialFile(null); setVisibleCount(40); }, []);
  const newSearch = useCallback(() => { resetSearch(); resetFilters(); setSpecialMode(false); }, [resetSearch, resetFilters]);

  const doSpecialSearch = useCallback(async () => {
    let name = query.trim();
    if (!name) return;
    setSpecialLoading(true); setSpecialFile(null); setResults(null);
    try {
      const r = await fetch(`/api/search/file?name=${encodeURIComponent(name)}`);
      const d = await r.json();
      setSpecialFile(d.file || null);
      if (!d.file) setSpecialFile('not_found');
    } catch(_) { setSpecialFile('not_found'); }
    finally { setSpecialLoading(false); }
  }, [query]);

  const doSearch = useCallback(async (q, cat) => {
    const sq = q || query; const sc = cat ?? (customCategory || selectedCategory);
    if (!sq.trim() && !sc) return;
    setLoading(true); setResults(null); setSelected(new Set()); setShowSugg(false); setVisibleCount(40);
    const preset = RESOLUTION_PRESETS[resPreset];
    const body = { query: sq.trim(), mode: 'combined', category: sc || '', minWidth: preset?.width||(customWidth?Number(customWidth):null), minHeight: preset?.height||(customHeight?Number(customHeight):null), maxResults: 40 };
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    try { const r = await fetch('/api/search', { method:'POST', headers, body: JSON.stringify(body) }); const d = await r.json(); setResults(d); setActiveTab('combined'); } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [query, selectedCategory, customCategory, resPreset, customWidth, customHeight, token]);

  const filtersActive = selectedCategory || customCategory || resPreset > 0 || customWidth || customHeight;

  return (<>
    <header className="header"><div className="header-inner">
      <a href="/" className="header-logo"><img src="/commons-logo.svg" alt="" width="24" height="24" /><span>WikiSemanticImgSearch</span></a>
      <nav className="header-nav">
        <button className="nav-btn" onClick={newSearch}>✨ New Search</button>
        <button className="nav-btn" onClick={() => setShowHistory(true)}>📋 History</button>
        {user ? (
          <><span className="nav-user">Hi, {user.wikiUsername}</span><button className="nav-btn nav-logout" onClick={handleLogout}>Logout</button></>
        ) : (
          <button className="nav-btn nav-login" onClick={() => setShowAuth(true)}>Login</button>
        )}
        <a href="https://github.com/dubeysanskar/WikiSemanticImgSearch" target="_blank" rel="noopener noreferrer"><GithubIcon /> GitHub</a>
      </nav>
    </div></header>

    <section className="hero">
      <h1>Semantic Image Search for Wikimedia Commons</h1>
      <p>Search millions of freely-licensed images using natural language. Powered by AI vision embeddings and the Wikidata Vector Database.</p>
      <div className="search-area" ref={sugRef}>
        <div className="search-mode-toggle">
          <button className={`smt-btn ${!specialMode?'active':''}`} onClick={() => setSpecialMode(false)}>🔍 Semantic Search</button>
          <button className={`smt-btn ${specialMode?'active':''}`} onClick={() => setSpecialMode(true)}>📄 Special Search</button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); specialMode ? doSpecialSearch() : doSearch(); }} className="search-box">
          <SearchIcon />
          <input className="search-input" type="text" placeholder={specialMode ? 'Enter exact filename, e.g. Taj_Mahal.jpg' : "Describe what you're looking for..."} value={query} onChange={(e) => setQuery(e.target.value)} onFocus={() => { if(!specialMode && (suggestions.suggestions.length||suggestions.categories.length)) setShowSugg(true); }} />
          {query && <button type="button" className="search-clear" onClick={resetSearch} title="Reset search">×</button>}
          <button className="search-btn" type="submit" disabled={loading||specialLoading}>{specialLoading?'Looking up...':loading?'Searching...':specialMode?'Find File':'Search'}</button>
        </form>
        {specialMode && specialFile && specialFile !== 'not_found' && (
          <div style={{marginTop:16}}><div className="image-card" style={{maxWidth:360,margin:'0 auto'}}><div className="card-clickable" onClick={() => setModalItem(specialFile)}><img className="card-thumb" src={specialFile.thumbUrl} alt={specialFile.title} /><div className="card-body"><div className="card-title">{specialFile.title}</div><div className="card-footer"><span className="badge badge-category">Special</span><span className="card-sub">{specialFile.width}×{specialFile.height}</span></div></div></div></div></div>
        )}
        {specialMode && specialFile === 'not_found' && <p style={{color:'#ef4444',marginTop:12,fontSize:'0.85rem'}}>File not found on Wikimedia Commons. Check the filename and try again.</p>}
        {showSugg && (suggestions.suggestions.length > 0 || suggestions.categories.length > 0) && (
          <div className="autocomplete-dropdown">
            {suggestions.suggestions.length > 0 && <div className="ac-section"><div className="ac-section-title"><SearchIcon /> Suggestions</div>{suggestions.suggestions.map((s,i) => <button key={i} className="ac-item" onClick={() => {setQuery(s);setShowSugg(false);doSearch(s);}}>{s}</button>)}</div>}
            {suggestions.categories.length > 0 && <div className="ac-section"><div className="ac-section-title"><CatIcon /> Categories</div>{suggestions.categories.map((c,i) => <button key={i} className="ac-item ac-item-cat" onClick={() => {setCustomCategory(c.title);setShowSugg(false);doSearch(query,c.title);}}>{c.label}</button>)}</div>}
          </div>
        )}
        <div className="chips">{EXAMPLES.map(ex => <button key={ex.label} className="chip" onClick={() => {setQuery(ex.query);doSearch(ex.query);}}>{ex.label}</button>)}</div>
      </div>
    </section>

    <section className="filters-section"><div className="filters-inner">
      <div className="filter-group"><label>Campaign / Category</label><select className="filter-select" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}><option value="">— None —</option>{PRESET_CATEGORIES.map(g => <optgroup key={g.group} label={g.group}>{g.items.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</optgroup>)}</select></div>
      <div className="filter-group" ref={catRef} style={{position:'relative'}}><label>Search Categories</label><input className="filter-input" style={{width:200}} placeholder="Search any category..." value={catQ} onChange={(e) => setCatQ(e.target.value)} onFocus={() => {if(catResults.length)setShowCatDD(true);}} />{showCatDD && catResults.length > 0 && <div className="cat-search-dropdown">{catResults.map((c,i) => <button key={i} className="ac-item" onClick={() => {setCustomCategory(c.title);setCatQ(c.label);setShowCatDD(false);}}><CatIcon /> {c.label}</button>)}</div>}</div>
      <div className="filter-group"><label>Custom Category</label><input className="filter-input" style={{width:180}} placeholder="e.g. Nature_of_India" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} /></div>
      <div className="filter-group"><label>Resolution</label><select className="filter-select" style={{minWidth:160}} value={resPreset} onChange={(e) => setResPreset(Number(e.target.value))}>{RESOLUTION_PRESETS.map((r,i) => <option key={i} value={i}>{r.label}</option>)}</select></div>
      <div className="filter-group"><label>Min Width</label><input className="filter-input" type="number" placeholder="px" value={customWidth} onChange={(e) => setCustomWidth(e.target.value)} /></div>
      <div className="filter-group"><label>Min Height</label><input className="filter-input" type="number" placeholder="px" value={customHeight} onChange={(e) => setCustomHeight(e.target.value)} /></div>
      {filtersActive && <div className="filter-group" style={{justifyContent:'flex-end'}}><button className="reset-btn" onClick={resetFilters}><ResetIcon /> Reset Filters</button></div>}
    </div>
    {results?.categorySuggestions?.length > 0 && <div className="category-suggestions"><span className="cs-label">Recommended categories:</span>{results.categorySuggestions.map((c,i) => <button key={i} className="cs-chip" onClick={() => {setCustomCategory(c);doSearch(query,c);}}><CatIcon /> {c.replace(/_/g,' ')}</button>)}</div>}
    </section>

    <section className="results-section container">
      {loading && <div className="loading-area"><div className="spinner" /><p>Searching Wikimedia Commons with AI embeddings...</p></div>}
      {results && !loading && (<>
        <div className="results-header"><h2>Results{results.meta?.query ? ` for "${results.meta.query}"` : ''}</h2><div className="results-meta"><span>{activeList.length} images</span>{results.meta?.elapsed && <span>{results.meta.elapsed}s</span>}</div></div>
        {results.relatedPrompts?.length > 0 && <div className="related-prompts"><span className="rp-label">Related searches:</span>{results.relatedPrompts.map((p,i) => <button key={i} className="rp-chip" onClick={() => {setQuery(p);doSearch(p);}}>{p}</button>)}</div>}
        <div className="results-toolbar"><div className="tabs">{[{key:'combined',label:'All'},{key:'semantic',label:'Semantic'},{key:'keyword',label:'Keyword'},...(results.category?.length?[{key:'category',label:'Category'}]:[])].map(t => <button key={t.key} className={`tab-btn ${activeTab===t.key?'active':''}`} onClick={() => {setActiveTab(t.key);setSelected(new Set());}}>{t.label} ({(results[t.key]||[]).length})</button>)}</div>
        {activeList.length > 0 && <div className="selection-bar"><label className="select-all-label"><input type="checkbox" checked={selected.size>0&&selected.size===activeList.length} onChange={selectAll} /><span>{selected.size>0?`${selected.size} selected`:'Select all'}</span></label>{selected.size>0 && <button className="btn btn-export" onClick={handleExport}><DownloadIcon /> Export</button>}</div>}</div>
        {activeList.length === 0 ? (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6"/></svg>
            <h3>No results found</h3>
            <p>The images for this exact query aren't available on Wikimedia Commons. Try a simpler or different prompt:</p>
            <div className="smart-fallbacks">{getSmartFallbacks(results.meta?.query || query).map((s,i) => <button key={i} className="chip smart-chip" onClick={() => {setQuery(s);doSearch(s);}}>{s}</button>)}</div>
          </div>
        ) : (
          <><div className="results-grid">{activeList.slice(0, visibleCount).map((item,i) => (
            <div key={`${item.pageId}-${i}`} className={`image-card ${selected.has(i)?'card-selected':''}`}>
              <label className="card-checkbox" onClick={e => e.stopPropagation()}><input type="checkbox" checked={selected.has(i)} onChange={() => toggleSelect(i)} /></label>
              <div className="card-clickable" onClick={() => setModalItem(item)}>
                <img className="card-thumb" src={item.thumbUrl} alt={item.title} loading="lazy" decoding="async" onError={(e) => { e.target.src='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect fill="%23f0f0f2" width="400" height="300"/><text x="50%" y="50%" fill="%238c8fa3" font-family="sans-serif" font-size="13" text-anchor="middle" dominant-baseline="middle">Image unavailable</text></svg>'; }} />
                <div className="card-body"><div className="card-title" title={item.title}>{item.title}</div><div className="card-footer"><span className={`badge badge-${item.source}`}>{item.source==='both'?'Both':item.source==='semantic'?'Semantic':item.source==='keyword'?'Keyword':'Category'}</span><span className="card-sub">{item.wikidataLabel||item.matchedCategory||(item.width&&item.height?`${item.width}×${item.height}`:'')}</span></div></div>
              </div>
            </div>
          ))}</div>
          {visibleCount < activeList.length && <div style={{textAlign:'center',padding:'24px 0'}}><button className="btn btn-primary load-more-btn" onClick={() => setVisibleCount(v => v + 40)}>Load More ({activeList.length - visibleCount} remaining)</button></div>}
          {visibleCount >= activeList.length && activeList.length > 40 && <p style={{textAlign:'center',color:'var(--text-muted)',fontSize:'0.82rem',padding:'16px 0'}}>All {activeList.length} images loaded</p>}
          </>)}
      </>)}
      {!results && !loading && <div className="empty-state" style={{paddingTop:80}}><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><h3>Search Wikimedia Commons</h3><p>Type a natural language description or select a category to discover images.</p></div>}
    </section>

    {modalItem && <div className="modal-overlay" onClick={() => setModalItem(null)}><div className="modal-card" onClick={e => e.stopPropagation()}><div className="modal-grid"><div className="modal-img-wrap"><img src={modalItem.thumbUrl} alt={modalItem.title} /></div><div className="modal-info"><button className="modal-close" onClick={() => setModalItem(null)}>×</button><h3>{modalItem.title}</h3><div className="modal-meta"><div className="meta-row"><span className="meta-label">Author</span><span className="meta-value">{modalItem.author}</span></div><div className="meta-row"><span className="meta-label">License</span><span className="meta-value">{modalItem.license||'Unknown'}</span></div><div className="meta-row"><span className="meta-label">Resolution</span><span className="meta-value">{modalItem.width&&modalItem.height?`${modalItem.width}×${modalItem.height}`:'N/A'}</span></div><div className="meta-row"><span className="meta-label">Found via</span><span className={`badge badge-${modalItem.source}`}>{modalItem.source==='both'?'Keyword + Semantic':modalItem.source}</span></div>{modalItem.wikidataLabel && <div className="meta-row"><span className="meta-label">Wikidata</span><span className="meta-value">{modalItem.wikidataLabel}</span></div>}</div>{modalItem.description && <p className="modal-desc">{modalItem.description}</p>}<div className="modal-actions"><a className="btn btn-primary" href={modalItem.pageUrl} target="_blank" rel="noopener noreferrer">View on Commons</a><a className="btn btn-outline" href={modalItem.fullUrl} target="_blank" rel="noopener noreferrer">Full Resolution</a></div></div></div></div></div>}

    {showAuth && <AuthModal onClose={() => setShowAuth(false)} onLogin={handleLogin} />}
    {showHistory && <HistoryPanel token={token} onClose={() => setShowHistory(false)} onSearch={(q) => {setQuery(q);doSearch(q);}} />}

    <footer className="footer"><p>Semantic Image Search for <a href="https://commons.wikimedia.org" target="_blank" rel="noopener noreferrer">Wikimedia Commons</a></p><p className="sub">Powered by <a href="https://wd-vectordb.wmcloud.org/docs" target="_blank" rel="noopener noreferrer">Wikidata Vector DB</a> · <a href="https://www.mediawiki.org/wiki/API:Main_page" target="_blank" rel="noopener noreferrer">MediaWiki API</a> · All images under free licenses</p><p className="sub" style={{marginTop:8}}>Made with ❤️ by <a href="https://meta.wikimedia.org/wiki/User:Sanskardubeydev" target="_blank" rel="noopener noreferrer">Sanskardubeydev</a> in collaboration with <a href="https://meta.wikimedia.org/wiki/User:Shadabgdg" target="_blank" rel="noopener noreferrer">Shadabgdg</a></p></footer>
  </>);
}
