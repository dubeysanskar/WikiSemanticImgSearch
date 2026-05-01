/**
 * Query Processor — Universal Query Decomposition & Intelligence
 *
 * Breaks natural-language queries into searchable sub-queries using
 * n-gram sliding windows. Works for ANY topic, ANY language — zero
 * hardcoded pattern lists.
 *
 * Inspired by WISE (VGG Oxford) CLIP-based search architecture:
 * - WISE encodes queries into vector embeddings for semantic matching
 * - We leverage the same concept via Wikidata Vector DB (CLIP/SigLIP)
 * - For keyword fallback, we decompose complex prompts into short
 *   adjacent n-grams that Commons API can match effectively
 *
 * @see https://gitlab.com/vgg/wise/wise/
 * @see https://wd-vectordb.wmcloud.org/docs
 */

// ─── Stop words to strip for core keyword extraction ────────────────
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by',
  'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after',
  'above', 'below', 'between', 'under', 'over', 'and', 'but', 'or', 'nor',
  'not', 'so', 'yet', 'both', 'either', 'neither', 'each', 'every', 'all',
  'any', 'few', 'more', 'most', 'some', 'such', 'no', 'only', 'own',
  'same', 'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now',
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she',
  'her', 'it', 'its', 'they', 'them', 'their', 'what', 'which', 'who',
  'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are', 'was',
  'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do',
  'does', 'did', 'doing', 'would', 'could', 'might', 'must', 'shall',
  'as', 'if', 'then', 'because', 'while', 'where', 'when', 'how',
  'picture', 'pictures', 'photo', 'photos', 'photograph', 'photographs',
  'image', 'images', 'pic', 'pics', 'shot', 'shots', 'snapshot', 'snapshots',
  'showing', 'depicting', 'featuring', 'looking', 'find', 'show', 'search',
  'give', 'want', 'need',
]);

/**
 * Strip filler words and normalize whitespace.
 * @param {string} query
 * @returns {string}
 */
function cleanQuery(query) {
  return query
    .replace(/\s+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => !STOP_WORDS.has(w.toLowerCase()) || w.length > 4)
    .join(' ')
    .trim();
}

/**
 * Extract meaningful keywords (non-stop-words, position-ordered).
 * @param {string} text
 * @returns {string[]}
 */
