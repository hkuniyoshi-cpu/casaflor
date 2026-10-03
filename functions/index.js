// GET / — 静的 index.html の「最新記事」枠に、記事カードを初期HTMLとして差し込む
// （これまでは JS が GAS を読んでから描画していたため、初期HTMLに記事リンクが1本も無かった）

import { getPosts, esc, fmtDate, driveImg } from '../lib/blog-data.js';

export async function onRequest(context) {
  const res = await context.next();
  const type = res.headers.get('content-type') || '';
  if (res.status !== 200 || !type.includes('text/html')) return res;

  let posts = null;
  try {
    // トップの表示を GAS の応答待ちで遅らせない。キャッシュが無ければ今回は素通しして裏で温める
    posts = await getPosts(context, { block: false });
  } catch (e) {
    posts = null;
  }
  if (!posts || !posts.length) return res;

  const cards = posts.slice(0, 4).map(p => {
    const img = driveImg(p.image, 600);
    return `<a href="/blog/${esc(p.slug)}/" class="e blog-card blog-card--journal">
      ${img ? `<div class="blog-card__img"><img src="${esc(img)}" alt="" loading="lazy"></div>` : '<div class="blog-card__img blog-card__img--noimg"></div>'}
      <div class="blog-card__body">
        <span class="blog-card__date">${esc(fmtDate(p.date))}</span>
        <h3 class="blog-card__title">${esc(p.title)}</h3>
        <span class="blog-card__cta">続きを読む →</span>
      </div>
    </a>`;
  }).join('');

  return new HTMLRewriter()
    .on('#blogWall', {
      element(el) {
        el.setAttribute('class', 'wall');
        el.setInnerContent(cards, { html: true });
      },
    })
    .transform(res);
}
