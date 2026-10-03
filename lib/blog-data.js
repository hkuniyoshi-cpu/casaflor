// functions/ から import する共通モジュール（記事データ取得・正規化・共通HTML）
// 記事データは GAS が遅い（2〜4秒）ので Cache API に保持し、古くなったら裏で更新する

export const GAS_URL = 'https://script.google.com/macros/s/AKfycbxn5fJlnt9smKFwgYlp25Zohq4k815Pkjl_edbAki8nDMOiFC1rXLbH4Etklg9tn9lrMg/exec';
export const SITE_URL = 'https://casaflor.search-mania.net';
export const SITE_NAME = '株式会社カーサフロール';
export const AUTHOR_NAME = '町田 弥生';

const CACHE_KEY = SITE_URL + '/__cache/blog-all-v5';
const FRESH_MS = 10 * 60 * 1000;
const GAS_TIMEOUT_MS = 15000;

export const CATEGORIES = [
  { slug: 'case',        key: '施工事例',     label: '施工事例' },
  { slug: 'tile',        key: 'タイル',       label: '内装のお手入れ' },
  { slug: 'waterproof',  key: '防水',         label: '防水・雨漏り対策' },
  { slug: 'okinawa',     key: '沖縄気候',     label: '沖縄の気候対策' },
  { slug: 'hotel',       key: 'ホテル',       label: 'ホテル美観リニューアル' },
  { slug: 'maintenance', key: 'メンテナンス', label: '予防型メンテナンス' },
  { slug: 'women',       key: '女性目線',     label: '女性目線のリフォーム' },
  { slug: 'trouble',     key: 'トラブル',     label: 'よくあるトラブル対応' },
];

// タイトルを優先して判定する（本文はほぼ全記事が「ホテル」に触れるため、本文の単純一致では全件ホテルになる）
const CAT_RULES = [
  { key: 'トラブル',     words: ['欠け', '浮き', '剥離', '剥がれ', 'クラック', 'ひび', 'ヒビ', '割れ', '黒ずみ', 'くすみ', 'トラブル'] },
  { key: '防水',         words: ['防水', '雨漏', '漏水', 'シーリング', 'ベランダ', '外壁補修'] },
  { key: '沖縄気候',     words: ['台風', '塩害', '湿気', '湿度', '梅雨', '雨の日', '滑'] },
  { key: 'メンテナンス', words: ['メンテナンス', '定期点検', '美観キープ', '美観維持', '営業を止めない', '稼働を止め', '営業しながら'] },
  { key: '女性目線',     words: ['女性'] },
  { key: '施工事例',     words: ['施工事例', '事例', 'ビフォーアフター'] },
  { key: 'ホテル',       words: ['ホテル', '客室', 'ロビー', 'リゾート', '宿泊'] },
  { key: 'タイル',       words: ['浴室', '壁面', '内装', '目地', 'タイル', '厨房', '床'] },
];

function categorize(title, sheetCategory) {
  const sheet = String(sheetCategory || '').trim();
  // シートで「ホテル」以外が入っていれば手入力とみなして尊重する
  if (sheet && sheet !== 'ホテル' && CATEGORIES.some(c => c.key === sheet)) return sheet;
  for (const r of CAT_RULES) {
    if (r.words.some(w => title.includes(w))) return r.key;
  }
  return sheet || '施工事例';
}

export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function fmtDate(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : String(s || '');
}

export function driveImg(url, size) {
  if (!url) return '';
  const sz = size || 1200;
  const s = String(url).trim();
  const m1 = s.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return `https://drive.google.com/thumbnail?id=${m1[1]}&sz=w${sz}`;
  const m0 = s.match(/drive\.google\.com\/thumbnail\?id=([a-zA-Z0-9_-]+)/);
  if (m0) return `https://drive.google.com/thumbnail?id=${m0[1]}&sz=w${sz}`;
  const m2 = s.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (m2) return `https://lh3.googleusercontent.com/d/${m2[1]}=w${sz}`;
  return s;
}

