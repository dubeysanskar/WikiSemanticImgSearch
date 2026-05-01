/**
 * POST /api/search
 * Unified search endpoint — combines keyword, semantic (Vector DB + SDC), and category search
 *
 * OPTIMIZATIONS v3:
 * - Fast initial response: keyword + semantic fire in parallel
 * - searchViaCategories now fully parallel (was sequential)
 * - Tighter timeouts: 8s semantic, 6s category fallback
 * - Keyword capped at 80 (API sweet spot), more via Load More
 * - Decomposed sub-queries capped at 2 for speed
 */

import { NextResponse } from 'next/server';
import { searchKeyword, searchByDepicts, searchViaCategories, searchByCategory } from '@/lib/commonsApi';
import { queryVectorDB, getWikidataLabels } from '@/lib/vectorDb';
import { decomposeQuery, extractSearchTerms, generateRelatedPrompts, generateCategorySuggestions } from '@/lib/queryProcessor';
import { getAuthUser } from '@/lib/auth';
import { saveSearch } from '@/lib/db';

function deduplicate(results) {
  const seen = new Set();
  return results.filter((r) => {
    const key = r.pageId || r.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Semantic search for one sub-query */
async function semanticSearchForQuery(subQuery, simThreshold = 0.10, maxQids = 5) {
  const vectorItems = await queryVectorDB(subQuery, { k: 15 });
  if (!vectorItems.length) return { results: [], labels: {} };

  const qids = vectorItems
    .filter((item) => item.QID && item.similarity_score > simThreshold)
    .sort((a, b) => (b.rrf_score || b.similarity_score) - (a.rrf_score || a.similarity_score))
    .slice(0, maxQids)
    .map((item) => item.QID);

  if (!qids.length) return { results: [], labels: {} };

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

  return { results: sdcResults, labels };
}

/** Wrap a promise with a timeout */
function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
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
      maxResults = 80,
      mediaWikiUser = '',
    } = body;

    if (!query && !category) {
      return NextResponse.json({ error: 'Query or category required' }, { status: 400 });
    }

    // Use the user's MediaWiki username for API etiquette
    if (mediaWikiUser) process.env.MEDIAWIKI_USERNAME = mediaWikiUser;

    const start = Date.now();
    let keywordResults = [];
    let semanticResults = [];
    let categoryResults = [];
    let relatedPrompts = [];
    let categorySuggestions = [];

    const decomposed = query ? decomposeQuery(query) : null;
    const cleanedTerms = query ? extractSearchTerms(query) : '';

    // ─── Fire ALL search paths in parallel ───
    const promises = [];

    // 1. Category search
    if (category) {
      promises.push(
        searchByCategory(category, {
          limit: Math.min(maxResults, 80),
          minWidth: minWidth || undefined,
          minHeight: minHeight || undefined,
          pixelTolerance,
        }).then((data) => ({ type: 'category', data }))
          .catch(() => ({ type: 'category', data: [] }))
      );
    }

    if (query) {
      // 2. Keyword search — multiple strategies for complex prompts
      if (mode === 'keyword' || mode === 'combined') {
        // Strategy A: cleaned terms (filler removed, max 6 words)
        if (cleanedTerms) {
          promises.push(
            searchKeyword(cleanedTerms, { limit: Math.min(maxResults, 40) })
              .then((data) => ({ type: 'keyword', data }))
              .catch(() => ({ type: 'keyword', data: [] }))
          );
        }

        // Strategy B: for complex queries, try the top 2-3 word sub-queries
        if (decomposed?.isComplex && decomposed.subQueries.length > 1) {
          const shortQueries = decomposed.subQueries
            .filter(sq => sq.split(' ').length <= 4 && sq !== cleanedTerms)
            .slice(0, 3);
          for (const sq of shortQueries) {
            promises.push(
              searchKeyword(sq, { limit: 20 })
                .then((data) => ({ type: 'keyword', data }))
                .catch(() => ({ type: 'keyword', data: [] }))
            );
          }
        }

        // Strategy C: if query is very different from cleaned, try original too
        if (cleanedTerms !== query.trim() && query.trim().split(' ').length <= 5) {
          promises.push(
            searchKeyword(query.trim(), { limit: 20 })
              .then((data) => ({ type: 'keyword', data }))
              .catch(() => ({ type: 'keyword', data: [] }))
          );
        }
      }

      // 3. Semantic search — max 2 sub-queries, 8s timeout
      if (mode === 'semantic' || mode === 'combined') {
        const simThreshold = decomposed?.isComplex ? 0.08 : 0.15;
        const subQueries = decomposed?.isComplex
          ? decomposed.subQueries.slice(0, 2)
          : [query];

        const semanticPromise = Promise.allSettled(
          subQueries.map((sq) =>
            semanticSearchForQuery(sq, simThreshold, 5)
              .catch(() => ({ results: [], labels: {} }))
          )
        ).then((settled) => {
          const allResults = [];
          const allLabels = {};
          for (const r of settled) {
            if (r.status === 'fulfilled') {
              allResults.push(...(r.value.results || []));
              Object.assign(allLabels, r.value.labels || {});
            }
          }
          return { type: 'semantic', data: allResults, labels: allLabels };
        });

        promises.push(
          withTimeout(semanticPromise, 8000, { type: 'semantic', data: [], labels: {} })
        );

        // Category-based semantic fallback — 6s timeout
        promises.push(
          withTimeout(
            searchViaCategories(cleanedTerms || query, { limit: 8 })
              .then((data) => ({ type: 'semantic-cat', data }))
              .catch(() => ({ type: 'semantic-cat', data: [] })),
            6000,
            { type: 'semantic-cat', data: [] }
          )
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

    // Deduplicate
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

    // Build combined
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

    // Generate related prompts & category suggestions
    const resultMeta = {
      wikidataLabels: Object.values(allLabels).map((l) => l.label).filter(Boolean),
      matchedCategories: [...new Set(semanticResults.map((r) => r.matchedCategory).filter(Boolean))],
    };

    if (query) {
      relatedPrompts = generateRelatedPrompts(query, resultMeta);
      categorySuggestions = generateCategorySuggestions(query, resultMeta);
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(2);

    // Save to history for authenticated users (non-blocking)
    try {
      const authUser = getAuthUser(request);
      if (authUser && query) {
        saveSearch(authUser.email, query, category, combined.length, elapsed).catch(() => {});
      }
    } catch (_) {}

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
