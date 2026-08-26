// Cloudflare Pages Function — GET /blog/{slug}/
// GAS ?blog_all=1 から全記事取得→スラッグで該当記事を絞り込んで SSR
// initial HTML に本文 + BlogPosting + BreadcrumbList JSON-LD 完備

const GAS_URL = 'https://script.google.com/macros/s/AKfycbxn5fJlnt9smKFwgYlp25Zohq4k815Pkjl_edbAki8nDMOiFC1rXLbH4Etklg9tn9lrMg/exec';
const SITE_URL = 'https://casaflor.search-mania.net';
const SITE_NAME = '株式会社カーサフロール';
const AUTHOR_NAME = '町田 弥生';

export async function onRequest(context) {
  const slug = context.params.slug;
  if (!slug) return _notFound();

  try {
    const res = await fetch(`${GAS_URL}?blog_all=1`, { redirect: 'follow' });
    if (!res.ok) return _fallbackToSpa(slug);
    const data = await res.json();
    const blog = Array.isArray(data && data.blog) ? data.blog : [];
    const post = _findBySlug(blog, slug);
    if (!post) return _renderNotFound(slug);
    return new Response(_renderPost(post, slug), {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=900, s-maxage=900',
      },
    });
  } catch (err) {
    return _fallbackToSpa(slug);
  }
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

function _findBySlug(blog, slug) {
  const target = decodeURIComponent(String(slug || '')).trim();
  if (!target) return null;
  for (const b of blog) {
    if (_extractSlug(b.url, b.date) === target) return b;
  }
  // フォールバック: date 一致
  for (const b of blog) {
    if (b.date === target) return b;
  }
  return null;
}

function _fallbackToSpa(slug) {
  return Response.redirect(`${SITE_URL}/blog/?post=${encodeURIComponent(slug)}`, 302);
}

function _notFound() {
  return new Response('Not Found', { status: 404 });
}

function _esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _fmtDate(s) {
  if (!s) return '';
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : String(s);
}

function _driveImg(url) {
  if (!url) return '';
  const s = String(url).trim();
  const m1 = s.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return `https://drive.google.com/thumbnail?id=${m1[1]}&sz=w1200`;
  const m2 = s.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (m2) return `https://lh3.googleusercontent.com/d/${m2[1]}=w1200`;
  return s;
}

function _extractTitle(post) {
  let t = String(post.title || '').trim();
  if (!t && post.body) t = String(post.body).split(/[。\n]/)[0].trim();
  if (!t && post.date) t = `${_fmtDate(post.date)} の投稿`;
  t = t.replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F000}-\u{1F2FF}\s]+/u, '')
       .replace(/^#\s*/, '').trim();
  return t || 'Casa Flor ブログ';
}

function _extractDesc(post) {
  const body = String(post.body || '').replace(/\s+/g, ' ').trim();
  if (!body) return '沖縄・名護の内外装仕上げのプロによる実践情報ブログ。';
  return body.length > 120 ? body.slice(0, 118) + '…' : body;
}

