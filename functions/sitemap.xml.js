// Cloudflare Pages Function — GET /sitemap.xml
// Sheets を SSoT にした動的 sitemap。GAS ?sitemap=1 のプロキシ + edge cache 1h

const GAS_URL = 'https://script.google.com/macros/s/AKfycbxn5fJlnt9smKFwgYlp25Zohq4k815Pkjl_edbAki8nDMOiFC1rXLbH4Etklg9tn9lrMg/exec';

export async function onRequest(context) {
  try {
    const res = await fetch(`${GAS_URL}?sitemap=1`, {
      redirect: 'follow', // GAS /exec は 302 する
      headers: { 'accept': 'application/xml, text/xml, */*' },
    });
    if (!res.ok) {
      return new Response(_fallbackXml(), {
        status: 200,
        headers: { 'content-type': 'application/xml; charset=utf-8' },
      });
    }
    const xml = await res.text();
    return new Response(xml, {
      headers: {
        'content-type': 'application/xml; charset=utf-8',
        'cache-control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (err) {
    return new Response(_fallbackXml(), {
      status: 200,
      headers: { 'content-type': 'application/xml; charset=utf-8' },
    });
  }
}

// GAS が落ちている場合の最小サイトマップ（固定ページのみ）
function _fallbackXml() {
  const base = 'https://casaflor.search-mania.net';
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${base}/</loc><priority>1.0</priority></url>
  <url><loc>${base}/privacy-policy.html</loc><priority>0.3</priority></url>
  <url><loc>${base}/terms.html</loc><priority>0.3</priority></url>
</urlset>`;
}
