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
 * For short queries (≤ 3 words), returns just the original.
 * For long queries, extracts concepts and generates multiple focused sub-queries.
 *
 * @param {string} query
 * @returns {{ original: string, cleaned: string, subQueries: string[], isComplex: boolean }}
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

  // Complex query — decompose
  const timeParts = [...new Set((cleaned.match(TIME_PATTERNS) || []).map((s) => s.toLowerCase()))];
  const geoParts = [...new Set((cleaned.match(GEO_PATTERNS) || []).map((s) => s.toLowerCase()))];
  const envParts = [...new Set((cleaned.match(ENV_PATTERNS) || []).map((s) => s.toLowerCase()))];

  const nounPhrases = extractNounPhrases(cleaned);

  // Build sub-queries: combine concepts
  const subQueries = new Set();

  // 1. The cleaned full query (often still useful for keyword search)
  subQueries.add(cleaned);

  // 2. Multi-word noun phrases (best for Vector DB)
  nounPhrases
    .filter((p) => p.includes(' '))
    .slice(0, 6)
    .forEach((p) => subQueries.add(p));

  // 3. Geo + subject combos
  const subjects = nounPhrases.filter(
    (p) => !geoParts.includes(p) && !timeParts.includes(p) && !envParts.includes(p)
  );

  for (const geo of geoParts.slice(0, 2)) {
    for (const subj of subjects.slice(0, 3)) {
      if (!subj.includes(geo)) {
        subQueries.add(`${geo} ${subj}`);
      }
    }
  }

  // 4. Time + subject combos
  for (const time of timeParts.slice(0, 2)) {
    for (const subj of subjects.slice(0, 2)) {
      subQueries.add(`${time} ${subj}`);
    }
  }

  // 5. Environment + subject combos
  for (const env of envParts.slice(0, 2)) {
    for (const subj of subjects.slice(0, 2)) {
      subQueries.add(`${subj} ${env}`);
    }
  }

  // 6. Core single keywords as fallback
  keywords
    .filter((k) => k.length > 3)
    .slice(0, 4)
    .forEach((k) => subQueries.add(k));

  return {
    original: query,
    cleaned,
    subQueries: [...subQueries].slice(0, 10), // cap at 10 sub-queries
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
