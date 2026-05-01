/**
 * Query Processor — NLP Query Decomposition & Intelligence
 *
 * Breaks long natural-language queries into searchable sub-concepts,
 * generates related prompt suggestions, and recommends categories.
 * Entirely rule-based — zero external dependencies, sub-ms execution.
 */

// ─── Stop words to strip for core concept extraction ────────────────
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
]);

// Words that indicate the user wants images — strip these from search
const IMAGE_FILLER = /\b(pictures?|photos?|photographs?|images?|pics|shots?|snapshots?|showing|depicting|featuring|looking\s+for|find\s+me|show\s+me|search\s+for|give\s+me|i\s+want|i\s+need|can\s+you\s+find)\b/gi;

// Time period patterns
const TIME_PATTERNS = /\b(\d{1,2}(?:st|nd|rd|th)[\s-]?century|\d{4}s?|ancient|medieval|modern|contemporary|historic(?:al)?|vintage|retro|old|classical|pre[\s-]?war|post[\s-]?war)\b/gi;

// Geographic/cultural qualifiers
const GEO_PATTERNS = /\b(indian|chinese|japanese|european|african|american|asian|middle[\s-]?eastern|south[\s-]?east[\s-]?asian|latin|arabic|persian|tibetan|thai|korean|vietnamese|turkish|greek|roman|egyptian|brazilian|mexican|australian|canadian|british|french|german|italian|spanish|russian|dutch|portuguese|scandinavian|nordic)\b/gi;

// Weather/environment patterns
const ENV_PATTERNS = /\b(monsoon|rain(?:y|fall)?|snow(?:y|fall)?|fog(?:gy)?|mist(?:y)?|sunset|sunrise|dawn|dusk|twilight|golden\s+hour|blue\s+hour|storm(?:y)?|cloudy|sunny|overcast|winter|summer|spring|autumn|fall)\b/gi;

/**
 * Remove image filler phrases and clean up query
 */
