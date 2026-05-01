'use client';
import { useState, useEffect } from 'react';

/* ── localStorage helpers (for non-logged-in users) ── */
function getLocalHistory() {
  try { return JSON.parse(localStorage.getItem('wks_history') || '[]'); } catch { return []; }
}
function saveLocalHistory(history) {
  localStorage.setItem('wks_history', JSON.stringify(history.slice(0, 100)));
}

/** Add to local history (called from page.js for non-logged-in users) */
export function addToLocalHistory(query, category, resultCount, elapsed) {
  if (!query) return;
  const history = getLocalHistory();
  history.unshift({ id: Date.now(), query, category: category || '', result_count: resultCount, elapsed: elapsed || '', created_at: new Date().toISOString() });
  saveLocalHistory(history);
}

export default function HistoryPanel({ token, onClose, onSearch }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      // Logged in → fetch from Turso via API
      fetch('/api/history', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => setHistory(d.history || []))
        .catch(() => setHistory(getLocalHistory()))
        .finally(() => setLoading(false));
    } else {
      // Not logged in → use localStorage
      setHistory(getLocalHistory());
      setLoading(false);
    }
  }, [token]);

  const deleteItem = async (id, e) => {
    e.stopPropagation();
    if (token) {
      try {
        await fetch('/api/history', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
      } catch (_) {}
    } else {
      // localStorage delete
      const updated = history.filter(h => h.id !== id);
      saveLocalHistory(updated);
    }
    setHistory(prev => prev.filter(h => h.id !== id));
  };

  return (
    <div className="history-overlay" onClick={onClose}>
      <div className="history-panel" onClick={(e) => e.stopPropagation()}>
        <div className="history-header">
          <h3>📋 Search History {token ? '(synced)' : '(this device)'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="history-body">
          {loading && <p className="history-empty">Loading...</p>}
          {!loading && history.length === 0 && <p className="history-empty">No searches yet. Start searching to build your history.</p>}
          {history.map((h) => (
            <div key={h.id} className="history-item-wrap">
              <button className="history-item" onClick={() => { onSearch(h.query); onClose(); }}>
                <div className="hi-query">{h.query}</div>
                <div className="hi-meta">
                  {h.category && <span className="hi-cat">{h.category}</span>}
                  <span>{h.result_count} results</span>
                  {h.elapsed && <span>{h.elapsed}s</span>}
                  <span>{new Date(h.created_at).toLocaleDateString()}</span>
                </div>
              </button>
              <button className="history-delete" onClick={(e) => deleteItem(h.id, e)} title="Remove">×</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
