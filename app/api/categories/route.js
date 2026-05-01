/**
 * GET /api/categories?q=...
 * Search and browse Wikimedia Commons categories
 */

import { NextResponse } from 'next/server';
import { COMMONS_API } from '@/lib/config';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ categories: [] });
  }

  try {
    const url = new URL(COMMONS_API);
    url.searchParams.set('action', 'query');
    url.searchParams.set('list', 'search');
    url.searchParams.set('srsearch', q);
    url.searchParams.set('srnamespace', '14');
    url.searchParams.set('srlimit', '10');
    url.searchParams.set('format', 'json');
    url.searchParams.set('origin', '*');

    const resp = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!resp.ok) {
      return NextResponse.json({ categories: [] });
    }

    const data = await resp.json();
    const results = (data.query?.search || []).map((cat) => {
      const title = (cat.title || '').replace('Category:', '');
      return {
        title,
        label: title.replace(/_/g, ' '),
        snippet: (cat.snippet || '').replace(/<[^>]+>/g, '').slice(0, 100),
      };
    });

    return NextResponse.json({ categories: results });
  } catch (err) {
    console.warn('[Categories API] Error:', err.message);
    return NextResponse.json({ categories: [] });
  }
}
