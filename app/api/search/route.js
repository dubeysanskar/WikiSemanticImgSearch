/**
 * POST /api/search
 * Unified search endpoint — combines keyword, semantic (Vector DB + SDC), and category search
 *
 * OPTIMIZATIONS:
 * - Parallel API calls (keyword + semantic + category fire simultaneously)
 * - Query decomposition for long/complex prompts
 * - Adaptive similarity thresholds based on query complexity
 * - RRF scoring across multi-query semantic results
 * - Response enrichment with related prompts & category suggestions
 */

import { NextResponse } from 'next/server';
import { searchKeyword, searchByDepicts, searchViaCategories, searchByCategory } from '@/lib/commonsApi';
import { queryVectorDB, getWikidataLabels } from '@/lib/vectorDb';
import { decomposeQuery, extractSearchTerms, generateRelatedPrompts, generateCategorySuggestions } from '@/lib/queryProcessor';

function deduplicate(results) {
  const seen = new Set();
  return results.filter((r) => {
    const key = r.pageId || r.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Run semantic search for a single sub-query.
 * Returns { results: [], labels: {}, qids: [] }
 */
async function semanticSearchForQuery(subQuery, simThreshold = 0.15, maxQids = 12) {
  const vectorItems = await queryVectorDB(subQuery, { k: 30 });
  if (!vectorItems.length) return { results: [], labels: {}, qids: [] };

  const qids = vectorItems
    .filter((item) => item.QID && item.similarity_score > simThreshold)
    .sort((a, b) => (b.rrf_score || b.similarity_score) - (a.rrf_score || a.similarity_score))
    .slice(0, maxQids)
    .map((item) => item.QID);

  if (!qids.length) return { results: [], labels: {}, qids: [] };

  const [labels, sdcResults] = await Promise.all([
    getWikidataLabels(qids),
    searchByDepicts(qids),
  ]);

  sdcResults.forEach((r) => {
    if (r.matchedQid && labels[r.matchedQid]) {
      r.wikidataLabel = labels[r.matchedQid].label;
      r.wikidataDescription = labels[r.matchedQid].description;
    }
  });

  return { results: sdcResults, labels, qids };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      query = '',
      mode = 'combined',
      category = '',
      minWidth = null,
      minHeight = null,
      pixelTolerance = 20,
      maxResults = 40,
    } = body;

    if (!query && !category) {
      return NextResponse.json({ error: 'Query or category required' }, { status: 400 });
    }

    const start = Date.now();
    let keywordResults = [];
    let semanticResults = [];
    let categoryResults = [];
    let relatedPrompts = [];
    let categorySuggestions = [];

    // Decompose the query for better recall on long prompts
    const decomposed = query ? decomposeQuery(query) : null;
    const optimizedKeywordTerms = query ? extractSearchTerms(query) : '';

    // ─── Fire ALL search paths in parallel for speed ───
    const promises = [];

    // 1. Category search (if specified)
    if (category) {
      promises.push(
        searchByCategory(category, {
          limit: maxResults,
          minWidth: minWidth || undefined,
          minHeight: minHeight || undefined,
          pixelTolerance,
        }).then((res) => ({ type: 'category', data: res }))
      );
    }

    if (query) {
      // 2. Keyword search — use cleaned terms for better matching
      if (mode === 'keyword' || mode === 'combined') {
        promises.push(
          searchKeyword(optimizedKeywordTerms, { limit: maxResults })
            .then((res) => ({ type: 'keyword', data: res }))
        );

        // If the query was complex, also search with the original for broader coverage
        if (decomposed?.isComplex && optimizedKeywordTerms !== decomposed.cleaned) {
          promises.push(
            searchKeyword(decomposed.cleaned, { limit: Math.floor(maxResults / 2) })
              .then((res) => ({ type: 'keyword', data: res }))
          );
        }
      }

      // 3. Semantic search — multi-query approach for complex prompts
      if (mode === 'semantic' || mode === 'combined') {
        // Adaptive threshold: lower for complex queries
        const simThreshold = decomposed?.isComplex ? 0.12 : 0.20;

        if (decomposed?.isComplex) {
          // Fire semantic search for each sub-query in parallel (capped at 5)
          const subQueries = decomposed.subQueries.slice(0, 5);
          for (const sq of subQueries) {
            promises.push(
              semanticSearchForQuery(sq, simThreshold, 8)
                .then((res) => ({ type: 'semantic', data: res.results, labels: res.labels }))
                .catch(() => ({ type: 'semantic', data: [], labels: {} }))
            );
          }
        } else {
          // Simple query — single Vector DB call
          promises.push(
            semanticSearchForQuery(query, simThreshold, 12)
              .then((res) => ({ type: 'semantic', data: res.results, labels: res.labels }))
              .catch(() => ({ type: 'semantic', data: [], labels: {} }))
          );
        }

        // Category-based semantic fallback (always runs)
        promises.push(
          searchViaCategories(optimizedKeywordTerms || query)
            .then((res) => ({ type: 'semantic-cat', data: res }))
            .catch(() => ({ type: 'semantic-cat', data: [] }))
        );
      }
    }

    // ─── Await ALL in parallel ───
    const settled = await Promise.allSettled(promises);
    const allLabels = {};

    for (const result of settled) {
      if (result.status !== 'fulfilled') continue;
      const { type, data, labels } = result.value;

      switch (type) {
        case 'category':
          categoryResults.push(...(data || []));
          break;
        case 'keyword':
          keywordResults.push(...(data || []));
          break;
        case 'semantic':
          semanticResults.push(...(data || []));
          if (labels) Object.assign(allLabels, labels);
          break;
        case 'semantic-cat':
          semanticResults.push(...(data || []));
          break;
      }
    }

    // Deduplicate within each category
    keywordResults = deduplicate(keywordResults);
    semanticResults = deduplicate(semanticResults);
    categoryResults = deduplicate(categoryResults);

    // Resolution filtering
    if (minWidth || minHeight) {
      const tol = pixelTolerance;
      const filterFn = (r) => {
        const wOk = !minWidth || Math.abs(r.width - minWidth) <= tol || r.width >= minWidth;
        const hOk = !minHeight || Math.abs(r.height - minHeight) <= tol || r.height >= minHeight;
        return wOk && hOk;
      };
      keywordResults = keywordResults.filter(filterFn);
      semanticResults = semanticResults.filter(filterFn);
    }

    // Build combined (semantic first, then keyword, mark "both")
    const combined = [];
    const seenCombined = new Set();
    const keywordSet = new Set(keywordResults.map((r) => r.pageId || r.title));

    for (const r of semanticResults) {
      const key = r.pageId || r.title;
      if (!seenCombined.has(key)) {
        seenCombined.add(key);
        combined.push({ ...r, source: keywordSet.has(key) ? 'both' : 'semantic' });
      }
    }
    for (const r of keywordResults) {
      const key = r.pageId || r.title;
      if (!seenCombined.has(key)) {
        seenCombined.add(key);
        combined.push(r);
      }
    }
    for (const r of categoryResults) {
      const key = r.pageId || r.title;
      if (!seenCombined.has(key)) {
        seenCombined.add(key);
        combined.push(r);
      }
    }

    // ─── Generate intelligence: related prompts & category suggestions ───
    const resultMeta = {
      wikidataLabels: Object.values(allLabels).map((l) => l.label).filter(Boolean),
      matchedCategories: [...new Set(
        semanticResults
          .map((r) => r.matchedCategory)
          .filter(Boolean)
      )],
    };

    if (query) {
      relatedPrompts = generateRelatedPrompts(query, resultMeta);
      categorySuggestions = generateCategorySuggestions(query, resultMeta);
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(2);

    return NextResponse.json({
      keyword: keywordResults.slice(0, maxResults),
      semantic: semanticResults.slice(0, maxResults),
      category: categoryResults.slice(0, maxResults),
      combined: combined.slice(0, maxResults),
      relatedPrompts,
      categorySuggestions,
      meta: {
        query,
        mode,
        category: category || null,
        elapsed,
        isComplex: decomposed?.isComplex || false,
        subQueries: decomposed?.subQueries || [query],
        counts: {
          keyword: keywordResults.length,
          semantic: semanticResults.length,
          category: categoryResults.length,
          combined: combined.length,
        },
      },
    });
  } catch (err) {
    console.error('[Search API] Error:', err);
    return NextResponse.json({ error: 'Search failed', details: err.message }, { status: 500 });
  }
}
