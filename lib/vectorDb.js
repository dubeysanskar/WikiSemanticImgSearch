/**
 * Wikidata Vector DB client
 * Queries the embedding-based semantic search API at wd-vectordb.wmcloud.org
 *
 * The service uses AI vision/text embeddings (multilingual models like SigLIP 2,
 * CLIP/OpenCLIP) to represent Wikidata items as dense vectors.
 * It combines Vector Search + Keyword Search using Reciprocal Rank Fusion (RRF).
 */

import { VECTOR_DB_API, WIKIDATA_API, DEFAULTS } from './config';

/**
 * Query Wikidata Vector DB for semantically related items.
 * Returns Q-IDs with similarity scores.
 *
 * @param {string} query - Natural language query
 * @param {object} opts
 * @param {number} opts.k - Number of top results
 * @param {string} opts.lang - Language code or "all"
 * @returns {Array<{QID: string, similarity_score: number, rrf_score: number, source: string}>}
 */
export async function queryVectorDB(query, { k = DEFAULTS.vectorK, lang = 'en' } = {}) {
  const url = new URL('/item/query/', VECTOR_DB_API);
  url.searchParams.set('query', query);
  url.searchParams.set('lang', lang);
  url.searchParams.set('K', String(k));

  try {
    const resp = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(DEFAULTS.apiTimeout),
    });
    if (!resp.ok) return [];
    return await resp.json();
  } catch (err) {
    console.warn('[VectorDB] Query failed:', err.message);
    return [];
  }
}

/**
 * Compute similarity score between a query and specific Wikidata Q-IDs.
 */
export async function similarityScore(query, qids, { lang = 'en' } = {}) {
  const url = new URL('/similarity-score/', VECTOR_DB_API);
  url.searchParams.set('query', query);
  url.searchParams.set('qid', qids.join(','));
  url.searchParams.set('lang', lang);

  try {
    const resp = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(DEFAULTS.apiTimeout),
    });
    if (!resp.ok) return [];
    return await resp.json();
  } catch (err) {
    console.warn('[VectorDB] Similarity failed:', err.message);
    return [];
  }
}

/**
 * Get human-readable labels for Wikidata Q-IDs
 */
export async function getWikidataLabels(qids) {
  if (!qids.length) return {};
  const url = new URL(WIKIDATA_API);
  url.searchParams.set('action', 'wbgetentities');
  url.searchParams.set('ids', qids.slice(0, 50).join('|'));
  url.searchParams.set('props', 'labels|descriptions');
  url.searchParams.set('languages', 'en');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');

  try {
    const resp = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(DEFAULTS.apiTimeout),
    });
    if (!resp.ok) return {};
    const data = await resp.json();
    const labels = {};
    for (const [qid, entity] of Object.entries(data.entities || {})) {
      labels[qid] = {
        label: entity.labels?.en?.value || qid,
        description: entity.descriptions?.en?.value || '',
      };
    }
    return labels;
  } catch (_) {
    return {};
  }
}
