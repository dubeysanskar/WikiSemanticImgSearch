/**
 * Database layer — Turso (cloud SQLite)
 * Only stores search history (keyed by email from JWT).
 * Auth is handled in-memory, no DB needed for that.
 */

import { createClient } from '@libsql/client';

let _client = null;

function getClient() {
  if (_client) return _client;
  _client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN || '',
  });
  return _client;
}

let _initialized = false;

/** Initialize search_history table */
async function initDB() {
  if (_initialized) return;
  const db = getClient();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS search_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      query TEXT NOT NULL,
      category TEXT DEFAULT '',
      result_count INTEGER DEFAULT 0,
      elapsed TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  _initialized = true;
}

/** Save search to history */
export async function saveSearch(email, query, category, resultCount, elapsed) {
  const db = getClient();
  await initDB();
  await db.execute({
    sql: 'INSERT INTO search_history (email, query, category, result_count, elapsed) VALUES (?, ?, ?, ?, ?)',
    args: [email, query, category || '', resultCount, elapsed || ''],
  });
}

/** Get search history for user (by email) */
export async function getHistory(email, limit = 50) {
  const db = getClient();
  await initDB();
  const result = await db.execute({
    sql: 'SELECT * FROM search_history WHERE email = ? ORDER BY created_at DESC LIMIT ?',
    args: [email, limit],
  });
  return result.rows;
}

/** Delete a specific history item (owned by user) */
export async function deleteHistoryItem(email, historyId) {
  const db = getClient();
  await initDB();
  await db.execute({
    sql: 'DELETE FROM search_history WHERE id = ? AND email = ?',
    args: [historyId, email],
  });
}
