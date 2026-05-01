/**
 * Wikimedia Commons API client
 * Ported patterns from jio-commons-screensaver-harvester (Python → JS)
 */

import { COMMONS_API, DEFAULTS } from './config';

function getUserAgent() {
  const username = process.env.MEDIAWIKI_USERNAME || 'WikiSemanticSearch';
  return `WikiSemanticImgSearch/1.0 (https://github.com/dubeysanskar/WikiSemanticImgSearch; MediaWiki user: ${username})`;
}

async function apiRequest(params) {
  const url = new URL(COMMONS_API);
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined) url.searchParams.set(k, String(v));
  }
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');

  const resp = await fetch(url.toString(), {
    headers: { 'User-Agent': getUserAgent(), Accept: 'application/json' },
    signal: AbortSignal.timeout(DEFAULTS.apiTimeout),
  });
  if (!resp.ok) throw new Error(`Commons API ${resp.status}`);
  return resp.json();
}

/** Clean HTML tags from text */
function cleanHtml(text) {
  if (!text) return '';
  return text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Parse a Commons API page into our result shape
 */
function parsePage(page, source) {
  if (!page || page.missing) return null;
  const info = page.imageinfo?.[0];
  if (!info) return null;
  const ext = info.extmetadata || {};
  const extVal = (k) => ext[k]?.value || '';

  const title = (page.title || '').replace('File:', '');
  const wikiTitle = (page.title || '').replace(/ /g, '_');

  return {
    pageId: page.pageid,
    title,
    thumbUrl: info.thumburl || info.url,
    fullUrl: info.url,
    pageUrl: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(wikiTitle)}`,
    width: info.width,
    height: info.height,
    author: cleanHtml(extVal('Artist') || info.user || 'Unknown'),
    license: cleanHtml(extVal('LicenseShortName') || extVal('License') || ''),
    description: cleanHtml(extVal('ImageDescription') || extVal('ObjectName') || '').slice(0, 400),
    source,
  };
}

/**
 * Standard keyword search on Commons
 */
export async function searchKeyword(query, { limit = DEFAULTS.maxResults } = {}) {
  const data = await apiRequest({
    action: 'query',
    generator: 'search',
    gsrsearch: `filetype:bitmap ${query}`,
    gsrnamespace: 6,
    gsrlimit: limit,
    prop: 'imageinfo',
    iiprop: 'url|size|extmetadata|user',
    iiurlwidth: DEFAULTS.thumbWidth,
  });
  const pages = data.query?.pages;
  if (!pages) return [];
  return Object.values(pages).map((p) => parsePage(p, 'keyword')).filter(Boolean);
}

/**
 * Search images by Structured Data "depicts" (P180) for given Q-IDs
 */
export async function searchByDepicts(qids, { limit = 6 } = {}) {
  // Fire ALL QID lookups in parallel for speed (was sequential — 30-50s → now 3-5s)
  const settled = await Promise.allSettled(
    qids.slice(0, 6).map(async (qid) => {
      const data = await apiRequest({
        action: 'query',
        generator: 'search',
        gsrsearch: `haswbstatement:P180=${qid}`,
        gsrnamespace: 6,
        gsrlimit: limit,
        prop: 'imageinfo',
        iiprop: 'url|size|extmetadata|user',
        iiurlwidth: DEFAULTS.thumbWidth,
      });
      const pages = data.query?.pages;
      if (!pages) return [];
      return Object.values(pages)
        .map((page) => {
          const parsed = parsePage(page, 'semantic');
          if (parsed) parsed.matchedQid = qid;
          return parsed;
        })
        .filter(Boolean);
    })
  );

  const results = [];
  for (const r of settled) {
    if (r.status === 'fulfilled') results.push(...r.value);
  }
  return results;
}

/**
 * Search images within a specific Commons category
 */
export async function searchByCategory(category, { limit = DEFAULTS.maxResults, minWidth, minHeight, pixelTolerance } = {}) {
  const catTitle = category.startsWith('Category:') ? category : `Category:${category}`;
  const data = await apiRequest({
    action: 'query',
    generator: 'categorymembers',
    gcmtitle: catTitle,
    gcmtype: 'file',
    gcmlimit: Math.min(limit, 100),
    prop: 'imageinfo',
    iiprop: 'url|size|extmetadata|user',
    iiurlwidth: DEFAULTS.thumbWidth,
  });
  const pages = data.query?.pages;
  if (!pages) return [];

  let results = Object.values(pages).map((p) => parsePage(p, 'category')).filter(Boolean);

  // Resolution filtering (ported from harvester)
  if (minWidth || minHeight) {
    const tol = pixelTolerance ?? DEFAULTS.pixelTolerance;
    results = results.filter((r) => {
      const wOk = !minWidth || Math.abs(r.width - minWidth) <= tol || r.width >= minWidth;
      const hOk = !minHeight || Math.abs(r.height - minHeight) <= tol || r.height >= minHeight;
      return wOk && hOk;
    });
  }

  return results;
}

/**
 * Search categories matching a query
 */
export async function searchCategories(query, { limit = 5 } = {}) {
  const data = await apiRequest({
    action: 'query',
    list: 'search',
    srsearch: query,
    srnamespace: 14,
    srlimit: limit,
  });
  return (data.query?.search || []).map((c) => ({
    title: c.title,
    snippet: cleanHtml(c.snippet),
  }));
}

/**
 * Search Commons using related categories (semantic fallback)
 */
export async function searchViaCategories(query, { limit = DEFAULTS.maxResults } = {}) {
  const cats = await searchCategories(query, { limit: 3 });
  if (!cats.length) return [];

  // Fire ALL category lookups in parallel (was sequential — much faster now)
  const settled = await Promise.allSettled(
    cats.map(async (cat) => {
      const items = await searchByCategory(cat.title.replace('Category:', ''), { limit: Math.min(limit, 8) });
      items.forEach((i) => {
        i.source = 'semantic';
        i.matchedCategory = cat.title.replace('Category:', '');
      });
      return items;
    })
  );

  const results = [];
  for (const r of settled) {
    if (r.status === 'fulfilled') results.push(...r.value);
  }
  return results;
}
