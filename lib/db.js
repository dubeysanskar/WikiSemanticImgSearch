/**
 * Database layer — LibSQL/Turso (SQLite-compatible)
 * Local dev: uses file:./wikisearch.db
 * Vercel/Prod: uses Turso cloud URL
 */

import { createClient } from '@libsql/client';

let _client = null;

function getClient() {
  if (_client) return _client;

  if (process.env.TURSO_DATABASE_URL) {
    _client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN || '',
    });
  } else {
    _client = createClient({ url: 'file:./wikisearch.db' });
  }
  return _client;
}

/** Initialize tables */
export async function initDB() {
  const db = getClient();
  await db.batch([
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      wiki_username TEXT NOT NULL,
      global_wiki_username TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS otp_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      otp TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS search_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      query TEXT NOT NULL,
      category TEXT DEFAULT '',
      result_count INTEGER DEFAULT 0,
      elapsed TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
  ]);
}

/** Create or update user */
export async function upsertUser(email, wikiUsername, globalWikiUsername) {
  const db = getClient();
  await initDB();
  const existing = await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email] });
  if (existing.rows.length > 0) {
    await db.execute({
      sql: 'UPDATE users SET wiki_username = ?, global_wiki_username = ? WHERE email = ?',
      args: [wikiUsername, globalWikiUsername, email],
    });
    return existing.rows[0].id;
  }
  const result = await db.execute({
    sql: 'INSERT INTO users (email, wiki_username, global_wiki_username) VALUES (?, ?, ?)',
    args: [email, wikiUsername, globalWikiUsername],
  });
  return Number(result.lastInsertRowid);
}

/** Store OTP */
export async function storeOTP(email, otp) {
  const db = getClient();
  await initDB();
  // Invalidate old OTPs
  await db.execute({ sql: 'UPDATE otp_tokens SET used = 1 WHERE email = ?', args: [email] });
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await db.execute({
    sql: 'INSERT INTO otp_tokens (email, otp, expires_at) VALUES (?, ?, ?)',
    args: [email, otp, expiresAt],
  });
}

/** Verify OTP */
export async function verifyOTP(email, otp) {
  const db = getClient();
  await initDB();
  const result = await db.execute({
    sql: 'SELECT id FROM otp_tokens WHERE email = ? AND otp = ? AND used = 0 AND expires_at > datetime(\'now\')',
    args: [email, otp],
  });
  if (result.rows.length === 0) return false;
  await db.execute({ sql: 'UPDATE otp_tokens SET used = 1 WHERE id = ?', args: [result.rows[0].id] });
  return true;
}

/** Get user by email */
export async function getUserByEmail(email) {
  const db = getClient();
  await initDB();
  const result = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] });
  return result.rows[0] || null;
}

/** Get user by ID */
export async function getUserById(id) {
  const db = getClient();
  await initDB();
  const result = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [id] });
  return result.rows[0] || null;
}

/** Save search to history */
export async function saveSearch(userId, query, category, resultCount, elapsed) {
  const db = getClient();
  await initDB();
  await db.execute({
    sql: 'INSERT INTO search_history (user_id, query, category, result_count, elapsed) VALUES (?, ?, ?, ?, ?)',
    args: [userId, query, category || '', resultCount, elapsed || ''],
  });
}

/** Get search history for user */
export async function getHistory(userId, limit = 50) {
  const db = getClient();
  await initDB();
  const result = await db.execute({
    sql: 'SELECT * FROM search_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    args: [userId, limit],
  });
  return result.rows;
}

/** Count total users */
export async function getTotalUsers() {
  const db = getClient();
  await initDB();
  const result = await db.execute('SELECT COUNT(*) as count FROM users');
  return Number(result.rows[0].count);
}
