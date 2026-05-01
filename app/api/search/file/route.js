/**
 * GET /api/search/file?name=...
 * Special search — fetch a specific Commons file by exact filename
 */

import { NextResponse } from 'next/server';
import { COMMONS_API, DEFAULTS } from '@/lib/config';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  let name = (searchParams.get('name') || '').trim();

  if (!name) {
    return NextResponse.json({ error: 'File name required' }, { status: 400 });
  }

  // Ensure it has the File: prefix
  if (!name.startsWith('File:')) name = `File:${name}`;

  try {
    const url = new URL(COMMONS_API);
    url.searchParams.set('action', 'query');
    url.searchParams.set('titles', name);
    url.searchParams.set('prop', 'imageinfo');
    url.searchParams.set('iiprop', 'url|size|extmetadata|user');
    url.searchParams.set('iiurlwidth', String(DEFAULTS.thumbWidth));
    url.searchParams.set('format', 'json');
    url.searchParams.set('origin', '*');

    const resp = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return NextResponse.json({ error: 'API error' }, { status: 500 });
    const data = await resp.json();
    const pages = data.query?.pages;
    if (!pages) return NextResponse.json({ file: null });

    const page = Object.values(pages)[0];
    if (!page || page.missing !== undefined) {
      return NextResponse.json({ file: null, message: 'File not found on Commons' });
    }

    const info = page.imageinfo?.[0];
    if (!info) return NextResponse.json({ file: null });

    const ext = info.extmetadata || {};
    const extVal = (k) => ext[k]?.value || '';
    const cleanHtml = (t) => t ? t.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '';
    const title = (page.title || '').replace('File:', '');
    const wikiTitle = (page.title || '').replace(/ /g, '_');

    return NextResponse.json({
      file: {
        pageId: page.pageid,
        title,
        thumbUrl: info.thumburl || info.url,
        fullUrl: info.url,
        pageUrl: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(wikiTitle)}`,
        width: info.width,
        height: info.height,
        author: cleanHtml(extVal('Artist') || info.user || 'Unknown'),
        license: cleanHtml(extVal('LicenseShortName') || extVal('License') || ''),
        description: cleanHtml(extVal('ImageDescription') || '').slice(0, 400),
        source: 'special',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Search failed', details: err.message }, { status: 500 });
  }
}
