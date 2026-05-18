/*!
 * FreshPlay Arcade – Auto-Detect Skeleton Engine v1.0
 */

(function FreshPlaySkeleton() {
  'use strict';
  const CSS = /* css */`
    /* ── Shimmer keyframe ── */
    @keyframes sk-wave {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* ── Base shimmer block ── */
    .sk-pulse {
      display: block;
      background: linear-gradient(
        90deg,
        #1e1e1e 0%,
        #2c2c2c 35%,
        #242424 55%,
        #1e1e1e 100%
      );
      background-size: 200% 100%;
      animation: sk-wave 1.7s ease-in-out infinite;
    }

    /* ── Shape helpers ── */
    .sk-r  { border-radius: 3px; }
    .sk-rr { border-radius: 50%; }

    /* ─────────────────────────────────────────────────────
       CARD  (inherits parent grid — zero breakpoint code)
    ───────────────────────────────────────────────────── */
    .sk-card {
      background: #1a1a1a;
      border: 1px solid #27272a;
      border-radius: 4px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .sk-card__img { width: 100%; aspect-ratio: 16 / 9; }
    .sk-card__body { padding: 12px; display: flex; flex-direction: column; gap: 6px; }

    /* ─────────────────────────────────────────────────────
       SIMILAR  (2-col aside grid)
    ───────────────────────────────────────────────────── */
    .sk-similar__img {
      width: 100%; aspect-ratio: 16 / 9;
      border-radius: 4px; margin-bottom: 4px;
    }

    /* ─────────────────────────────────────────────────────
       TRENDING  (horizontal card)
    ───────────────────────────────────────────────────── */
    .sk-trending {
      display: flex;
      background: #1a1a1a;
      border: 1px solid #27272a;
      border-radius: 4px;
      overflow: hidden;
    }
    .sk-trending__thumb { width: 33.333%; min-height: 110px; flex-shrink: 0; }
    .sk-trending__body  {
      flex: 1; padding: 20px;
      display: flex; flex-direction: column; gap: 8px; justify-content: center;
    }

    /* ─────────────────────────────────────────────────────
       LIST-ITEM  (top-played leaderboard row)
    ───────────────────────────────────────────────────── */
    .sk-list-item { display: flex; align-items: center; gap: 16px; padding: 6px; }

    /* ─────────────────────────────────────────────────────
       CATEGORY-SECTION (explore page: header + card row)
       Breakpoints mirror the Swiper config in slider.js
    ───────────────────────────────────────────────────── */
    .sk-cat__header {
      display: flex; align-items: center; justify-content: space-between;
      border-bottom: 1px solid #27272a;
      padding-bottom: 8px; margin-bottom: 24px;
    }
    .sk-cat__arrows { display: flex; gap: 8px; }
    .sk-cat__grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
    }
    @media (min-width: 640px)  { .sk-cat__grid { grid-template-columns: repeat(2, 1fr); } }
    @media (min-width: 768px)  { .sk-cat__grid { grid-template-columns: repeat(3, 1fr); } }
    @media (min-width: 1024px) { .sk-cat__grid { grid-template-columns: repeat(4, 1fr); } }
    @media (min-width: 1280px) { .sk-cat__grid { grid-template-columns: repeat(5, 1fr); } }
  `;

  const line = (w, h, x = '') =>
    `<div class="sk-pulse sk-r" style="width:${w};height:${h}px;${x}"></div>`;

  const blk = (w, h, cls = '') =>
    `<div class="sk-pulse ${cls}" style="width:${w};height:${h}px"></div>`;

  const T = {};

  T.card = () => `
    <div class="sk-card">
      <div class="sk-pulse sk-card__img"></div>
      <div class="sk-card__body">
        ${line('72%', 13)}
        ${line('42%', 10)}
      </div>
    </div>`;

  T.similar = () => `
    <div>
      <div class="sk-pulse sk-similar__img"></div>
      ${line('78%', 11, 'margin-bottom:4px')}
      ${line('48%', 9)}
    </div>`;

  T.trending = () => `
    <div class="sk-trending">
      <div class="sk-pulse sk-trending__thumb"></div>
      <div class="sk-trending__body">
        ${line('50px', 10)}
        ${line('90%',  14)}
        ${line('100%', 11)}
        ${line('80%',  11)}
        ${line('65px', 10, 'margin-top:4px')}
      </div>
    </div>`;

  T['list-item'] = () => `
    <div class="sk-list-item">
      ${blk('32px', 38, 'sk-r')}
      ${blk('64px', 48, 'sk-r')}
      <div style="display:flex;flex-direction:column;gap:6px;flex:1">
        ${line('78%', 12)}
        ${line('44%',  9)}
      </div>
    </div>`;

  T['category-link'] = () => `
    <li style="display:flex;justify-content:space-between;align-items:center;padding:8px 4px">
      ${line('70px', 11)}
      ${line('24px', 19, 'border-radius:3px')}
    </li>`;

  T.featured = () => `
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;
                align-items:center;justify-content:center;gap:16px;background:#1a1a1a">
      ${line('110px', 15, 'border-radius:20px')}
      ${line('220px', 28)}
      ${line('155px', 28)}
      ${line('130px', 36, 'border-radius:2px;margin-top:8px')}
    </div>`;

  T['category-section'] = () => `
    <div style="margin-bottom:64px">
      <div class="sk-cat__header">
        ${line('175px', 20)}
        <div class="sk-cat__arrows">
          ${blk('28px', 28, 'sk-rr')}
          ${blk('28px', 28, 'sk-rr')}
        </div>
      </div>
      <div class="sk-cat__grid">
        ${Array(5).fill(0).map(() => T.card()).join('')}
      </div>
    </div>`;

  const CFG = {
    'card':              { count: 8,  fn: T.card              },
    'similar':           { count: 4,  fn: T.similar           },
    'trending':          { count: 2,  fn: T.trending          },
    'list-item':         { count: 5,  fn: T['list-item']      },
    'category-link':     { count: 5,  fn: T['category-link']  },
    'featured':          { count: 1,  fn: T.featured          },
    'category-section':  { count: 2,  fn: T['category-section'] },
  };

  function injectCSS() {
    if (document.getElementById('sk-css')) return;
    const s = document.createElement('style');
    s.id = 'sk-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function fill(el) {
    const type = el.dataset.skeleton;
    const cfg  = CFG[type];

    if (!cfg) {
      console.warn(`[Skeleton] Unknown type: "${type}". Valid types: ${Object.keys(CFG).join(', ')}`);
      return;
    }

    const count = parseInt(el.dataset.skeletonCount, 10) || cfg.count;

    el.innerHTML = Array(count).fill(0).map(() => cfg.fn()).join('');

    el._skActive = true;
  }

  function clear(el) {
    el._skActive = false;
  }

  function isSkeletonNode(node) {
    if (node.nodeType !== 1) return false;
    const skRoots = [
      'sk-card', 'sk-trending', 'sk-list-item', 'sk-pulse', 'sk-similar__img',
    ];
    return skRoots.some(c => node.classList.contains(c));
  }

  function watch(regions) {
    if (!regions.length) return;

    const obs = new MutationObserver(mutations => {
      mutations.forEach(m => {
        const el = m.target;
        if (!el._skActive) return;

        const hasChange =
          m.removedNodes.length > 0 ||
          [...m.addedNodes].some(n => !isSkeletonNode(n) && n.nodeType === 1);

        if (hasChange) clear(el);
      });
    });

    regions.forEach(el => obs.observe(el, { childList: true }));

    setTimeout(() => {
      regions.forEach(el => { if (el._skActive) clear(el); });
    }, 10_000);
  }

  function init() {
    injectCSS();

    const regions = [...document.querySelectorAll('[data-skeleton]')];
    if (!regions.length) return; // No regions on this page — exit silently.

    regions.forEach(fill);
    watch(regions);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();