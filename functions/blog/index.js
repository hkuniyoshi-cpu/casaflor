// GET /blog/ — 記事一覧を SSR（全記事への通常の <a href> を初期HTMLに出す）
// 旧URL /blog/?post=SLUG は記事の正規URLへ 301

import {
  SITE_URL, CATEGORIES, getPosts, unavailable, redirect, html, page, postCard, esc,
} from '../../lib/blog-data.js';

const PER_PAGE = 48;

const CSS = `
.list-head{text-align:center;padding:20px 0 28px}
.list-eyebrow{font-family:Georgia,serif;font-size:11px;letter-spacing:.3em;color:#8A6020;margin-bottom:12px}
.list-title{font-family:'Noto Serif JP',serif;font-size:clamp(24px,3.4vw,38px);font-weight:500;letter-spacing:.04em;margin-bottom:10px;word-break:keep-all;overflow-wrap:anywhere}
.list-sub{font-size:13px;color:#6B5D50;letter-spacing:.08em}
.cat-tabs{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:0 auto 8px}
.cat-tab{display:inline-block;padding:8px 16px;background:#fff;border:1px solid rgba(201,168,76,.45);border-radius:100px;font-size:12.5px;color:#6B5D50;text-decoration:none;transition:all .25s}
.cat-tab:hover{color:#C85A33;border-color:#C85A33}
.cat-tab--active{background:#C85A33;color:#fff;border-color:#C85A33;font-weight:600}
.cat-tab--active:hover{color:#fff}
.pager{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:44px}
.pager a,.pager span{min-width:44px;padding:10px 14px;text-align:center;border:1px solid rgba(201,168,76,.45);border-radius:4px;background:#fff;color:#6B5D50;text-decoration:none;font-size:13px}
.pager span{background:#2B2622;color:#FDF8F3;border-color:#2B2622}
.empty{text-align:center;padding:48px 0;color:#6B5D50}
`;

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (!url.pathname.endsWith('/')) return redirect(`/blog/${url.search}`);

  let posts;
  try {
    posts = await getPosts(context);
  } catch (e) {
    return unavailable();
  }

  const legacy = url.searchParams.get('post');
  if (legacy) {
    const hit = posts.find(p => p.slug === legacy) || posts.find(p => p.date === legacy);
    if (hit) return redirect(`/blog/${hit.slug}/`);
    return notFound();
  }

  const cat = CATEGORIES.find(c => c.slug === url.searchParams.get('cat')) || null;
  const list = cat ? posts.filter(p => p.category === cat.key) : posts;
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const n = parseInt(url.searchParams.get('page') || '1', 10);
  const cur = Number.isFinite(n) && n >= 1 ? n : 1;
  if (cur > pages) return notFound();

  const qs = (pg) => {
    const q = [];
    if (cat) q.push('cat=' + cat.slug);
    if (pg > 1) q.push('page=' + pg);
    return '/blog/' + (q.length ? '?' + q.join('&') : '');
  };
  const heading = cat ? `${cat.label}の記事一覧` : 'すべての記事一覧';
  const slice = list.slice((cur - 1) * PER_PAGE, cur * PER_PAGE);

  const tabs = `<div class="cat-tabs">
<a href="/blog/" class="cat-tab${cat ? '' : ' cat-tab--active'}">すべて (${posts.length})</a>
${CATEGORIES.map(c => {
    const cnt = posts.filter(p => p.category === c.key).length;
    // 0件のカテゴリにはリンクを張らない（空ページへクローラーを誘導しない）
    return cnt
      ? `<a href="/blog/?cat=${c.slug}" class="cat-tab${cat === c ? ' cat-tab--active' : ''}">${esc(c.label)} (${cnt})</a>`
      : '';
  }).join('\n')}
</div>`;

  let pager = '';
  if (pages > 1) {
    const items = [];
    for (let i = 1; i <= pages; i++) {
      items.push(i === cur ? `<span aria-current="page">${i}</span>` : `<a href="${qs(i)}">${i}</a>`);
    }
    pager = `<nav class="pager" aria-label="ページ送り">${items.join('')}</nav>`;
  }

  const main = `<div class="list-head">
<div class="list-eyebrow">JOURNAL — ARCHIVE</div>
<h1 class="list-title">${esc(heading)}</h1>
<p class="list-sub">全 ${list.length} 件（新しい順）${pages > 1 ? `・${cur} / ${pages} ページ` : ''}</p>
</div>
${tabs}
${slice.length
    ? `<div class="post-grid">${slice.map((p, i) => postCard(p, i < 3)).join('\n')}</div>`
    : '<p class="empty">このテーマの記事はまだありません。</p>'}
${pager}
<div class="back-wrap"><a class="back-btn" href="/">← トップへ戻る</a></div>`;

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    'name': heading,
    'url': SITE_URL + qs(cur),
    'inLanguage': 'ja',
    'isPartOf': { '@id': SITE_URL + '/#website' },
    'mainEntity': {
      '@type': 'ItemList',
      'itemListElement': slice.map((p, i) => ({
        '@type': 'ListItem',
        'position': (cur - 1) * PER_PAGE + i + 1,
        'url': `${SITE_URL}/blog/${p.slug}/`,
        'name': p.title,
      })),
    },
  };

  return html(page({
    title: `${heading}${cur > 1 ? `（${cur}ページ目）` : ''}｜Casa Flor ブログ`,
    desc: cat
      ? `株式会社カーサフロール（沖縄・名護）が発信する「${cat.label}」の記事一覧。全${list.length}件。`
      : `株式会社カーサフロール（沖縄・名護）のブログ記事一覧。ホテル美観リニューアル・施設メンテナンス・防水・沖縄の気候対策など全${list.length}件。`,
    canonical: SITE_URL + qs(cur),
    // カテゴリ絞り込みは全件一覧の部分集合なので検索結果には出さない（リンクは辿らせる）
    noindex: !!cat,
    css: CSS,
    head: `<script type="application/ld+json">${JSON.stringify(itemList).replace(/</g, '\\u003c')}</script>`,
    breadcrumb: `<a href="/">ホーム</a><span>›</span>${cat ? `<a href="/blog/">記事一覧</a><span>›</span>${esc(cat.label)}` : '記事一覧'}`,
    main,
  }));
}

function notFound() {
  return html(page({
    title: 'ページが見つかりませんでした｜Casa Flor ブログ',
    desc: 'お探しのページは見つかりませんでした。',
    canonical: SITE_URL + '/blog/',
    noindex: true,
    narrow: true,
    breadcrumb: '<a href="/">ホーム</a><span>›</span><a href="/blog/">記事一覧</a>',
    main: '<div style="text-align:center;padding:80px 0"><h1 style="font-size:22px;margin-bottom:16px">ページが見つかりませんでした</h1><p style="color:#6B5D50;margin-bottom:32px">URLが変更されたか、記事が削除された可能性があります。</p><a class="back-btn" href="/blog/">記事一覧へ</a></div>',
  }), 404, 0);
}