function cleanQuery(query) {
  return query
    .replace(IMAGE_FILLER, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract meaningful words (non-stop-words)
 */
function extractKeywords(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

/**
 * Extract multi-word noun phrases using simple patterns
 */
function extractNounPhrases(text) {
  const cleaned = cleanQuery(text).toLowerCase();
  const phrases = [];

  // Extract adjective+noun combos (2-3 word chunks)
  const words = cleaned.replace(/[^\w\s-]/g, ' ').split(/\s+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    if (STOP_WORDS.has(words[i])) continue;

    // Single meaningful word
    if (words[i].length > 2) {
      phrases.push(words[i]);
    }

    // Two-word phrase
    if (i + 1 < words.length && !STOP_WORDS.has(words[i + 1])) {
      phrases.push(`${words[i]} ${words[i + 1]}`);
    }

    // Three-word phrase
    if (i + 2 < words.length && !STOP_WORDS.has(words[i + 2])) {
      const mid = words[i + 1];
      if (!STOP_WORDS.has(mid) || mid === 'of' || mid === 'in') {
        phrases.push(`${words[i]} ${mid} ${words[i + 2]}`);
      }
    }
  }

  return [...new Set(phrases)];
}

/**
 * Decompose a complex query into searchable sub-queries.
 *
 * UNIVERSAL APPROACH (v3):
 * Instead of hardcoded geo/time/env patterns, uses adjacent n-grams
 * from the cleaned keyword list. This works for ANY topic, ANY language.
 *
 * Strategy:
 * 1. Clean → extract meaningful keywords (position-ordered)
 * 2. Generate adjacent 2-word and 3-word combos (keeps context)
 * 3. Progressive simplification: full → 4-word → 3-word → 2-word
 * 4. First+last keyword bridge (connects intent to subject)
 *
 * Example: "Picture of 19th century indian temple in monsoon weather"
 *   keywords: [19th, century, indian, temple, monsoon, weather]
 *   → "indian temple monsoon" (adj 3-gram)
 *   → "19th century indian" (adj 3-gram)
 *   → "temple monsoon weather" (adj 3-gram)
 *   → "indian temple" (adj 2-gram)
 *   → "temple monsoon" (adj 2-gram)
 *   → "19th weather" (bridge: first+last)
 */
export function decomposeQuery(query) {
  const cleaned = cleanQuery(query);
  const keywords = extractKeywords(cleaned);

  // Short/simple queries — no decomposition needed
  if (keywords.length <= 3) {
    return {
      original: query,
      cleaned,
      subQueries: [cleaned],
      isComplex: false,
    };
  }

  const subQueries = new Set();

  // 1. Progressive simplification of the full keyword set
  //    Full → first 4 → first 3 → first 2
  if (keywords.length <= 5) subQueries.add(keywords.join(' '));
  if (keywords.length > 4) subQueries.add(keywords.slice(0, 4).join(' '));
  subQueries.add(keywords.slice(0, 3).join(' '));
  subQueries.add(keywords.slice(0, 2).join(' '));

  // 2. Adjacent 3-grams (the best balance of specificity + recall)
  //    These keep words that were next to each other in the original query
  for (let i = 0; i <= keywords.length - 3; i++) {
    subQueries.add(`${keywords[i]} ${keywords[i+1]} ${keywords[i+2]}`);
  }

  // 3. Adjacent 2-grams (broader, catches more)
  for (let i = 0; i <= keywords.length - 2; i++) {
    subQueries.add(`${keywords[i]} ${keywords[i+1]}`);
  }

  // 4. Bridge query: connect start concept to end concept
  //    "19th century ... monsoon weather" → "century weather", "19th monsoon"
  if (keywords.length >= 4) {
    subQueries.add(`${keywords[0]} ${keywords[keywords.length - 1]}`);
    subQueries.add(`${keywords[1]} ${keywords[keywords.length - 2]}`);
  }

  // 5. Middle-out: the middle keywords are often the core subject
  if (keywords.length >= 5) {
    const mid = Math.floor(keywords.length / 2);
    subQueries.add(`${keywords[mid-1]} ${keywords[mid]} ${keywords[mid+1]}`);
  }

  return {
    original: query,
    cleaned,
    subQueries: [...subQueries].slice(0, 8),
    isComplex: true,
  };
}

/**
 * Optimized keyword search terms — strip filler, keep descriptive content
 */
export function extractSearchTerms(query) {
  const cleaned = cleanQuery(query);
  const keywords = extractKeywords(cleaned);
  if (keywords.length <= 4) return cleaned;
  // For long queries, use only the 4 most descriptive terms (Commons prefers short queries)
  return keywords.slice(0, 4).join(' ');
}

/**
 * Generate related prompt suggestions based on a query and search results
 */
export function generateRelatedPrompts(query, resultsMeta = {}) {
  const cleaned = cleanQuery(query).toLowerCase();
  const keywords = extractKeywords(cleaned);
  const prompts = [];

  // Extract key concepts
  const timeParts = (cleaned.match(TIME_PATTERNS) || []).map((s) => s.toLowerCase());
  const geoParts = (cleaned.match(GEO_PATTERNS) || []).map((s) => s.toLowerCase());
  const envParts = (cleaned.match(ENV_PATTERNS) || []).map((s) => s.toLowerCase());

  const subjects = keywords.filter(
    (k) => !STOP_WORDS.has(k) && !geoParts.includes(k) && !timeParts.includes(k) && !envParts.includes(k) && k.length > 3
  );

  // Variation 1: Different geo context
  const altGeos = ['Indian', 'Japanese', 'European', 'Chinese', 'African', 'South American'];
  if (subjects.length > 0) {
    const mainSubject = subjects.slice(0, 2).join(' ');
    for (const geo of altGeos) {
      if (!geoParts.includes(geo.toLowerCase())) {
        prompts.push(`${geo} ${mainSubject}`);
        if (prompts.length >= 2) break;
      }
    }
  }

  // Variation 2: Different environment
  const altEnvs = ['at sunset', 'in winter', 'aerial view', 'close-up', 'panoramic'];
  if (subjects.length > 0) {
    const mainSubject = subjects.slice(0, 2).join(' ');
    for (const env of altEnvs) {
      if (!envParts.some((e) => env.includes(e))) {
        prompts.push(`${mainSubject} ${env}`);
        if (prompts.length >= 4) break;
      }
    }
  }

  // Variation 3: Based on Wikidata labels from results
  const wikidataLabels = resultsMeta.wikidataLabels || [];
  for (const label of wikidataLabels.slice(0, 3)) {
    if (label && !cleaned.includes(label.toLowerCase())) {
      prompts.push(label);
    }
  }

  // Variation 4: Broader / narrower queries
  if (keywords.length > 3) {
    prompts.push(keywords.slice(0, 2).join(' ')); // broader
  }
  if (geoParts.length > 0 && subjects.length > 0) {
    prompts.push(`${geoParts[0]} ${subjects[0]} architecture`);
    prompts.push(`${geoParts[0]} ${subjects[0]} heritage`);
  }

  return [...new Set(prompts)].slice(0, 6);
}

/**
 * Generate category suggestions from result metadata
 */
export function generateCategorySuggestions(query, resultsMeta = {}) {
  const suggestions = [];

  // From matched categories in results
  const matchedCats = resultsMeta.matchedCategories || [];
  for (const cat of matchedCats) {
    if (cat && !suggestions.includes(cat)) {
      suggestions.push(cat);
    }
  }

  // From Wikidata labels → likely category names
  const wikidataLabels = resultsMeta.wikidataLabels || [];
  for (const label of wikidataLabels) {
    if (label) {
      const catName = label.replace(/\s+/g, '_');
      if (!suggestions.includes(catName)) {
        suggestions.push(catName);
      }
    }
  }

  return suggestions.slice(0, 8);
}
