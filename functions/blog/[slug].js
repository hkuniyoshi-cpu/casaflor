// GET /blog/{slug}/ — 記事詳細を SSR（本文・構造化データ・前後/関連記事リンクを初期HTMLに出す）

import {
  SITE_URL, SITE_NAME, AUTHOR_NAME, CATEGORIES,
  getPosts, unavailable, redirect, html, page, postCard, esc, fmtDate, driveImg,
} from '../../lib/blog-data.js';

const CSS = `
.card{background:#fff;border-radius:2px;overflow:hidden;box-shadow:0 6px 28px rgba(0,0,0,.08)}
.card>img{width:100%;height:auto;display:block;max-height:480px;object-fit:cover}
.card-body{padding:36px 38px 44px}
.cat{display:inline-block;font-size:11px;color:#C85A33;letter-spacing:.14em;font-family:'Noto Serif JP',serif;background:rgba(200,90,51,.08);padding:4px 10px;border-radius:2px;margin-bottom:12px;text-decoration:none}
.date{font-size:11px;color:#6B5D50;letter-spacing:.24em;font-family:'Noto Serif JP',serif;display:block}
.card h1{margin:14px 0 28px;font-size:22px;line-height:1.7;font-weight:600;font-family:'Noto Serif JP',serif;letter-spacing:.04em;overflow-wrap:anywhere}
.text{font-size:15px;line-height:2.05;color:#5A4E43;overflow-wrap:anywhere}
.text p{margin-bottom:1.5em}
.text h2{font-family:'Noto Serif JP',serif;font-size:18px;line-height:1.7;font-weight:600;color:#2B2622;margin:2.2em 0 1em;padding-left:14px;border-left:3px solid #C85A33}
.author-card{margin-top:36px;padding:24px;background:rgba(200,90,51,.05);border-left:3px solid #C85A33;border-radius:2px}
.author-card__label{font-size:10px;letter-spacing:.24em;color:#8A6020;font-family:'Noto Serif JP',serif}
.author-card__name{font-size:16px;font-family:'Noto Serif JP',serif;font-weight:600;margin-top:6px}
.author-card__job{font-size:12px;color:#6B5D50;margin-top:4px}
.author-card a{font-size:12px}
.prevnext{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:36px}
.prevnext a{display:block;padding:16px 18px;background:#fff;border:1px solid rgba(201,168,76,.35);border-radius:6px;text-decoration:none;color:#2B2622;font-size:13.5px;line-height:1.6;overflow-wrap:anywhere}
.prevnext a:hover{border-color:#C85A33;color:#C85A33}
.prevnext small{display:block;font-size:11px;color:#8A6020;letter-spacing:.14em;margin-bottom:6px}
.prevnext .next{text-align:right}
.related{margin-top:56px}
.related h2{font-family:'Noto Serif JP',serif;font-size:18px;font-weight:500;letter-spacing:.06em;text-align:center}
.related .post-grid{grid-template-columns:repeat(2,1fr)}
@media (max-width:600px){.card-body{padding:26px 22px 32px}.card h1{font-size:19px;margin:12px 0 22px}.text{font-size:14.5px;line-height:1.95}.prevnext{grid-template-columns:1fr}.prevnext .next{text-align:left}.related .post-grid{grid-template-columns:1fr}}
`;

export async function onRequest(context) {
  const url = new URL(context.request.url);
  let slug;
  try {
    slug = decodeURIComponent(String(context.params.slug || '')).trim();
  } catch (e) {
    slug = '';
  }
  if (!slug) return notFound('');

  let posts;
  try {
    posts = await getPosts(context);
  } catch (e) {
    // 取得できないときは「一時的な障害」と伝える（404 や別URLへの転送にしない）
    return unavailable();
  }

  const i = posts.findIndex(p => p.slug === slug);
  if (i === -1) {
    // 旧形式（日付だけのURL）はその日の記事へ寄せる
    const byDate = posts.find(p => p.date === slug);
    if (byDate) return redirect(`/blog/${byDate.slug}/`);
    return notFound(slug);
  }
  if (!url.pathname.endsWith('/')) return redirect(`/blog/${posts[i].slug}/`);

  return html(render(posts, i));
}

// プレーンテキスト本文を段落と小見出しに組み立てる
function bodyHtml(body) {
  const blocks = String(body).split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  return blocks.map((b, idx) => {
    const single = !b.includes('\n');
    const heading = single && idx > 0 && idx < blocks.length - 1 && b.length <= 45 && !/[。！？!?…]$/.test(b);
    return heading ? `<h2>${esc(b)}</h2>` : `<p>${esc(b).replace(/\n/g, '<br>')}</p>`;
  }).join('\n');
}

