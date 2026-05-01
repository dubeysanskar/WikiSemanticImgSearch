'use client';
import { useState, useEffect } from 'react';

export default function HistoryPanel({ token, onClose, onSearch }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch('/api/history', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setHistory(d.history || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

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
          {history.map((h, i) => (
            <button key={i} className="history-item" onClick={() => { onSearch(h.query); onClose(); }}>
              <div className="hi-query">{h.query}</div>
              <div className="hi-meta">
                {h.category && <span className="hi-cat">{h.category}</span>}
                <span>{h.result_count} results</span>
                <span>{h.elapsed}s</span>
                <span>{new Date(h.created_at).toLocaleDateString()}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
