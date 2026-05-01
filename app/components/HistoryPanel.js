'use client';
import { useState, useEffect } from 'react';

export default function HistoryPanel({ token, onClose, onSearch }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetch('/api/history', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => setHistory(d.history || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const deleteItem = async (id, e) => {
    e.stopPropagation();
    try {
      await fetch('/api/history', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
    } catch (_) {}
    setHistory(prev => prev.filter(h => h.id !== id));
  };

  if (!token) {
    return (
      <div className="history-overlay" onClick={onClose}>
        <div className="history-panel" onClick={(e) => e.stopPropagation()}>
          <div className="history-header">
            <h3>📋 Search History</h3>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
          <div className="history-body">
            <div className="history-empty">
              <p style={{fontSize:'2rem',marginBottom:8}}>🔐</p>
              <p><strong>Login to access your search history</strong></p>
              <p style={{marginTop:8,fontSize:'0.78rem'}}>Your searches will be saved and synced across all your devices.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="history-overlay" onClick={onClose}>
      <div className="history-panel" onClick={(e) => e.stopPropagation()}>
        <div className="history-header">
          <h3>📋 Search History</h3>
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
