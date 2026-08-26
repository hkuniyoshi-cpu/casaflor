// Cloudflare Pages Function — GET /sitemap.xml
// Sheets を SSoT にした動的 sitemap。GAS ?blog_all=1 から blog データを取得して
// CF Function 側でXML生成（GAS 依存を最小化）+ edge cache 1h

const GAS_URL = 'https://script.google.com/macros/s/AKfycbxn5fJlnt9smKFwgYlp25Zohq4k815Pkjl_edbAki8nDMOiFC1rXLbH4Etklg9tn9lrMg/exec';
const SITE_URL = 'https://casaflor.search-mania.net';

export async function onRequest(context) {
  try {
    const res = await fetch(`${GAS_URL}?blog_all=1`, { redirect: 'follow' });
    if (!res.ok) return _resp(_fallbackXml());
    const data = await res.json();
    const blog = Array.isArray(data && data.blog) ? data.blog : [];
    return _resp(_buildSitemap(blog), true);
  } catch (err) {
    return _resp(_fallbackXml());
  }
}

function _resp(xml, longCache) {
  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': longCache
        ? 'public, max-age=3600, s-maxage=3600'
        : 'public, max-age=300, s-maxage=300',
    },
  });
}

function _extractSlug(url, date) {
  const s = String(url || '').trim();
  if (s) {
    const m = s.match(/\/blog\/([^\/\?#]+)/);
    if (m && m[1]) return m[1];
    const bare = s.replace(/^\/+/, '').replace(/\/+$/, '').replace(/^blog\//, '');
    if (bare && !/^https?:/i.test(bare)) return bare;
  }
  return date ? String(date) : '';
}

function _today() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function _buildSitemap(blog) {
  const now = _today();
  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');

  const staticUrls = [
    { loc: '/',                priority: '1.0', changefreq: 'daily'  },
    { loc: '/privacy-policy.html', priority: '0.3', changefreq: 'yearly' },
    { loc: '/terms.html',      priority: '0.3', changefreq: 'yearly' },
  ];
  ['case','tile','waterproof','okinawa','hotel','maintenance','women','trouble'].forEach(c => {
    staticUrls.push({ loc: `/blog/?cat=${c}`, priority: '0.7', changefreq: 'weekly' });
  });
  staticUrls.forEach(u => {
    lines.push('  <url>');
    lines.push(`    <loc>${SITE_URL}${u.loc}</loc>`);
    lines.push(`    <lastmod>${now}</lastmod>`);
    lines.push(`    <changefreq>${u.changefreq}</changefreq>`);
    lines.push(`    <priority>${u.priority}</priority>`);
    lines.push('  </url>');
  });

  const seen = new Set();
  blog.forEach(b => {
    const slug = _extractSlug(b.url, b.date);
    if (!slug || seen.has(slug)) return;
    seen.add(slug);
    lines.push('  <url>');
    lines.push(`    <loc>${SITE_URL}/blog/${slug}/</loc>`);
    if (b.date) lines.push(`    <lastmod>${b.date}</lastmod>`);
    lines.push('    <changefreq>monthly</changefreq>');
    lines.push('    <priority>0.6</priority>');
    lines.push('  </url>');
  });

  lines.push('</urlset>');
  return lines.join('\n');
}

function _fallbackXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_URL}/</loc><priority>1.0</priority></url>
</urlset>`;
}