function pickRelated(posts, i) {
  const self = posts[i];
  const words = (self.title.match(/[一-龠々ァ-ヶー]{2,}/g) || []);
  return posts
    .map((p, j) => {
      if (j === i || Math.abs(j - i) === 1) return null; // 前後の記事は別枠で出す
      let score = p.category === self.category ? 2 : 0;
      for (const w of words) if (p.title.includes(w)) score += 1;
      return { p, score, dist: Math.abs(j - i) };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.dist - b.dist)
    .map(x => x.p)
    // 同じタイトルの記事が複数あるので、見た目が重複しないようにする
    .filter((p, k, arr) => p.title !== self.title && arr.findIndex(q => q.title === p.title) === k)
    .slice(0, 4);
}

function render(posts, i) {
  const post = posts[i];
  const canonical = `${SITE_URL}/blog/${post.slug}/`;
  const img = driveImg(post.image, 1200);
  const cat = CATEGORIES.find(c => c.key === post.category);
  const newer = posts[i - 1];
  const older = posts[i + 1];
  const related = pickRelated(posts, i);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    'headline': post.title,
    'description': post.desc,
    'image': img || `${SITE_URL}/ogp.png`,
    'author': { '@type': 'Person', '@id': `${SITE_URL}/#author-yayoi`, 'name': AUTHOR_NAME, 'url': `${SITE_URL}/#author` },
    'publisher': {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      'name': SITE_NAME,
      'logo': { '@type': 'ImageObject', 'url': `${SITE_URL}/ogp.png` },
    },
    'mainEntityOfPage': { '@type': 'WebPage', '@id': canonical },
    'inLanguage': 'ja',
    'isPartOf': { '@id': `${SITE_URL}/#blog` },
  };
  if (post.iso) { jsonLd.datePublished = post.iso; jsonLd.dateModified = post.iso; }
  if (cat) jsonLd.articleSection = cat.label;

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': 'ホーム', 'item': `${SITE_URL}/` },
      { '@type': 'ListItem', 'position': 2, 'name': '記事一覧', 'item': `${SITE_URL}/blog/` },
      { '@type': 'ListItem', 'position': 3, 'name': post.title, 'item': canonical },
    ],
  };
  const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;

  const main = `<article class="card">
${img ? `<img src="${esc(img)}" alt="${esc(post.title)}" width="1200" height="800" loading="eager">` : ''}
<div class="card-body">
${cat ? `<a class="cat" href="/blog/?cat=${cat.slug}">${esc(cat.label)}</a>` : ''}
${post.date ? `<time class="date" datetime="${esc(post.iso || post.date)}">${esc(fmtDate(post.date))}</time>` : ''}
<h1>${esc(post.title)}</h1>
<div class="text">
${bodyHtml(post.body)}
</div>
<div class="author-card">
<div class="author-card__label">監修・執筆</div>
<div class="author-card__name">${esc(AUTHOR_NAME)}</div>
<div class="author-card__job">${esc(SITE_NAME)} 代表取締役（沖縄県名護市）</div>
<a href="/#author">監修者について →</a>
</div>
</div>
</article>
<nav class="prevnext" aria-label="前後の記事">
${older ? `<a class="prev" href="/blog/${esc(older.slug)}/"><small>← 前の記事</small>${esc(older.title)}</a>` : '<span></span>'}
${newer ? `<a class="next" href="/blog/${esc(newer.slug)}/"><small>次の記事 →</small>${esc(newer.title)}</a>` : '<span></span>'}
</nav>
${related.length ? `<section class="related"><h2>あわせて読みたい記事</h2><div class="post-grid">${related.map(p => postCard(p)).join('\n')}</div></section>` : ''}
<div class="back-wrap">
<a href="/blog/" class="back-btn">記事一覧へ</a>
<a href="/" class="back-btn back-btn--accent">Casa Flor ブログトップ</a>
</div>`;

  return page({
    title: `${post.title}｜Casa Flor ブログ`,
    ogTitle: post.title,
    desc: post.desc,
    canonical,
    image: img,
    ogType: 'article',
    narrow: true,
    css: CSS,
    head: `${post.iso ? `<meta property="article:published_time" content="${esc(post.iso)}">\n` : ''}<meta name="author" content="${esc(AUTHOR_NAME)}（${esc(SITE_NAME)} 代表取締役）">
${ld(jsonLd)}
${ld(breadcrumb)}`,
    breadcrumb: `<a href="/">ホーム</a><span>›</span><a href="/blog/">記事一覧</a><span>›</span>${esc(post.title)}`,
    main,
  });
}

function notFound(slug) {
  return html(page({
    title: '記事が見つかりませんでした｜Casa Flor ブログ',
    desc: 'お探しの記事は見つかりませんでした。',
    canonical: `${SITE_URL}/blog/`,
    noindex: true,
    narrow: true,
    breadcrumb: '<a href="/">ホーム</a><span>›</span><a href="/blog/">記事一覧</a>',
    main: `<div style="text-align:center;padding:80px 0"><h1 style="font-size:22px;margin-bottom:16px">記事が見つかりませんでした</h1><p style="color:#6B5D50;margin-bottom:32px">お探しの記事${slug ? `（${esc(slug)}）` : ''}は削除されたか、URLが変更された可能性があります。</p><a class="back-btn" href="/blog/">記事一覧へ</a></div>`,
  }), 404, 0);
}
