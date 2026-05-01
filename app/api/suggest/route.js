/**
 * GET /api/suggest?q=...
 * Fast autocomplete endpoint — returns in <200ms
 * Uses MediaWiki opensearch + category search in parallel
 */

import { NextResponse } from 'next/server';
import { COMMONS_API, DEFAULTS } from '@/lib/config';

async function quickFetch(url, timeoutMs = 3000) {
  const resp = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!resp.ok) return null;
  return resp.json();
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ suggestions: [], categories: [] });
  }

  try {
    // Fire both requests in parallel for speed
    const [openSearchData, catSearchData] = await Promise.allSettled([
      // OpenSearch — fast title suggestions
      quickFetch(
        (() => {
          const url = new URL(COMMONS_API);
          url.searchParams.set('action', 'opensearch');
          url.searchParams.set('search', q);
          url.searchParams.set('namespace', '6'); // File namespace
          url.searchParams.set('limit', '6');
          url.searchParams.set('format', 'json');
          url.searchParams.set('origin', '*');
          return url;
        })(),
        2500
      ),

      // Category search — matching categories
      quickFetch(
        (() => {
          const url = new URL(COMMONS_API);
          url.searchParams.set('action', 'query');
          url.searchParams.set('list', 'search');
          url.searchParams.set('srsearch', q);
          url.searchParams.set('srnamespace', '14');
          url.searchParams.set('srlimit', '5');
          url.searchParams.set('format', 'json');
          url.searchParams.set('origin', '*');
          return url;
        })(),
        2500
      ),
    ]);

    // Parse opensearch results [query, [titles], [descriptions], [urls]]
    const suggestions = [];
    if (openSearchData.status === 'fulfilled' && openSearchData.value) {
      const titles = openSearchData.value[1] || [];
      titles.forEach((title) => {
        const clean = title.replace('File:', '').replace(/_/g, ' ');
        // Extract meaningful search terms from the filename
        const meaningful = clean.replace(/\.\w{2,4}$/, '').replace(/[-_]/g, ' ').trim();
        if (meaningful.length > 2) {
          suggestions.push(meaningful);
        }
      });
    }

    // Parse category results
    const categories = [];
    if (catSearchData.status === 'fulfilled' && catSearchData.value) {
      const results = catSearchData.value.query?.search || [];
      results.forEach((cat) => {
        const title = (cat.title || '').replace('Category:', '');
        if (title) {
          categories.push({
            title,
            label: title.replace(/_/g, ' '),
          });
        }
      });
    }

    return NextResponse.json({ suggestions: suggestions.slice(0, 6), categories: categories.slice(0, 5) });
  } catch (err) {
    console.warn('[Suggest API] Error:', err.message);
    return NextResponse.json({ suggestions: [], categories: [] });
  }
}