function extractKeywords(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

// ─── Core Decomposition ─────────────────────────────────────────────

/**
 * Decompose a complex query into searchable sub-queries.
 *
 * Uses adjacent n-grams from the cleaned keyword list. This is a
 * universal approach — no hardcoded geo/time/env pattern lists.
 *
 * Strategy:
 *   1. Progressive simplification: full → 4-word → 3-word → 2-word
 *   2. Adjacent 3-grams (best specificity + recall balance)
 *   3. Adjacent 2-grams (broader matches)
 *   4. Bridge queries (connect first concept to last)
 *   5. Middle-out extraction (core subject often in the center)
 *
 * Example: "Picture of 19th century indian temple in monsoon weather"
 *   keywords: [19th, century, indian, temple, monsoon, weather]
 *   → "19th century indian temple" (first 4)
 *   → "19th century indian"       (3-gram)
 *   → "indian temple monsoon"     (3-gram)
 *   → "temple monsoon weather"    (3-gram)
 *   → "indian temple"             (2-gram)
 *   → "temple monsoon"            (2-gram)
 *   → "19th weather"              (bridge)
 *
 * @param {string} query - Raw user input
 * @returns {{ original: string, cleaned: string, subQueries: string[], isComplex: boolean }}
 */
export function decomposeQuery(query) {
  const cleaned = cleanQuery(query);
  const keywords = extractKeywords(cleaned);

  if (keywords.length <= 3) {
    return { original: query, cleaned, subQueries: [cleaned], isComplex: false };
  }

  const sub = new Set();

  // 1. Progressive simplification
  if (keywords.length <= 5) sub.add(keywords.join(' '));
  if (keywords.length > 4)  sub.add(keywords.slice(0, 4).join(' '));
  sub.add(keywords.slice(0, 3).join(' '));
  sub.add(keywords.slice(0, 2).join(' '));

  // 2. Adjacent 3-grams
  for (let i = 0; i <= keywords.length - 3; i++) {
    sub.add(`${keywords[i]} ${keywords[i + 1]} ${keywords[i + 2]}`);
  }

  // 3. Adjacent 2-grams
  for (let i = 0; i <= keywords.length - 2; i++) {
    sub.add(`${keywords[i]} ${keywords[i + 1]}`);
  }

  // 4. Bridge: first ↔ last keyword
  if (keywords.length >= 4) {
    sub.add(`${keywords[0]} ${keywords[keywords.length - 1]}`);
    sub.add(`${keywords[1]} ${keywords[keywords.length - 2]}`);
  }

  // 5. Middle-out: core subject
  if (keywords.length >= 5) {
    const m = Math.floor(keywords.length / 2);
    sub.add(`${keywords[m - 1]} ${keywords[m]} ${keywords[m + 1]}`);
  }

  return {
    original: query,
    cleaned,
    subQueries: [...sub].slice(0, 8),
    isComplex: true,
  };
}

/**
 * Extract optimized keyword search terms (max 4 words for Commons API).
 * @param {string} query
 * @returns {string}
 */
export function extractSearchTerms(query) {
  const cleaned = cleanQuery(query);
  const keywords = extractKeywords(cleaned);
  if (keywords.length <= 4) return cleaned;
  return keywords.slice(0, 4).join(' ');
}

// ─── Suggestions ────────────────────────────────────────────────────

/**
 * Generate related prompt suggestions using n-gram variations.
 * No hardcoded geo/env lists — derives suggestions purely from the
 * user's own keywords + result metadata.
 *
 * @param {string} query
 * @param {object} resultsMeta
 * @returns {string[]}
 */
export function generateRelatedPrompts(query, resultsMeta = {}) {
  const keywords = extractKeywords(cleanQuery(query));
  if (keywords.length === 0) return [];

  const prompts = new Set();

  // Broader: fewer keywords
  if (keywords.length > 2) {
    prompts.add(keywords.slice(0, 2).join(' '));
  }

  // Reorder: last keywords first (different perspective)
  if (keywords.length >= 3) {
    prompts.add(keywords.slice(-2).join(' ') + ' ' + keywords[0]);
  }

  // Photography perspectives
  const perspectives = ['aerial view', 'close-up', 'panoramic', 'at night', 'historical'];
  const mainSubject = keywords.slice(0, Math.min(2, keywords.length)).join(' ');
  for (const p of perspectives) {
    if (!query.toLowerCase().includes(p.split(' ')[0])) {
      prompts.add(`${mainSubject} ${p}`);
      if (prompts.size >= 4) break;
    }
  }

  // From Wikidata labels in results (real data, not guesses)
  const wikidataLabels = resultsMeta.wikidataLabels || [];
  for (const label of wikidataLabels.slice(0, 3)) {
    if (label && !query.toLowerCase().includes(label.toLowerCase())) {
      prompts.add(label);
    }
  }

  return [...prompts].slice(0, 6);
}

/**
 * Generate category suggestions from result metadata.
 * @param {string} query
 * @param {object} resultsMeta
 * @returns {string[]}
 */
export function generateCategorySuggestions(query, resultsMeta = {}) {
  const suggestions = [];

  const matchedCats = resultsMeta.matchedCategories || [];
  for (const cat of matchedCats) {
    if (cat && !suggestions.includes(cat)) suggestions.push(cat);
  }

  const wikidataLabels = resultsMeta.wikidataLabels || [];
  for (const label of wikidataLabels) {
    if (label) {
      const catName = label.replace(/\s+/g, '_');
      if (!suggestions.includes(catName)) suggestions.push(catName);
    }
  }

  return suggestions.slice(0, 8);
}