function extractSlug(url, date) {
  const s = String(url || '').trim();
  if (s) {
    const m = s.match(/\/blog\/([^\/\?#]+)/);
    if (m && m[1]) return m[1];
    const bare = s.replace(/^\/+/, '').replace(/\/+$/, '').replace(/^blog\//, '');
    if (bare && !/^https?:/i.test(bare) && !/[\/?#\s]/.test(bare)) return bare;
  }
  return date ? String(date) : '';
}

function cleanTitle(t) {
  return String(t || '')
    .replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F000}-\u{1F2FF}\s]+/u, '')
    .replace(/^#\s*/, '').trim();
}

function normalize(raw) {
  const seen = new Set();
  const posts = [];
  for (const b of raw) {
    if (!b || !(b.body || b.title)) continue;
    const date = String(b.date || '').slice(0, 10);
    const slug = extractSlug(b.url, date);
    // URL や属性にそのまま出すので、安全な文字だけのスラッグに限る
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(slug) || seen.has(slug)) continue;
    seen.add(slug);
    let body = String(b.body || '').replace(/\r\n?/g, '\n').trim();
    let title = cleanTitle(b.title);
    if (!title) {
      const first = body.split(/[。\n]/)[0];
      title = cleanTitle(first);
      // 本文1行目が見出しとして使われている場合は本文から外す（H1 と重複させない）
      const firstLine = body.split('\n')[0].trim();
      if (body.includes('\n') && cleanTitle(firstLine) === title) body = body.slice(body.indexOf('\n') + 1).trim();
    }
    if (!title) title = `${fmtDate(date)} の投稿`;
    const flat = body.replace(/\s+/g, ' ').trim();
    const tm = slug.match(/^\d{4}-\d{2}-\d{2}-(\d{2})(\d{2})$/);
    posts.push({
      slug, date, title, body,
      desc: flat.length > 120 ? flat.slice(0, 118) + '…' : (flat || title),
      image: String(b.image || ''),
      category: categorize(title, b.category),
      iso: date ? `${date}T${tm ? tm[1] + ':' + tm[2] : '09:00'}:00+09:00` : '',
    });
  }
  posts.sort((a, b) => (a.iso < b.iso ? 1 : a.iso > b.iso ? -1 : a.slug < b.slug ? 1 : -1));
  return posts;
}

// 同時アクセスで GAS を重複して叩かないよう、取得中の Promise を共有する
let inflight = null;
function refresh(cache) {
  if (!inflight) inflight = fetchAndStore(cache).finally(() => { inflight = null; });
  return inflight;
}

async function fetchAndStore(cache) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), GAS_TIMEOUT_MS);
  try {
    const res = await fetch(`${GAS_URL}?blog_all=1`, { redirect: 'follow', signal: ctl.signal });
    if (!res.ok) throw new Error('GAS ' + res.status);
    const data = await res.json();
    const posts = normalize(Array.isArray(data && data.blog) ? data.blog : []);
    if (!posts.length) throw new Error('GAS returned no posts');
    try {
      await cache.put(CACHE_KEY, new Response(JSON.stringify({ t: Date.now(), posts }), {
        headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=604800' },
      }));
    } catch (e) {
      // 保存に失敗しても、取得できた記事は返す
      console.error('blog cache put failed', e);
    }
    return posts;
  } finally {
    clearTimeout(timer);
  }
}

// block=false のときは、キャッシュが無ければ待たずに null を返して裏で温める
export async function getPosts(context, opts) {
  const block = !opts || opts.block !== false;
  const cache = caches.default;
  let cached = null;
  try {
    const hit = await cache.match(CACHE_KEY);
    if (hit) cached = await hit.json();
  } catch (e) { /* キャッシュ破損時は取り直す */ }
  if (cached && Array.isArray(cached.posts) && cached.posts.length) {
    if (Date.now() - cached.t > FRESH_MS) context.waitUntil(refresh(cache).catch(() => {}));
    return cached.posts;
  }
  if (!block) {
    context.waitUntil(refresh(cache).catch(() => {}));
    return null;
  }
  return refresh(cache);
}

export function unavailable() {
  return new Response('<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="robots" content="noindex"><title>一時的に表示できません</title></head><body style="font-family:sans-serif;text-align:center;padding:120px 20px"><h1 style="font-size:20px">ただいま記事を読み込めません</h1><p>少し時間をおいて、もう一度お試しください。</p><p><a href="/">トップへ戻る</a></p></body></html>', {
    status: 503,
    headers: { 'content-type': 'text/html; charset=utf-8', 'retry-after': '600', 'cache-control': 'no-store' },
  });
}

export function redirect(to, status) {
  return new Response(null, { status: status || 301, headers: { location: to } });
}

export function html(body, status, maxAge) {
  return new Response(body, {
    status: status || 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': `public, max-age=${maxAge == null ? 600 : maxAge}`,
    },
  });
}

