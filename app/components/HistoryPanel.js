'use client';
import { useState, useEffect } from 'react';

/** Get history from localStorage */
function getLocalHistory() {
  try {
    return JSON.parse(localStorage.getItem('wks_history') || '[]');
  } catch { return []; }
}

/** Save history to localStorage */
function saveLocalHistory(history) {
  localStorage.setItem('wks_history', JSON.stringify(history.slice(0, 100)));
}

/** Add a search to history */
export function addToHistory(query, category, resultCount, elapsed) {
  if (!query) return;
  const history = getLocalHistory();
  history.unshift({
    id: Date.now(),
    query,
    category: category || '',
    result_count: resultCount,
    elapsed: elapsed || '',
    created_at: new Date().toISOString(),
  });
  saveLocalHistory(history);
}

export default function HistoryPanel({ onClose, onSearch }) {
  const [history, setHistory] = useState([]);

  useEffect(() => { setHistory(getLocalHistory()); }, []);

  const deleteItem = (id, e) => {
    e.stopPropagation();
    const updated = history.filter((h) => h.id !== id);
    setHistory(updated);
    saveLocalHistory(updated);
  };

  return (
    <div className="history-overlay" onClick={onClose}>
      <div className="history-panel" onClick={(e) => e.stopPropagation()}>
        <div className="history-header">
          <h3>📋 Search History</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="history-body">
          {history.length === 0 && <p className="history-empty">No searches yet. Start searching to build your history.</p>}
          {history.map((h) => (
            <div key={h.id} className="history-item-wrap">
              <button className="history-item" onClick={() => { onSearch(h.query); onClose(); }}>
                <div className="hi-query">{h.query}</div>
                <div className="hi-meta">
                  {h.category && <span className="hi-cat">{h.category}</span>}
                  <span>{h.result_count} results</span>
                  <span>{h.elapsed}s</span>
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
