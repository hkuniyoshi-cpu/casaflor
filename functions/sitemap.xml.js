// GET /sitemap.xml — 記事データから動的生成。載せるのは「200・index可・正規URL」だけ

import { SITE_URL, getPosts } from '../lib/blog-data.js';

const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function onRequest(context) {
  let posts;
  try {
    posts = await getPosts(context);
  } catch (e) {
    // 記事を落とした不完全なサイトマップを 200 で返すと Google が記事URLを見失うので 503 にする
    return new Response('sitemap temporarily unavailable', {
      status: 503,
      headers: { 'retry-after': '600', 'cache-control': 'no-store' },
    });
  }

  const latest = posts[0] && posts[0].date;
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
  const add = (loc, lastmod) => {
    lines.push('  <url>', `    <loc>${xml(SITE_URL + loc)}</loc>`);
    if (/^\d{4}-\d{2}-\d{2}$/.test(lastmod || '')) lines.push(`    <lastmod>${lastmod}</lastmod>`);
    lines.push('  </url>');
  };

  add('/', latest);
  add('/blog/', latest);
  for (const p of posts) add(`/blog/${encodeURIComponent(p.slug)}/`, p.date);
  add('/privacy-policy');
  add('/terms');
  lines.push('</urlset>');

  return new Response(lines.join('\n'), {
    headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=1800' },
  });
}