const BASE_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{background:#FDF8F3;color:#2B2622;font-family:'Noto Sans JP','Hiragino Sans',sans-serif;line-height:1.85;-webkit-font-smoothing:antialiased}
a{color:#C85A33}
header{background:#1A1614;padding:16px 20px;text-align:center;border-bottom:1px solid rgba(200,90,51,.14);position:sticky;top:0;z-index:10}
header a{color:#FDF8F3;text-decoration:none;font-size:17px;letter-spacing:.36em;font-family:'Noto Serif JP',serif;font-weight:500}
.breadcrumb{max-width:1000px;margin:24px auto 0;padding:0 24px;font-size:12px;color:#8E8678;letter-spacing:.06em}
.breadcrumb a{color:#8E8678;text-decoration:none}
.breadcrumb a:hover{color:#C85A33}
.breadcrumb span{margin:0 8px;color:#C7BFB4}
.wrap{max-width:1000px;margin:24px auto;padding:0 24px 80px}
.narrow{max-width:720px}
.post-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:24px}
.post-item{display:flex;flex-direction:column;background:#fff;border:1px solid rgba(201,168,76,.25);border-radius:8px;overflow:hidden;box-shadow:0 6px 20px rgba(200,90,51,.08);transition:transform .3s,box-shadow .3s;color:inherit;text-decoration:none}
.post-item:hover{transform:translateY(-4px);box-shadow:0 14px 32px rgba(200,90,51,.18)}
.post-item__img{width:100%;aspect-ratio:4/3;background:linear-gradient(135deg,#F5EADB,#F5E6E6);overflow:hidden}
.post-item__img img{width:100%;height:100%;object-fit:cover;display:block}
.post-item__body{padding:18px 20px 22px;display:flex;flex-direction:column;gap:8px}
.post-item__date{font-family:Georgia,serif;font-size:12px;color:#8A6020;letter-spacing:.06em}
.post-item__title{font-family:'Noto Serif JP',serif;font-size:15px;line-height:1.6;font-weight:500;color:#2B2622;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:3;line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.post-item:hover .post-item__title{color:#C85A33}
.back-wrap{margin-top:52px;text-align:center;display:flex;gap:16px;justify-content:center;flex-wrap:wrap}
.back-btn{display:inline-block;padding:14px 30px;border:1.5px solid #2B2622;color:#2B2622;text-decoration:none;border-radius:1px;font-size:13px;letter-spacing:.2em;font-family:'Noto Serif JP',serif;transition:all .35s ease}
.back-btn:hover{background:#2B2622;color:#FDF8F3}
.back-btn--accent{border-color:#C85A33;color:#C85A33}
.back-btn--accent:hover{background:#C85A33;color:#fff}
.produced-by{text-align:center;margin-top:64px;font-size:10px;letter-spacing:.28em;color:rgba(43,38,34,.55);text-transform:uppercase;font-family:'Noto Serif JP',serif}
.produced-by a{color:rgba(43,38,34,.7);text-decoration:none}
@media (max-width:900px){.post-grid{grid-template-columns:repeat(2,1fr);gap:18px}}
@media (max-width:600px){.wrap{margin:16px auto;padding:0 16px 60px}.breadcrumb{margin-top:16px;padding:0 16px}header a{font-size:14px;letter-spacing:.28em}.post-grid{grid-template-columns:1fr}.back-btn{padding:13px 22px;font-size:12px}}
`;

export function postCard(p, eager) {
  const img = driveImg(p.image, 600);
  return `<a href="/blog/${esc(p.slug)}/" class="post-item">
<div class="post-item__img">${img ? `<img src="${esc(img)}" alt="" width="600" height="450" loading="${eager ? 'eager' : 'lazy'}">` : ''}</div>
<div class="post-item__body"><time class="post-item__date" datetime="${esc(p.date)}">${esc(fmtDate(p.date))}</time>
<h3 class="post-item__title">${esc(p.title)}</h3></div></a>`;
}

export function page(o) {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta http-equiv="content-language" content="ja">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.desc)}">
<meta name="robots" content="${o.noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large'}">
<meta name="theme-color" content="#C85A33">
<link rel="canonical" href="${esc(o.canonical)}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta property="og:type" content="${o.ogType || 'website'}">
<meta property="og:title" content="${esc(o.ogTitle || o.title)}">
<meta property="og:description" content="${esc(o.desc)}">
<meta property="og:image" content="${esc(o.image || SITE_URL + '/ogp.png')}">
<meta property="og:url" content="${esc(o.canonical)}">
<meta property="og:site_name" content="Casa Flor ブログ">
<meta property="og:locale" content="ja_JP">
<meta name="twitter:card" content="summary_large_image">
${o.head || ''}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;500;600&family=Noto+Sans+JP:wght@300;400;500&display=swap" rel="stylesheet">
<style>${BASE_CSS}${o.css || ''}</style>
</head>
<body>
<header><a href="/">Casa Flor</a></header>
<nav class="breadcrumb" aria-label="パンくずリスト">${o.breadcrumb}</nav>
<main class="wrap${o.narrow ? ' narrow' : ''}">
${o.main}
<div class="produced-by">Produced by <a href="https://search-mania.net/" target="_blank" rel="noopener">SearchMania Inc.</a></div>
</main>
</body>
</html>`;
}
