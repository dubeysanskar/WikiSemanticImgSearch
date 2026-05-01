/**
 * POST /api/search
 * Unified search endpoint — combines keyword, semantic (Vector DB + SDC), and category search
 */

import { NextResponse } from 'next/server';
import { searchKeyword, searchByDepicts, searchViaCategories, searchByCategory } from '@/lib/commonsApi';
import { queryVectorDB, getWikidataLabels } from '@/lib/vectorDb';

function deduplicate(results) {
  const seen = new Set();
  return results.filter((r) => {
    const key = r.pageId || r.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      query = '',
      mode = 'combined',       // 'keyword' | 'semantic' | 'combined'
      category = '',           // Category:Name or just Name
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

    // --- Category search ---
    if (category) {
      categoryResults = await searchByCategory(category, {
        limit: maxResults,
        minWidth: minWidth || undefined,
        minHeight: minHeight || undefined,
        pixelTolerance,
      });
    }

    if (query) {
      // --- Keyword search ---
      if (mode === 'keyword' || mode === 'combined') {
        keywordResults = await searchKeyword(query, { limit: maxResults });
      }

      // --- Semantic search (Vector DB → SDC depicts) ---
      if (mode === 'semantic' || mode === 'combined') {
        const vectorItems = await queryVectorDB(query);

        if (vectorItems.length > 0) {
          const qids = vectorItems
            .filter((item) => item.QID && item.similarity_score > 0.25)
            .sort((a, b) => (b.rrf_score || b.similarity_score) - (a.rrf_score || a.similarity_score))
            .slice(0, 12)
            .map((item) => item.QID);

          if (qids.length > 0) {
            const labels = await getWikidataLabels(qids);
            const sdcResults = await searchByDepicts(qids);

            sdcResults.forEach((r) => {
              if (r.matchedQid && labels[r.matchedQid]) {
                r.wikidataLabel = labels[r.matchedQid].label;
                r.wikidataDescription = labels[r.matchedQid].description;
              }
            });

            semanticResults.push(...sdcResults);
          }
        }

        // Fallback: category-based semantic
        const catResults = await searchViaCategories(query);
        semanticResults.push(...catResults);
        semanticResults = deduplicate(semanticResults);
      }
    }

    // Resolution filtering on keyword and semantic results
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

    const elapsed = ((Date.now() - start) / 1000).toFixed(2);

    return NextResponse.json({
      keyword: keywordResults.slice(0, maxResults),
      semantic: semanticResults.slice(0, maxResults),
      category: categoryResults.slice(0, maxResults),
      combined: combined.slice(0, maxResults),
      meta: {
        query,
        mode,
        category: category || null,
        elapsed,
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