function _renderPost(post, slug) {
  const title = _extractTitle(post);
  const desc = _extractDesc(post);
  const img = _driveImg(post.image);
  const canonical = `${SITE_URL}/blog/${slug}/`;
  const date = post.date ? String(post.date) : '';
  const ogImg = img || `${SITE_URL}/ogp.png`;
  const body = String(post.body || '');
  const category = post.category ? String(post.category) : '';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    'headline': title,
    'description': desc,
    'image': ogImg,
    'author': { '@type': 'Person', 'name': AUTHOR_NAME, 'url': SITE_URL + '/#author-yayoi' },
    'publisher': {
      '@type': 'Organization',
      'name': SITE_NAME,
      'logo': { '@type': 'ImageObject', 'url': SITE_URL + '/favicon.svg' },
    },
    'datePublished': date,
    'dateModified': date,
    'mainEntityOfPage': { '@type': 'WebPage', '@id': canonical },
    'inLanguage': 'ja',
    'isPartOf': { '@id': SITE_URL + '/#blog' },
  };
  if (category) jsonLd.articleSection = category;

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': 'ホーム', 'item': SITE_URL + '/' },
      { '@type': 'ListItem', 'position': 2, 'name': '記事一覧', 'item': SITE_URL + '/blog/' },
      { '@type': 'ListItem', 'position': 3, 'name': title, 'item': canonical },
    ],
  };

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta http-equiv="content-language" content="ja">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${_esc(title)}｜Casa Flor ブログ</title>
<meta name="description" content="${_esc(desc)}">
<meta name="author" content="${_esc(AUTHOR_NAME)}（${_esc(SITE_NAME)} 代表取締役）">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="theme-color" content="#C85A33">
<link rel="canonical" href="${_esc(canonical)}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta property="og:type" content="article">
<meta property="og:title" content="${_esc(title)}">
<meta property="og:description" content="${_esc(desc)}">
<meta property="og:image" content="${_esc(ogImg)}">
<meta property="og:url" content="${_esc(canonical)}">
<meta property="og:site_name" content="Casa Flor ブログ">
<meta property="og:locale" content="ja_JP">
${date ? `<meta property="article:published_time" content="${_esc(date)}">` : ''}
<meta property="article:author" content="${_esc(AUTHOR_NAME)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${_esc(title)}">
<meta name="twitter:description" content="${_esc(desc)}">
<meta name="twitter:image" content="${_esc(ogImg)}">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Noto+Serif+JP:wght@400;500;600&family=Noto+Sans+JP:wght@300;400;500&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#FDF8F3;color:#2B2622;font-family:'Noto Sans JP','Hiragino Sans',sans-serif;line-height:1.85;-webkit-font-smoothing:antialiased}
header{background:#1A1614;padding:16px 20px;text-align:center;border-bottom:1px solid rgba(200,90,51,.14);position:sticky;top:0;z-index:10}
header a{color:#FDF8F3;text-decoration:none;font-size:17px;letter-spacing:.36em;font-family:'Noto Serif JP',serif;font-weight:500}
.breadcrumb{max-width:720px;margin:24px auto 0;padding:0 24px;font-size:12px;color:#8E8678;letter-spacing:.06em}
.breadcrumb a{color:#8E8678;text-decoration:none}
.breadcrumb a:hover{color:#C85A33}
.breadcrumb span{margin:0 8px;color:#C7BFB4}
.wrap{max-width:720px;margin:24px auto;padding:0 24px 80px}
.card{background:#fff;border-radius:2px;overflow:hidden;box-shadow:0 6px 28px rgba(0,0,0,.08)}
.card img{width:100%;display:block;max-height:480px;object-fit:cover}
.card-body{padding:36px 38px 44px}
.card .cat{display:inline-block;font-size:11px;color:#C85A33;letter-spacing:.18em;font-family:'Noto Serif JP',serif;background:rgba(200,90,51,.08);padding:4px 10px;border-radius:2px;margin-bottom:12px}
.card .date{font-size:11px;color:#8E8678;letter-spacing:.24em;font-family:'Noto Serif JP',serif;display:block}
.card h1{margin:14px 0 28px;font-size:22px;line-height:1.7;font-weight:600;font-family:'Noto Serif JP',serif;color:#2B2622;letter-spacing:.04em}
.card .text{font-size:15px;line-height:2.05;white-space:pre-wrap;color:#6B5D50;word-break:break-word}
.author-card{margin-top:36px;padding:24px;background:rgba(200,90,51,.05);border-left:3px solid #C85A33;border-radius:2px}
.author-card__label{font-size:10px;letter-spacing:.24em;color:#A07830;font-family:'Noto Serif JP',serif;text-transform:uppercase}
.author-card__name{font-size:16px;color:#2B2622;font-family:'Noto Serif JP',serif;font-weight:600;margin-top:6px}
.author-card__job{font-size:12px;color:#6B5D50;margin-top:4px}
.back-wrap{margin-top:52px;text-align:center;display:flex;gap:16px;justify-content:center;flex-wrap:wrap}
.back-btn{display:inline-block;padding:14px 30px;border:1.5px solid #2B2622;color:#2B2622;text-decoration:none;border-radius:1px;font-size:13px;letter-spacing:.2em;font-family:'Noto Serif JP',serif;transition:all .35s ease}
.back-btn:hover{background:#2B2622;color:#FDF8F3}
.back-btn--accent{border-color:#C85A33;color:#C85A33}
.back-btn--accent:hover{background:#C85A33;color:#fff}
.produced-by{text-align:center;margin-top:64px;font-size:10px;letter-spacing:.28em;color:rgba(43,38,34,.4);text-transform:uppercase;font-family:'Noto Serif JP',serif}
.produced-by a{color:rgba(43,38,34,.6);text-decoration:none}
.produced-by a:hover{color:#C85A33}
@media (max-width:600px){.wrap{margin:16px auto;padding:0 16px 60px}.card-body{padding:26px 22px 32px}.card h1{font-size:19px;margin:12px 0 22px}.card .text{font-size:14.5px;line-height:1.95}.breadcrumb{margin-top:16px;padding:0 16px}header a{font-size:14px;letter-spacing:.28em}.back-btn{padding:13px 22px;font-size:12px}}
</style>
</head>
<body>
<header><a href="/">Casa Flor</a></header>
<nav class="breadcrumb" aria-label="パンくずリスト">
  <a href="/">ホーム</a><span>›</span><a href="/#blog">記事一覧</a><span>›</span>${_esc(title)}
</nav>
<main class="wrap">
  <article class="card">
    ${img ? `<img src="${_esc(img)}" alt="${_esc(title)}" loading="eager">` : ''}
    <div class="card-body">
      ${category ? `<span class="cat">${_esc(category)}</span>` : ''}
      ${date ? `<span class="date">${_esc(_fmtDate(date))}</span>` : ''}
      <h1>${_esc(title)}</h1>
      <div class="text">${_esc(body)}</div>
      <div class="author-card">
        <div class="author-card__label">監修・執筆</div>
        <div class="author-card__name">${_esc(AUTHOR_NAME)}</div>
        <div class="author-card__job">${_esc(SITE_NAME)} 代表取締役</div>
      </div>
    </div>
  </article>
  <div class="back-wrap">
    <a href="/#blog" class="back-btn">← 記事一覧へ</a>
    <a href="/" class="back-btn back-btn--accent">Casa Flor ブログトップ</a>
  </div>
  <div class="produced-by">
    Produced by <a href="https://search-mania.net/" target="_blank" rel="noopener">SearchMania Inc.</a>
  </div>
</main>
</body>
</html>`;
}

function _renderNotFound(slug) {
  return new Response(`<!DOCTYPE html>
<html lang="ja"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>記事が見つかりませんでした｜Casa Flor ブログ</title>
<meta name="robots" content="noindex,follow">
<style>body{font-family:'Noto Sans JP',sans-serif;background:#FDF8F3;color:#2B2622;text-align:center;padding:120px 20px}
a{color:#C85A33}h1{font-size:22px;margin-bottom:16px}p{color:#6B5D50;margin-bottom:32px}</style>
</head><body>
<h1>記事が見つかりませんでした</h1>
<p>お探しの記事（${_esc(slug)}）は削除されたか、URLが変更された可能性があります。</p>
<p><a href="/">Casa Flor ブログトップへ →</a></p>
</body></html>`, {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}
