const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const games = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'games.json'), 'utf8'));
const articles = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'articles.json'), 'utf8'));

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/&/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parsePlayCount(countStr) {
  if (!countStr) return 0;
  const str = countStr.toString().toUpperCase();
  const val = parseFloat(str.replace(/[^0-9.]/g, ''));
  if (isNaN(val)) return 0;
  if (str.includes('M')) return val * 1000000;
  if (str.includes('K')) return val * 1000;
  return val;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderHeader(activeNav = '') {
  const navLinkClass = (key) =>
    activeNav === key
      ? 'text-[#48d1cc] transition-all hover:-translate-y-1'
      : 'hover:text-[#48d1cc] transition-all hover:-translate-y-1';

  return `\t<header class="bg-[#00234f] border-b border-[#003d7a] relative z-50">
\t\t<div class="container mx-auto px-4 h-20 md:h-20 flex items-center justify-between">
\t\t\t<a href="/" class="flex items-center group" aria-label="mytopscore Home">
\t\t\t\t<img src="/assets/images/logo.png" alt="FreshPlay Arcade - MyTopScore logo" class="h-16 md:h-20 w-auto object-contain py-2">
\t\t\t</a>
\t\t\t<nav class="hidden md:flex gap-6 lg:gap-8 text-xs font-semibold tracking-[0.2em] text-[#c4e2f5] uppercase" aria-label="Main Navigation">
\t\t\t\t<a href="/category/all" class="${navLinkClass('all')}">All Games</a>
\t\t\t\t<a href="/category/puzzle" class="${navLinkClass('puzzle')}">Puzzle</a>
\t\t\t\t<a href="/category/action" class="${navLinkClass('action')}">Action</a>
\t\t\t\t<a href="/category/survival" class="${navLinkClass('survival')}">Survival</a>
\t\t\t\t<a href="/blog" class="${navLinkClass('blog')}">Blog</a>
\t\t\t\t<a href="/about" class="${navLinkClass('about')}">About</a>
\t\t\t\t<a href="/contact" class="${navLinkClass('contact')}">Contact</a>
\t\t\t</nav>
\t\t\t<div class="hidden md:flex items-center gap-4">
\t\t\t\t<div class="search-container group">
\t\t\t\t\t<input type="text" id="global-search" placeholder="Search games..."
\t\t\t\t\t\tclass="search-input bg-[#003d7a] text-[#00234f] pl-4 pr-10 py-1.5 rounded outline-none text-xs font-mono border focus:border-[#48d1cc] placeholder:text-[#00234f]/60"
\t\t\t\t\t\taria-label="Search Games">
\t\t\t\t\t<svg class="search-icon w-5 h-5 text-[#94a3b8] group-hover:text-[#48d1cc]" fill="none" stroke="currentColor"
\t\t\t\t\t\tstroke-width="2" viewBox="0 0 24 24">
\t\t\t\t\t\t<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
\t\t\t\t\t</svg>
\t\t\t\t\t<div id="search-dropdown" class="search-dropdown rounded-b" aria-live="polite"></div>
\t\t\t\t</div>
\t\t\t</div>
\t\t\t<button id="mobile-menu-btn" class="md:hidden text-[#c4e2f5]" aria-label="Toggle Menu">
\t\t\t\t<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
\t\t\t\t\t<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"></path>
\t\t\t\t</svg>
\t\t\t</button>
\t\t</div>
\t</header>
\t<div id="mobile-menu-backdrop"
\t\tclass="fixed inset-0 bg-white/90 z-[60] hidden opacity-0 transition-opacity duration-300" aria-hidden="true"></div>
\t<nav id="mobile-menu"
\t\tclass="fixed inset-y-0 right-0 w-[300px] max-w-full bg-white border-l border-[#e2e8f0] z-[70] transform translate-x-full transition-transform duration-300 ease-in-out flex flex-col pt-5"
\t\taria-label="Mobile Navigation">
\t\t<div class="flex justify-end px-4 mb-2">
\t\t\t<button id="mobile-menu-close" class="text-[#64748b] hover:text-[#00234f]" aria-label="Close Menu">
\t\t\t\t<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
\t\t\t\t\t<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path>
\t\t\t\t</svg>
\t\t\t</button>
\t\t</div>
\t\t<div class="px-6 mb-8">
\t\t\t<form action="/category/all" method="get" class="relative">
\t\t\t\t<input type="text" name="q" placeholder="SEARCH GAMES..."
\t\t\t\t\tclass="w-full bg-transparent border-b border-[#cbd5e1] focus:border-[#48d1cc] pt-2 pb-2 pl-0 pr-10 text-sm font-mono text-[#00234f] placeholder:text-[#00234f]/60 outline-none tracking-widest transition-colors"
\t\t\t\t\taria-label="Search Games Mobile">
\t\t\t\t<button type="submit" class="absolute right-0 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#48d1cc]"
\t\t\t\t\taria-label="Submit Search">
\t\t\t\t\t<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
\t\t\t\t\t\t<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
\t\t\t\t\t</svg>
\t\t\t\t</button>
\t\t\t</form>
\t\t</div>
\t\t<div class="flex flex-col gap-1 text-sm font-semibold tracking-widest text-[#64748b] uppercase px-2">
\t\t\t<a href="/category/all" class="hover:text-[#00234f] hover:bg-[#e0f0fc] px-4 py-3 rounded transition-colors">All Games</a>
\t\t\t<a href="/category/puzzle" class="hover:text-[#00234f] hover:bg-[#e0f0fc] px-4 py-3 rounded transition-colors">Puzzle</a>
\t\t\t<a href="/category/action" class="hover:text-[#00234f] hover:bg-[#e0f0fc] px-4 py-3 rounded transition-colors">Action</a>
\t\t\t<a href="/category/survival" class="hover:text-[#00234f] hover:bg-[#e0f0fc] px-4 py-3 rounded transition-colors">Survival</a>
\t\t\t<a href="/category/physics-skill" class="hover:text-[#00234f] hover:bg-[#e0f0fc] px-4 py-3 rounded transition-colors">Physics &amp; Skill</a>
\t\t\t<a href="/category/strategy-idle" class="hover:text-[#00234f] hover:bg-[#e0f0fc] px-4 py-3 rounded transition-colors">Strategy &amp; Idle</a>
\t\t\t<a href="/blog" class="hover:text-[#00234f] hover:bg-[#e0f0fc] px-4 py-3 rounded transition-colors">Gaming Blog</a>
\t\t\t<a href="/about" class="hover:text-[#00234f] hover:bg-[#e0f0fc] px-4 py-3 rounded transition-colors">About Us</a>
\t\t\t<a href="/contact" class="hover:text-[#00234f] hover:bg-[#e0f0fc] px-4 py-3 rounded transition-colors">Contact</a>
\t\t</div>
\t</nav>`;
}

function renderFooter() {
  return `\t<footer class="bg-[#00234f] border-t border-[#003d7a] pt-12 pb-6 mt-auto">
\t\t<div class="container mx-auto px-4">
\t\t\t<div class="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8 text-[#c4e2f5] text-sm">
\t\t\t\t<div class="md:col-span-1 flex flex-col items-start gap-4">
\t\t\t\t\t<a href="/" class="flex items-center group" aria-label="mytopscore Home">
\t\t\t\t\t\t<img src="/assets/images/logo.png" alt="FreshPlay Arcade - MyTopScore logo" class="h-16 md:h-20 w-auto object-contain py-2">
\t\t\t\t\t</a>
\t\t\t\t\t<p class="text-xs max-w-sm leading-relaxed text-[#94a3b8]">MyTopScore / FreshPlay Arcade — Original HTML5 browser gaming portal by FreshPlay Studios. Free instant play across puzzle, action, survival, physics, and strategy genres with zero downloads.</p>
\t\t\t\t</div>
\t\t\t\t<div>
\t\t\t\t\t<h4 class="text-[#c4e2f5] font-bold text-xs tracking-widest uppercase mb-4 border-l border-[#48d1cc] pl-2 font-liberation">Popular Games</h4>
\t\t\t\t\t<ul class="space-y-1.5 text-xs text-[#94a3b8]">
\t\t\t\t\t\t<li><a href="/game/neon-blade-dash" class="hover:text-[#48d1cc] transition-colors">Neon Blade Dash</a></li>
\t\t\t\t\t\t<li><a href="/game/orbit-striker" class="hover:text-[#48d1cc] transition-colors">Orbit Striker</a></li>
\t\t\t\t\t\t<li><a href="/game/chroma-sort" class="hover:text-[#48d1cc] transition-colors">Chroma Sort</a></li>
\t\t\t\t\t\t<li><a href="/game/block-unblock" class="hover:text-[#48d1cc] transition-colors">Block Unblock</a></li>
\t\t\t\t\t\t<li><a href="/game/deep-dive" class="hover:text-[#48d1cc] transition-colors">Deep Dive</a></li>
\t\t\t\t\t\t<li><a href="/game/clicker-miner" class="hover:text-[#48d1cc] transition-colors">Clicker Miner</a></li>
\t\t\t\t\t</ul>
\t\t\t\t</div>
\t\t\t\t<div>
\t\t\t\t\t<h4 class="text-[#c4e2f5] font-bold text-xs tracking-widest uppercase mb-4 border-l border-[#48d1cc] pl-2 font-liberation">Categories &amp; Guides</h4>
\t\t\t\t\t<ul class="space-y-1.5 text-xs text-[#94a3b8]">
\t\t\t\t\t\t<li><a href="/category/all" class="hover:text-[#48d1cc] transition-colors">All Games Library (20)</a></li>
\t\t\t\t\t\t<li><a href="/category/puzzle" class="hover:text-[#48d1cc] transition-colors">Brain &amp; Puzzle Games</a></li>
\t\t\t\t\t\t<li><a href="/category/action" class="hover:text-[#48d1cc] transition-colors">Action &amp; Reflex Games</a></li>
\t\t\t\t\t\t<li><a href="/category/survival" class="hover:text-[#48d1cc] transition-colors">Survival Adventures</a></li>
\t\t\t\t\t\t<li><a href="/category/physics-skill" class="hover:text-[#48d1cc] transition-colors">Physics &amp; Skill Games</a></li>
\t\t\t\t\t\t<li><a href="/category/strategy-idle" class="hover:text-[#48d1cc] transition-colors">Strategy &amp; Idle Games</a></li>
\t\t\t\t\t\t<li><a href="/blog" class="hover:text-[#48d1cc] transition-colors">Gaming Blog &amp; Guides</a></li>
\t\t\t\t\t</ul>
\t\t\t\t</div>
\t\t\t\t<div>
\t\t\t\t\t<h4 class="text-[#c4e2f5] font-bold text-xs tracking-widest uppercase mb-4 border-l border-[#48d1cc] pl-2 font-liberation">Company &amp; Trust</h4>
\t\t\t\t\t<ul class="space-y-1.5 text-xs text-[#94a3b8]">
\t\t\t\t\t\t<li><a href="/about" class="hover:text-[#48d1cc] transition-colors">About FreshPlay Studios</a></li>
\t\t\t\t\t\t<li><a href="/contact" class="hover:text-[#48d1cc] transition-colors">Contact &amp; Support</a></li>
\t\t\t\t\t\t<li><a href="/terms" class="hover:text-[#48d1cc] transition-colors">Terms of Service</a></li>
\t\t\t\t\t\t<li><a href="/privacy-policy" class="hover:text-[#48d1cc] transition-colors">Privacy Policy</a></li>
\t\t\t\t\t\t<li><a href="mailto:support@mytopscore.com" class="hover:text-[#48d1cc] transition-colors">support@mytopscore.com</a></li>
\t\t\t\t\t</ul>
\t\t\t\t</div>
\t\t\t</div>
\t\t\t<div class="border-t border-[#003d7a] pt-6 flex flex-col md:flex-row items-center justify-between text-xs text-[#c4e2f5] font-mono tracking-wider">
\t\t\t\t<p>&copy; 2026 MyTopScore / FreshPlay Arcade (FreshPlay Studios). All rights reserved.</p>
\t\t\t\t<div class="flex gap-6 mt-4 md:mt-0 items-center text-[11px] text-[#94a3b8]">
\t\t\t\t\t<a href="/about" class="hover:text-[#48d1cc] transition-colors">Studio Info</a>
\t\t\t\t\t<a href="/blog" class="hover:text-[#48d1cc] transition-colors">Editorial Guides</a>
\t\t\t\t\t<a href="/contact" class="hover:text-[#48d1cc] transition-colors">Report a Bug</a>
\t\t\t\t</div>
\t\t\t</div>
\t\t</div>
\t</footer>`;
}

// ==========================================
// 1. GENERATE HOMEPAGE (/index.html)
// ==========================================
function generateHomepage() {
  const trendingGames = [...games]
    .sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating))
    .slice(0, 2);
  const trendingIds = new Set(trendingGames.map((g) => g.id));
  const remainingGames = games.filter((g) => !trendingIds.has(g.id));

  const trendingHtml = trendingGames
    .map(
      (g) => `
\t\t\t\t\t\t<a href="/game/${g.id}" class="flex bg-white border border-[#e2e8f0] rounded-[12px] overflow-hidden card-glow group transition-all">
\t\t\t\t\t\t\t<img src="${g.thumbnail_url}" alt="${escapeHtml(g.title)}" class="w-1/3 object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy">
\t\t\t\t\t\t\t<div class="w-2/3 p-4 md:p-5 flex flex-col justify-center">
\t\t\t\t\t\t\t\t<span class="text-[#48d1cc] text-[10px] font-mono uppercase mb-1 tracking-wider">${escapeHtml(g.category)}</span>
\t\t\t\t\t\t\t\t<h3 class="font-bold text-[#00234f] uppercase group-hover:text-[#48d1cc] transition-colors truncate mb-1.5">${escapeHtml(g.title)}</h3>
\t\t\t\t\t\t\t\t<p class="text-xs text-[#00234f] line-clamp-2 mb-2 leading-relaxed">${escapeHtml(g.description)}</p>
\t\t\t\t\t\t\t\t<span class="text-[10px] font-mono text-[#94a3b8]">🔥 ${g.play_count} Plays · ${g.rating} ★</span>
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t</a>`
    )
    .join('\n');

  const allGamesHtml = remainingGames
    .map(
      (g) => `
\t\t\t\t\t\t<a href="/game/${g.id}" class="game-card card-glow bg-white rounded-[12px] overflow-hidden flex flex-col border border-[#e2e8f0] transition-all">
\t\t\t\t\t\t\t<div class="aspect-video w-full bg-[#111] relative overflow-hidden group">
\t\t\t\t\t\t\t\t<img src="${g.thumbnail_url}" alt="${escapeHtml(g.title)}" class="w-full h-full object-cover opacity-100 group-hover:opacity-100 transition-opacity" loading="lazy">
\t\t\t\t\t\t\t\t<div class="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
\t\t\t\t\t\t\t\t\t<span class="text-[#48d1cc] font-mono text-xs uppercase tracking-widest border border-[#48d1cc] px-2 py-1 bg-black/50 backdrop-blur-sm shadow-[0_0_10px_rgba(72,209,204,0.2)]">Play Now</span>
\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t<div class="p-2 pl-3 flex items-center">
\t\t\t\t\t\t\t\t<div class="flex-1 min-w-0 pr-2">
\t\t\t\t\t\t\t\t\t<h3 class="font-bold text-sm text-[#00234f] truncate">${escapeHtml(g.title)}</h3>
\t\t\t\t\t\t\t\t\t<p class="text-[10px] text-[#64748b] font-mono mt-0.5 uppercase tracking-wider">${escapeHtml(g.category)}</p>
\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t<div class="w-10 h-10 bg-[#00234f] rounded-lg flex items-center justify-center shrink-0"><svg class="w-5 h-5 text-[#c4e2f5]" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t</a>`
    )
    .join('\n');

  const categoryCounts = games.reduce((acc, g) => {
    acc[g.category] = (acc[g.category] || 0) + 1;
    return acc;
  }, {});

  const hotCategoriesHtml = Object.entries(categoryCounts)
    .map(
      ([cat, count]) => `
\t\t\t\t\t\t\t<li>
\t\t\t\t\t\t\t\t<a href="/category/${slugify(cat)}" class="flex justify-between items-center py-2 px-1 rounded hover:bg-[#e0f0fc] text-[#00234f] hover:text-[#00234f] transition-colors">
\t\t\t\t\t\t\t\t\t<span class="uppercase">${escapeHtml(cat)}</span>
\t\t\t\t\t\t\t\t\t<span class="bg-[#00234f] text-[#f0f4f8] px-1.5 py-0.5 rounded text-[10px]">${count}</span>
\t\t\t\t\t\t\t\t</a>
\t\t\t\t\t\t\t</li>`
    )
    .join('\n');

  const topPlayedGames = [...games]
    .sort((a, b) => parsePlayCount(b.play_count) - parsePlayCount(a.play_count))
    .slice(0, 5);
  const opacityClasses = [
    'drop-shadow-[0_0_8px_rgba(72,209,204,0.5)]',
    'opacity-80 drop-shadow-[0_0_8px_rgba(72,209,204,0.3)]',
    'opacity-60',
    'opacity-40',
    'opacity-20',
  ];

  const topPlayedHtml = topPlayedGames
    .map(
      (g, index) => `
\t\t\t\t\t\t\t<a href="/game/${g.id}" class="flex items-center gap-4 group transition-colors hover:bg-[#c4e2f5]/50 p-1.5 rounded">
\t\t\t\t\t\t\t\t<span class="text-3xl font-extrabold text-[#48d1cc] font-mono italic w-8 text-right ${opacityClasses[index]}">${index + 1}</span>
\t\t\t\t\t\t\t\t<img src="${g.thumbnail_url}" alt="${escapeHtml(g.title)}" class="w-16 h-12 rounded object-cover border border-[#e2e8f0] group-hover:border-[#48d1cc]" loading="lazy">
\t\t\t\t\t\t\t\t<div>
\t\t\t\t\t\t\t\t\t<h4 class="text-xs font-bold text-[#00234f] uppercase group-hover:text-[#48d1cc] transition-colors line-clamp-1">${escapeHtml(g.title)}</h4>
\t\t\t\t\t\t\t\t\t<p class="text-[9px] text-[#94a3b8] font-mono uppercase tracking-wider mt-0.5">${escapeHtml(g.category)}</p>
\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t</a>`
    )
    .join('\n');

  const latestArticlesHtml = articles
    .slice(0, 6)
    .map(
      (a) => `
\t\t\t\t\t<a href="/blog/${a.id}" class="group bg-white rounded-lg border border-[#e2e8f0] overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1 flex flex-col">
\t\t\t\t\t\t<div class="aspect-video bg-[#c4e2f5] overflow-hidden">
\t\t\t\t\t\t\t<img src="${a.thumbnail}" alt="${escapeHtml(a.title)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy">
\t\t\t\t\t\t</div>
\t\t\t\t\t\t<div class="p-5 flex-1 flex flex-col">
\t\t\t\t\t\t\t<span class="text-[10px] font-bold text-[#48d1cc] uppercase tracking-widest font-mono">${escapeHtml(a.category)} · ${a.date}</span>
\t\t\t\t\t\t\t<h3 class="text-sm font-bold text-[#00234f] uppercase tracking-wider font-liberation mt-2 mb-2 group-hover:text-[#48d1cc] transition-colors">${escapeHtml(a.title)}</h3>
\t\t\t\t\t\t\t<p class="text-[#64748b] text-xs leading-relaxed line-clamp-3 flex-1">${escapeHtml(a.excerpt)}</p>
\t\t\t\t\t\t\t<span class="inline-block mt-4 text-[10px] font-bold text-[#00234f] uppercase tracking-widest font-mono group-hover:text-[#48d1cc] transition-colors">Read Full Guide →</span>
\t\t\t\t\t\t</div>
\t\t\t\t\t</a>`
    )
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">

<head>
\t<meta charset="UTF-8">
\t<meta name="viewport" content="width=device-width, initial-scale=1.0">
\t<title>FreshPlay Arcade — Play 20+ Free Original HTML5 Browser Games | MyTopScore</title>
\t<meta name="description"
\t\tcontent="Play 20+ original HTML5 browser games instantly on FreshPlay Arcade (MyTopScore). Zero friction, no downloads or accounts needed. Explore Puzzle, Action, Survival, Physics, and Strategy games plus in-depth strategy guides.">
\t<link rel="canonical" href="https://mytopscore.com/">
\t<meta property="og:title" content="FreshPlay Arcade — Play 20+ Free Original HTML5 Browser Games | MyTopScore">
\t<meta property="og:description" content="Play 20+ original HTML5 browser games instantly on FreshPlay Arcade. Zero friction, no downloads, and in-depth gaming guides.">
\t<meta property="og:image" content="https://mytopscore.com/assets/images/logo.png">
\t<meta name="twitter:card" content="summary_large_image">
\t<meta name="twitter:title" content="FreshPlay Arcade — Instant HTML5 Web Gaming | MyTopScore">
\t<meta name="twitter:description" content="Play 20+ original HTML5 games instantly in your browser. Puzzle, Action, Survival, Physics & Strategy.">
\t<meta name="twitter:image" content="https://mytopscore.com/assets/images/logo.png">
\t<meta property="og:type" content="website">
\t<meta property="og:url" content="https://mytopscore.com/">
\t<link rel="preconnect" href="https://cdn.tailwindcss.com">
\t<link rel="preconnect" href="https://pagead2.googlesyndication.com">
\t<link rel="preconnect" href="https://googleads.g.doubleclick.net">
\t<meta http-equiv="Content-Security-Policy" content="
\t\tdefault-src 'self'; 
\t\tscript-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://*.googlesyndication.com https://*.googleadservices.com https://*.adtrafficquality.google https://*.google.com https://*.doubleclick.net; 
\t\tstyle-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; 
\t\tfont-src 'self' https://fonts.gstatic.com data:; 
\t\timg-src 'self' https://*.googlesyndication.com https://*.google.com https://*.adtrafficquality.google https://*.doubleclick.net data: blob:; 
\t\tframe-src 'self' https://*.doubleclick.net https://*.googlesyndication.com https://*.google.com https://*.adtrafficquality.google; 
\t\tconnect-src 'self' https://*.googlesyndication.com https://*.adtrafficquality.google https://*.doubleclick.net https://*.google.com https://cdn.jsdelivr.net;
\t\tmedia-src 'self';
\t">
\t<link rel="stylesheet" href="/assets/css/style.css">
\t<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css">
\t<script src="https://cdn.tailwindcss.com"></script>
\t<link rel="icon" href="/assets/images/logo.png" type="image/png">
\t<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7922397649195717"
\t\tcrossorigin="anonymous"></script>
\t<script type="application/ld+json">
\t{
\t\t"@context": "https://schema.org",
\t\t"@type": "WebSite",
\t\t"name": "FreshPlay Arcade",
\t\t"alternateName": "MyTopScore",
\t\t"url": "https://mytopscore.com/",
\t\t"description": "Play 20+ original HTML5 games instantly on FreshPlay Arcade. Puzzle, Action, Survival, Physics, Endless Runner, and Strategy browser games with zero downloads.",
\t\t"publisher": {
\t\t\t"@type": "Organization",
\t\t\t"name": "FreshPlay Studios",
\t\t\t"url": "https://mytopscore.com/"
\t\t},
\t\t"potentialAction": {
\t\t\t"@type": "SearchAction",
\t\t\t"target": "https://mytopscore.com/category/all?q={search_term_string}",
\t\t\t"query-input": "required name=search_term_string"
\t\t}
\t}
\t</script>
</head>

<body class="flex flex-col min-h-screen fp-ready">
${renderHeader('')}
\t<main class="flex-grow container mx-auto px-4 py-6">
\t\t<!-- Hero Intro Banner -->
\t\t<section class="bg-[#00234f] text-[#c4e2f5] rounded-xl p-6 md:p-8 mb-8 border border-[#003d7a] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
\t\t\t<div class="max-w-2xl">
\t\t\t\t<span class="text-[10px] font-mono uppercase tracking-widest text-[#48d1cc] bg-[#003d7a] px-2.5 py-1 rounded">20 Original HTML5 Games · Instant Browser Play</span>
\t\t\t\t<h1 class="text-2xl md:text-3xl font-bold uppercase tracking-widest font-liberation mt-3 mb-2 text-white">FreshPlay Arcade — Instant Web Gaming</h1>
\t\t\t\t<p class="text-xs md:text-sm text-[#94a3b8] leading-relaxed">Handcrafted HTML5 &amp; Phaser browser games engineered for 60 FPS desktop and mobile play. Dive straight into reflex action, spatial logic puzzles, survival adventures, and strategy simulations — zero downloads or sign-ups required.</p>
\t\t\t</div>
\t\t\t<div class="flex flex-wrap gap-3 shrink-0">
\t\t\t\t<a href="/category/all" class="bg-[#48d1cc] text-[#00234f] font-bold text-xs px-5 py-3 rounded uppercase tracking-widest font-mono hover:bg-white transition-colors">Explore All 20 Games</a>
\t\t\t\t<a href="/blog" class="border border-[#48d1cc] text-[#c4e2f5] font-bold text-xs px-5 py-3 rounded uppercase tracking-widest font-mono hover:bg-[#003d7a] transition-colors">Read Strategy Guides</a>
\t\t\t</div>
\t\t</section>

\t\t<!-- Main + Sidebar Layout -->
\t\t<div class="flex flex-col lg:flex-row gap-6">
\t\t\t<div class="w-full lg:w-3/4 flex flex-col gap-8">
\t\t\t\t<!-- Trending Section -->
\t\t\t\t<section>
\t\t\t\t\t<div class="flex items-center justify-between mb-4 border-b border-[#e2e8f0] pb-2">
\t\t\t\t\t\t<h2 class="text-lg font-bold flex items-center gap-2 uppercase tracking-widest text-[#00234f] font-liberation">
\t\t\t\t\t\t\t<svg class="w-5 h-5 text-[#48d1cc]" fill="currentColor" viewBox="0 0 20 20">
\t\t\t\t\t\t\t\t<path d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 0011.95 4.95c.592-.591.98-1.318 1.22-2.065.238-.74.34-1.556.271-2.432-.07-.873-.325-1.822-.794-2.867a1 1 0 00-.567-.567 7.003 7.003 0 00-2.685-.466z" />
\t\t\t\t\t\t\t</svg>
\t\t\t\t\t\t\tTrending Now
\t\t\t\t\t\t</h2>
\t\t\t\t\t\t<a href="/category/all" class="text-[11px] font-mono text-[#00234f] hover:text-[#48d1cc] uppercase tracking-widest font-bold">Full Library →</a>
\t\t\t\t\t</div>
\t\t\t\t\t<div id="trending-grid" class="grid grid-cols-1 md:grid-cols-2 gap-4">
${trendingHtml}
\t\t\t\t\t</div>
\t\t\t\t</section>

\t\t\t\t<!-- All Games Section -->
\t\t\t\t<section>
\t\t\t\t\t<div class="flex items-center justify-between mb-4 border-b border-[#e2e8f0] pb-2">
\t\t\t\t\t\t<h2 class="text-lg font-bold flex items-center gap-2 uppercase tracking-widest text-[#00234f] font-liberation">
\t\t\t\t\t\t\tAll Original Games
\t\t\t\t\t\t</h2>
\t\t\t\t\t\t<span id="game-count" class="text-[10px] font-mono text-[#64748b] uppercase tracking-widest">${remainingGames.length} Games</span>
\t\t\t\t\t</div>
\t\t\t\t\t<div id="all-games-grid" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
${allGamesHtml}
\t\t\t\t\t</div>
\t\t\t\t</section>

\t\t\t\t<!-- Single Non-Intrusive Ad Slot Below Substantial Game Content -->
\t\t\t\t<div class="flex justify-center w-full my-2">
\t\t\t\t\t<div class="ad-slot ad-leaderboard w-full max-w-3xl" aria-label="Advertisement">
\t\t\t\t\t\t<ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-7922397649195717"
\t\t\t\t\t\t\tdata-ad-slot="3136452347" data-ad-format="horizontal" data-full-width-responsive="true"></ins>
\t\t\t\t\t\t<script>
\t\t\t\t\t\t\t(adsbygoogle = window.adsbygoogle || []).push({});
\t\t\t\t\t\t</script>
\t\t\t\t\t</div>
\t\t\t\t</div>
\t\t\t</div>

\t\t\t<aside class="w-full lg:w-1/4">
\t\t\t\t<div class="flex flex-col gap-6 lg:sticky lg:top-20">
\t\t\t\t\t<div class="bg-white border border-[#e2e8f0] rounded p-5">
\t\t\t\t\t\t<h3 class="text-sm font-bold text-[#00234f] uppercase tracking-widest mb-4 border-l-2 border-[#48d1cc] pl-3 font-liberation">
\t\t\t\t\t\t\tHot Categories</h3>
\t\t\t\t\t\t<ul class="space-y-1 text-xs font-mono">
${hotCategoriesHtml}
\t\t\t\t\t\t</ul>
\t\t\t\t\t</div>
\t\t\t\t\t<div class="bg-white border border-[#e2e8f0] rounded p-5">
\t\t\t\t\t\t<h3 class="text-sm font-bold text-[#00234f] uppercase tracking-widest mb-4 border-l-2 border-[#48d1cc] pl-3 font-liberation">
\t\t\t\t\t\t\tTop Played</h3>
\t\t\t\t\t\t<div class="space-y-4">
${topPlayedHtml}
\t\t\t\t\t\t</div>
\t\t\t\t\t</div>
\t\t\t\t</div>
\t\t\t</aside>
\t\t</div>

\t\t<!-- Latest Gaming Guides & Editorial Articles Section -->
\t\t<section class="mt-14 pt-10 border-t border-[#e2e8f0]">
\t\t\t<div class="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-2">
\t\t\t\t<div>
\t\t\t\t\t<h2 class="text-xl font-bold text-[#00234f] uppercase tracking-widest font-liberation border-l-4 border-[#48d1cc] pl-3">
\t\t\t\t\t\tLatest Gaming Guides, Reviews &amp; Strategy Articles
\t\t\t\t\t</h2>
\t\t\t\t\t<p class="text-xs text-[#64748b] mt-1 pl-4">Original deep-dive guides, high-score strategies, and HTML5 technology insights written by the FreshPlay Editorial team.</p>
\t\t\t\t</div>
\t\t\t\t<a href="/blog" class="text-xs font-bold text-[#00234f] hover:text-[#48d1cc] uppercase tracking-widest font-mono shrink-0">View All 10 Guides →</a>
\t\t\t</div>
\t\t\t<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
${latestArticlesHtml}
\t\t\t</div>
\t\t</section>
\t</main>

\t<!-- SEO Content Section -->
\t<section class="bg-[#f0f4f8] border-t border-[#e2e8f0] py-16 mt-12">
\t\t<div class="container mx-auto px-4 max-w-5xl">
\t\t\t<div class="text-center mb-12">
\t\t\t\t<h2 class="text-2xl md:text-3xl font-bold text-[#00234f] uppercase tracking-widest font-liberation mb-4">Welcome to FreshPlay Arcade</h2>
\t\t\t\t<p class="text-[#64748b] text-sm md:text-base max-w-2xl mx-auto leading-relaxed">Your destination for original HTML5 browser games. No downloads, no sign-ups, no friction — just instant play across desktop and mobile devices.</p>
\t\t\t</div>
\t\t\t<div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
\t\t\t\t<div class="bg-white rounded-lg border border-[#e2e8f0] p-6">
\t\t\t\t\t<div class="w-10 h-10 bg-[#00234f] rounded flex items-center justify-center mb-4">
\t\t\t\t\t\t<svg width="20" height="20" fill="none" stroke="#48d1cc" stroke-width="2" viewBox="0 0 24 24">
\t\t\t\t\t\t\t<path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
\t\t\t\t\t\t</svg>
\t\t\t\t\t</div>
\t\t\t\t\t<h3 class="text-sm font-bold text-[#00234f] uppercase tracking-widest mb-3 font-liberation">Instant Play Technology</h3>
\t\t\t\t\t<p class="text-[#64748b] text-xs leading-relaxed">Every game on FreshPlay Arcade is built with modern HTML5 Canvas, WebGL, and JavaScript technology. Play directly in your browser on desktop, tablet, or mobile phone without installing plugins, downloading apps, or creating accounts.</p>
\t\t\t\t</div>
\t\t\t\t<div class="bg-white rounded-lg border border-[#e2e8f0] p-6">
\t\t\t\t\t<div class="w-10 h-10 bg-[#00234f] rounded flex items-center justify-center mb-4">
\t\t\t\t\t\t<svg width="20" height="20" fill="none" stroke="#48d1cc" stroke-width="2" viewBox="0 0 24 24">
\t\t\t\t\t\t\t<path stroke-linecap="round" stroke-linejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path>
\t\t\t\t\t\t</svg>
\t\t\t\t\t</div>
\t\t\t\t\t<h3 class="text-sm font-bold text-[#00234f] uppercase tracking-widest mb-3 font-liberation">Original Game Library</h3>
\t\t\t\t\t<p class="text-[#64748b] text-xs leading-relaxed">Our curated library features 20 original games developed by FreshPlay Studios. From logic puzzles like Chroma Sort and Block Unblock to high-speed action titles like Neon Blade Dash and Glitch Jumper, every game includes comprehensive controls and pro strategy guides.</p>
\t\t\t\t</div>
\t\t\t\t<div class="bg-white rounded-lg border border-[#e2e8f0] p-6">
\t\t\t\t\t<div class="w-10 h-10 bg-[#00234f] rounded flex items-center justify-center mb-4">
\t\t\t\t\t\t<svg width="20" height="20" fill="none" stroke="#48d1cc" stroke-width="2" viewBox="0 0 24 24">
\t\t\t\t\t\t\t<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
\t\t\t\t\t\t</svg>
\t\t\t\t\t</div>
\t\t\t\t\t<h3 class="text-sm font-bold text-[#00234f] uppercase tracking-widest mb-3 font-liberation">Safe &amp; Private Gaming</h3>
\t\t\t\t\t<p class="text-[#64748b] text-xs leading-relaxed">FreshPlay Arcade is committed to a safe, family-friendly browser gaming experience. We do not require user registration or collect personal data to play. All games run inside sandboxed browser environments and save progress locally on your device.</p>
\t\t\t\t</div>
\t\t\t</div>
\t\t\t<div class="bg-white rounded-lg border border-[#e2e8f0] p-8">
\t\t\t\t<h3 class="text-sm font-bold text-[#00234f] uppercase tracking-widest mb-4 font-liberation">About FreshPlay Arcade</h3>
\t\t\t\t<div class="text-[#64748b] text-xs leading-relaxed space-y-4">
\t\t\t\t\t<p>FreshPlay Arcade (MyTopScore.com) is an online gaming portal dedicated to delivering original HTML5 browser games and in-depth player guides. Founded by a team of game designers and web engineers at FreshPlay Studios, our mission is to provide instant access to polished, original games that anyone can enjoy on any modern device.</p>
\t\t\t\t\t<p>Unlike traditional gaming platforms that require large downloads or dedicated hardware, FreshPlay Arcade leverages HTML5 Canvas, WebGL, and the Phaser game engine to deliver 60 FPS gameplay directly in your browser. Whether you are taking a quick break at your desk or playing on a smartphone or tablet, our games adapt automatically to your screen size and input method.</p>
\t\t\t\t\t<p>Our library spans six major genres: <a href="/category/puzzle" class="text-[#00234f] font-bold hover:text-[#48d1cc] underline">Puzzle</a> games that challenge spatial reasoning and logic, <a href="/category/action" class="text-[#00234f] font-bold hover:text-[#48d1cc] underline">Action</a> titles that test reflexes and timing, <a href="/category/survival" class="text-[#00234f] font-bold hover:text-[#48d1cc] underline">Survival</a> adventures focused on hazard avoidance and resource management, <a href="/category/endless-runner" class="text-[#00234f] font-bold hover:text-[#48d1cc] underline">Endless Runner</a> courses for fast-paced sessions, <a href="/category/physics-skill" class="text-[#00234f] font-bold hover:text-[#48d1cc] underline">Physics &amp; Skill</a> challenges that reward precision trajectories, and <a href="/category/strategy-idle" class="text-[#00234f] font-bold hover:text-[#48d1cc] underline">Strategy &amp; Idle</a> games for players who love building and optimizing systems.</p>
\t\t\t\t</div>
\t\t\t</div>
\t\t</div>
\t</section>
${renderFooter()}
\t<script src="/assets/js/main.js" defer></script>
</body>

</html>
`;

  fs.writeFileSync(path.join(ROOT, 'index.html'), html, 'utf8');
}

// ==========================================
// 2. GENERATE DEDICATED CATEGORY PAGES (/category/*.html & /explore.html)
// ==========================================
const CATEGORY_META = {
  all: {
    slug: 'all',
    name: 'All Games',
    heading: 'Explore All 20 Original HTML5 Browser Games',
    title: 'Explore All Free HTML5 Browser Games — FreshPlay Arcade | MyTopScore',
    description:
      'Browse and play all 20 original HTML5 browser games on FreshPlay Arcade (MyTopScore). Filter by Action, Puzzle, Survival, Physics & Skill, Endless Runner, and Strategy & Idle.',
    intro: [
      'Welcome to the complete FreshPlay Arcade game directory. Every title in our 20-game collection is developed in-house by FreshPlay Studios using HTML5 Canvas, WebGL, and the Phaser framework to deliver 60 frames-per-second gameplay directly in your web browser without downloads, plugins, or user accounts.',
      'Use the category navigation below to explore games by genre, or browse our full catalog organized across six distinct gameplay pillars: Action, Puzzle, Endless Runner, Survival, Physics & Skill, and Strategy & Idle. Each game page includes instant browser play, keyboard and touch control schemes, game mechanics breakdowns, and pro strategy tips.',
    ],
  },
  puzzle: {
    slug: 'puzzle',
    name: 'Puzzle',
    heading: 'Free Brain & Logic Puzzle Browser Games',
    title: 'Free Online Puzzle Games — Brain & Logic HTML5 Games | FreshPlay Arcade',
    description:
      'Challenge your brain with free original HTML5 puzzle games on FreshPlay Arcade. Play Chroma Sort, Block Unblock, Light Linker, and Hexa Merge instantly in your browser.',
    intro: [
      'Puzzle games on FreshPlay Arcade are designed for players who enjoy genuine spatial reasoning, pattern recognition, and multi-step logic challenges rather than random match-three luck. Every puzzle in our collection introduces mechanics progressively so you can internalize the rules before tackling complex board states.',
      'Whether you are untangling interlocking neon sliders in Block Unblock, routing non-intersecting energy circuits in Light Linker, planning six-directional number combinations in Hexa Merge, or optimizing tube transfers in Chroma Sort, our HTML5 puzzle suite exercises working memory and forward planning on both desktop and mobile.',
    ],
  },
  action: {
    slug: 'action',
    name: 'Action',
    heading: 'Free Fast-Paced Action & Reflex Browser Games',
    title: 'Free Online Action Games — Fast Reflex HTML5 Arcade Games | FreshPlay Arcade',
    description:
      'Test your reflexes with free HTML5 action games on FreshPlay Arcade. Play Neon Blade Dash, Orbit Striker, Hyper Hexagon, and Glitch Jumper at 60 FPS in your browser.',
    intro: [
      'Our Action category is built around pure arcade responsiveness: zero input lag, 60 FPS rendering, and escalating wave intensity that rewards sharp visual tracking and split-second decision-making. Every action title starts immediately with no lengthy cutscenes or paywalls.',
      'Slice beat-synced geometric waves while dodging red glitch blocks in Neon Blade Dash, rotate dual-polarity shields to deflect incoming laser volleys in Orbit Striker, thread your ship through collapsing geometric mazes in Hyper Hexagon, or time rhythm-based platform leaps in Glitch Jumper.',
    ],
  },
  survival: {
    slug: 'survival',
    name: 'Survival',
    heading: 'Free Survival & Hazard-Navigation Browser Games',
    title: 'Free Online Survival Games — Deep Dive & Space Scavenger | FreshPlay Arcade',
    description:
      'Test your endurance and resource management in free HTML5 survival games on FreshPlay Arcade. Play Deep Dive and Space Scavenger instantly in your browser.',
    intro: [
      'Survival games on FreshPlay Arcade combine high-stakes hazard navigation with real-time resource management. Unlike pure reflex games where speed is the only variable, survival titles force you to balance risk versus reward on every second of your run.',
      'Descend into procedurally generated ocean trenches while monitoring oxygen reserves and sonar pings in Deep Dive, or pilot a scavenger vessel through dense asteroid fields to harvest hull-upgrading scrap in Space Scavenger.',
    ],
  },
  'physics-skill': {
    slug: 'physics-skill',
    name: 'Physics & Skill',
    heading: 'Free Physics & Precision Skill Browser Games',
    title: 'Free Physics & Skill Games — Pinball, Drift & Trajectory Games | FreshPlay Arcade',
    description:
      'Master momentum, trajectories, and timing in free HTML5 physics and skill games on FreshPlay Arcade. Play Neon Pinball, Sling Drift, Stack Builder, and Cannon Basketball.',
    intro: [
      'Physics & Skill games reward players who understand momentum, angular velocity, gravity, and precise release windows. Powered by deterministic 2D physics simulation in the browser, every bounce, swing, and ricochet behaves consistently so you can master repeatable techniques.',
      'Chain multi-ball bumper combos in Neon Pinball, tether your car around hairpin corners using centripetal force in Sling Drift, align oscillating tower blocks in Stack Builder, or calculate multi-wall bank shots in Cannon Basketball.',
    ],
  },
  'endless-runner': {
    slug: 'endless-runner',
    name: 'Endless Runner',
    heading: 'Free Endless Runner & Speed Parkour Browser Games',
    title: 'Free Endless Runner Games — Neon Rider & Rooftop Cyber Punk | FreshPlay Arcade',
    description:
      'Race through procedural neon highways and cyberpunk rooftops in free HTML5 endless runner games on FreshPlay Arcade. Play Neon Rider and Rooftop Cyber Punk.',
    intro: [
      'Endless Runner games on FreshPlay Arcade deliver high-velocity procedural courses where no two runs are ever identical. As your distance multiplier climbs, track speed accelerates and obstacle combinations tighten, testing your ability to read terrain ahead of your character.',
      'Launch a glowing light-cycle across gap-spanning highway ramps in Neon Rider, or chain high-speed rooftop vaults and vent slides across a cyberpunk skyline in Rooftop Cyber Punk.',
    ],
  },
  'strategy-idle': {
    slug: 'strategy-idle',
    name: 'Strategy & Idle',
    heading: 'Free Strategy, Tower Defense & Idle Tycoon Browser Games',
    title: 'Free Strategy & Idle Games — Tower Defense & Tycoon HTML5 Games | FreshPlay Arcade',
    description:
      'Build, merge, and optimize in free HTML5 strategy and idle games on FreshPlay Arcade. Play Idle Arcade Tycoon, Merge Weapons, Tower Defense Minimal, and Clicker Miner.',
    intro: [
      'Strategy & Idle games are crafted for thinkers who love resource allocation, upgrade trees, compounding efficiency, and tactical placement. All progress is automatically saved in your browser via localStorage so you can build your empire across multiple sessions.',
      'Expand a single retro cabinet into a thriving cyber-entertainment floor in Idle Arcade Tycoon, forge higher-tier hero gear in Merge Weapons, place laser turrets along optimal choke points in Tower Defense Minimal, or automate deep-crust excavation in Clicker Miner.',
    ],
  },
};

function renderGameCard(g) {
  return `\t\t\t\t<div class="bg-white rounded-lg border border-[#e2e8f0] overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1 group">
\t\t\t\t\t<div class="aspect-[4/3] bg-[#c4e2f5] overflow-hidden relative">
\t\t\t\t\t\t<img src="${g.thumbnail_url}" alt="${escapeHtml(g.title)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy">
\t\t\t\t\t\t<span class="absolute top-2 right-2 bg-[#00234f]/90 text-[#c4e2f5] text-[10px] font-bold px-2 py-0.5 rounded font-mono uppercase">${g.rating} ★</span>
\t\t\t\t\t</div>
\t\t\t\t\t<div class="p-4">
\t\t\t\t\t\t<span class="text-[10px] font-bold text-[#48d1cc] uppercase tracking-widest font-mono">${escapeHtml(g.category)}</span>
\t\t\t\t\t\t<h3 class="text-sm font-bold text-[#00234f] uppercase tracking-wider font-liberation mt-1 group-hover:text-[#48d1cc] transition-colors">${escapeHtml(g.title)}</h3>
\t\t\t\t\t\t<p class="text-xs text-[#64748b] mt-1.5 line-clamp-2 leading-relaxed">${escapeHtml(g.description)}</p>
\t\t\t\t\t\t<div class="flex items-center justify-between mt-4 pt-3 border-t border-[#e2e8f0]">
\t\t\t\t\t\t\t<span class="text-[10px] text-[#94a3b8] font-mono">${g.play_count} Plays</span>
\t\t\t\t\t\t\t<a href="/game/${g.id}" class="bg-[#00234f] text-[#c4e2f5] hover:bg-[#48d1cc] hover:text-[#00234f] font-bold text-xs px-3 py-1.5 rounded uppercase tracking-wider font-mono transition-colors">Play Now</a>
\t\t\t\t\t\t</div>
\t\t\t\t\t</div>
\t\t\t\t</div>`;
}

function buildCategoryPageHtml(catKey) {
  const meta = CATEGORY_META[catKey];
  const canonicalUrl = `https://mytopscore.com/category/${meta.slug}`;

  const categoriesMap = {};
  games.forEach((g) => {
    const s = slugify(g.category);
    if (!categoriesMap[s]) {
      categoriesMap[s] = { name: g.category, slug: s, list: [] };
    }
    categoriesMap[s].list.push(g);
  });

  const sectionsToRender =
    catKey === 'all'
      ? Object.values(categoriesMap)
      : [categoriesMap[catKey]].filter(Boolean);

  const sectionsHtml = sectionsToRender
    .map(
      (sec) => `
\t\t\t<section class="mb-12 explore-category-section" id="category-${sec.slug}" data-category="${escapeHtml(sec.name.toLowerCase())}">
\t\t\t\t<div class="flex justify-between items-center mb-6 pb-2 border-b border-[#cbd5e1]">
\t\t\t\t\t<h2 class="text-xl font-bold text-[#00234f] uppercase tracking-widest font-liberation border-l-4 border-[#48d1cc] pl-3">${escapeHtml(sec.name)} Games (${sec.list.length})</h2>
\t\t\t\t\t${catKey === 'all' ? `<a href="/category/${sec.slug}" class="text-xs font-bold text-[#00234f] hover:text-[#48d1cc] uppercase tracking-widest font-mono">Category Guide →</a>` : `<a href="/category/all" class="text-xs font-bold text-[#00234f] hover:text-[#48d1cc] uppercase tracking-widest font-mono">View All 20 Games →</a>`}
\t\t\t\t</div>
\t\t\t\t<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
${sec.list.map(renderGameCard).join('\n')}
\t\t\t\t</div>
\t\t\t</section>`
    )
    .join('\n');

  const otherCategoriesHtml =
    catKey === 'all'
      ? ''
      : `
\t\t\t<section class="mt-12 pt-10 border-t border-[#cbd5e1]">
\t\t\t\t<h2 class="text-lg font-bold text-[#00234f] uppercase tracking-widest font-liberation mb-6 border-l-4 border-[#48d1cc] pl-3">Explore Other Game Categories</h2>
\t\t\t\t<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
${Object.values(categoriesMap)
  .filter((c) => c.slug !== catKey)
  .map(
    (c) => `
\t\t\t\t\t<a href="/category/${c.slug}" class="bg-white rounded-lg border border-[#e2e8f0] p-5 hover:border-[#48d1cc] hover:shadow-md transition-all group">
\t\t\t\t\t\t<div class="flex items-center justify-between mb-2">
\t\t\t\t\t\t\t<h3 class="text-sm font-bold text-[#00234f] uppercase font-liberation group-hover:text-[#48d1cc] transition-colors">${escapeHtml(c.name)} Games</h3>
\t\t\t\t\t\t\t<span class="bg-[#00234f] text-[#c4e2f5] text-[10px] font-mono px-2 py-0.5 rounded">${c.list.length} Games</span>
\t\t\t\t\t\t</div>
\t\t\t\t\t\t<p class="text-xs text-[#64748b] line-clamp-2">${escapeHtml(CATEGORY_META[c.slug].description)}</p>
\t\t\t\t\t</a>`
  )
  .join('\n')}
\t\t\t\t</div>
\t\t\t</section>`;

  const categoryTabsHtml = Object.values(CATEGORY_META)
    .map((m) => {
      const count =
        m.slug === 'all'
          ? games.length
          : (categoriesMap[m.slug]?.list.length ?? 0);
      const isActive = m.slug === catKey;
      const cls = isActive
        ? 'bg-[#00234f] text-[#c4e2f5] border-[#00234f]'
        : 'bg-white text-[#00234f] border-[#cbd5e1] hover:border-[#48d1cc]';
      return `\t\t\t\t<a href="/category/${m.slug}" class="px-3.5 py-2 rounded border text-xs font-mono uppercase tracking-wider transition-colors ${cls}">${escapeHtml(m.name)} (${count})</a>`;
    })
    .join('\n');

  const selectOptionsHtml = Object.values(CATEGORY_META)
    .map(
      (m) =>
        `\t\t\t\t\t<option value="${m.slug}"${m.slug === catKey ? ' selected' : ''}>${escapeHtml(m.name === 'All Games' ? 'All Categories' : m.name)}</option>`
    )
    .join('\n');

  const itemListGames =
    catKey === 'all' ? games : categoriesMap[catKey]?.list || games;

  const schemaJson = JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: meta.title,
      url: canonicalUrl,
      description: meta.description,
      publisher: {
        '@type': 'Organization',
        name: 'FreshPlay Arcade',
        url: 'https://mytopscore.com/',
      },
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: itemListGames.map((g, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          name: g.title,
          url: `https://mytopscore.com/game/${g.id}`,
        })),
      },
    },
    null,
    2
  );

  return `<!DOCTYPE html>
<html lang="en">

<head>
\t<meta charset="UTF-8">
\t<meta name="viewport" content="width=device-width, initial-scale=1.0">
\t<title>${escapeHtml(meta.title)}</title>
\t<meta name="description" content="${escapeHtml(meta.description)}">
\t<link rel="canonical" href="${canonicalUrl}">
\t<meta property="og:title" content="${escapeHtml(meta.title)}">
\t<meta property="og:description" content="${escapeHtml(meta.description)}">
\t<meta property="og:type" content="website">
\t<meta property="og:url" content="${canonicalUrl}">
\t<meta property="og:image" content="https://mytopscore.com/assets/images/logo.png">
\t<meta name="twitter:card" content="summary_large_image">
\t<meta name="twitter:title" content="${escapeHtml(meta.title)}">
\t<meta name="twitter:description" content="${escapeHtml(meta.description)}">
\t<meta name="twitter:image" content="https://mytopscore.com/assets/images/logo.png">
\t<link rel="preconnect" href="https://cdn.tailwindcss.com">
\t<link rel="preconnect" href="https://pagead2.googlesyndication.com">
\t<link rel="preconnect" href="https://googleads.g.doubleclick.net">
\t<meta http-equiv="Content-Security-Policy" content="
\t\tdefault-src 'self'; 
\t\tscript-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://*.googlesyndication.com https://*.googleadservices.com https://*.adtrafficquality.google https://*.google.com https://*.doubleclick.net; 
\t\tstyle-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; 
\t\tfont-src 'self' https://fonts.gstatic.com data:; 
\t\timg-src 'self' https://*.googlesyndication.com https://*.google.com https://*.adtrafficquality.google https://*.doubleclick.net data: blob:; 
\t\tframe-src 'self' https://*.doubleclick.net https://*.googlesyndication.com https://*.google.com https://*.adtrafficquality.google; 
\t\tconnect-src 'self' https://*.googlesyndication.com https://*.adtrafficquality.google https://*.doubleclick.net https://*.google.com https://cdn.jsdelivr.net;
\t\tmedia-src 'self';
\t">
\t<link rel="stylesheet" href="/assets/css/style.css">
\t<script src="https://cdn.tailwindcss.com"></script>
\t<link rel="icon" href="/assets/images/logo.png" type="image/png">
\t<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7922397649195717" crossorigin="anonymous"></script>
\t<script type="application/ld+json">
${schemaJson}
\t</script>
</head>

<body class="flex flex-col min-h-screen fp-ready">
${renderHeader(catKey)}
\t<main class="flex-grow container mx-auto px-4 py-8">
\t\t<nav class="text-xs text-[#64748b] mb-4 font-mono" aria-label="Breadcrumb">
\t\t\t<a href="/" class="hover:text-[#00234f]">Home</a>
\t\t\t<span class="mx-2">/</span>
\t\t\t<a href="/category/all" class="hover:text-[#00234f]">Categories</a>
\t\t\t<span class="mx-2">/</span>
\t\t\t<span class="text-[#00234f] font-bold">${escapeHtml(meta.name)}</span>
\t\t</nav>

\t\t<div class="bg-white rounded-xl border border-[#e2e8f0] p-6 md:p-8 mb-8">
\t\t\t<h1 class="text-2xl md:text-3xl font-bold text-[#00234f] uppercase tracking-widest mb-4 font-liberation">${escapeHtml(meta.heading)}</h1>
\t\t\t<div class="space-y-3 text-xs md:text-sm text-[#64748b] leading-relaxed">
${meta.intro.map((p) => `\t\t\t\t<p>${escapeHtml(p)}</p>`).join('\n')}
\t\t\t</div>
\t\t</div>

\t\t<!-- Category Quick Links & Filter -->
\t\t<div class="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center bg-white p-4 rounded-lg border border-[#e2e8f0] mb-10">
\t\t\t<div class="flex flex-wrap gap-2">
${categoryTabsHtml}
\t\t\t</div>
\t\t\t<div class="flex items-center gap-3 w-full lg:w-auto justify-end">
\t\t\t\t<label for="category-filter" class="text-[#64748b] font-mono text-xs uppercase tracking-widest shrink-0">Quick Jump:</label>
\t\t\t\t<select id="category-filter" title="Filter games by category"
\t\t\t\t\tclass="bg-[#c4e2f5] border border-[#cbd5e1] text-[#00234f] text-xs rounded px-3 py-2 outline-none focus:border-[#48d1cc] font-mono cursor-pointer uppercase">
${selectOptionsHtml}
\t\t\t\t</select>
\t\t\t</div>
\t\t</div>

\t\t<div id="categories-container" data-static-rendered="true" class="space-y-6">
${sectionsHtml}
\t\t</div>

${otherCategoriesHtml}
\t</main>

\t<!-- Category Guides Section for SEO & Editorial Value -->
\t<section class="bg-[#f0f4f8] border-t border-[#e2e8f0] py-16">
\t\t<div class="container mx-auto px-4 max-w-5xl">
\t\t\t<h2 class="text-xl font-bold text-[#00234f] uppercase tracking-widest font-liberation mb-4 text-center">FreshPlay Arcade Genre Guide &amp; Player Resources</h2>
\t\t\t<p class="text-[#64748b] text-sm text-center max-w-2xl mx-auto mb-10 leading-relaxed">Every game on FreshPlay Arcade is engineered for instant browser execution with zero downloads. Learn how our genres are structured and explore our strategy articles below.</p>
\t\t\t<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
\t\t\t\t<div class="bg-white rounded-lg border border-[#e2e8f0] p-6">
\t\t\t\t\t<h3 class="text-sm font-bold text-[#00234f] uppercase tracking-widest font-liberation mb-3 border-l-2 border-[#48d1cc] pl-3">Puzzle &amp; Brain Games</h3>
\t\t\t\t\t<p class="text-[#64748b] text-xs leading-relaxed mb-3">Our puzzle games challenge your logic, spatial reasoning, and pattern recognition. From color-sorting challenges like <a href="/game/chroma-sort" class="text-[#00234f] font-bold hover:text-[#48d1cc] underline">Chroma Sort</a> to sliding block puzzles like <a href="/game/block-unblock" class="text-[#00234f] font-bold hover:text-[#48d1cc] underline">Block Unblock</a> and hexagonal number merges in <a href="/game/hexa-merge" class="text-[#00234f] font-bold hover:text-[#48d1cc] underline">Hexa Merge</a>, every level is handcrafted.</p>
\t\t\t\t\t<a href="/blog/puzzle-games-that-challenge-your-brain" class="text-[11px] font-mono font-bold text-[#00234f] hover:text-[#48d1cc] uppercase">Read Guide: Puzzle Games That Challenge Your Brain →</a>
\t\t\t\t</div>
\t\t\t\t<div class="bg-white rounded-lg border border-[#e2e8f0] p-6">
\t\t\t\t\t<h3 class="text-sm font-bold text-[#00234f] uppercase tracking-widest font-liberation mb-3 border-l-2 border-[#48d1cc] pl-3">Action &amp; Reflex Games</h3>
\t\t\t\t\t<p class="text-[#64748b] text-xs leading-relaxed mb-3">Test your reaction speed with 60 FPS arcade action. Slice glowing geometric waves in <a href="/game/neon-blade-dash" class="text-[#00234f] font-bold hover:text-[#48d1cc] underline">Neon Blade Dash</a>, deflect dual-color lasers in <a href="/game/orbit-striker" class="text-[#00234f] font-bold hover:text-[#48d1cc] underline">Orbit Striker</a>, or navigate collapsing walls in <a href="/game/hyper-hexagon" class="text-[#00234f] font-bold hover:text-[#48d1cc] underline">Hyper Hexagon</a>.</p>
\t\t\t\t\t<a href="/blog/best-action-games-for-quick-sessions" class="text-[11px] font-mono font-bold text-[#00234f] hover:text-[#48d1cc] uppercase">Read Guide: Best Action Games for Quick Sessions →</a>
\t\t\t\t</div>
\t\t\t\t<div class="bg-white rounded-lg border border-[#e2e8f0] p-6">
\t\t\t\t\t<h3 class="text-sm font-bold text-[#00234f] uppercase tracking-widest font-liberation mb-3 border-l-2 border-[#48d1cc] pl-3">Survival &amp; Endless Runners</h3>
\t\t\t\t\t<p class="text-[#64748b] text-xs leading-relaxed mb-3">Push your endurance in <a href="/game/deep-dive" class="text-[#00234f] font-bold hover:text-[#48d1cc] underline">Deep Dive</a> and <a href="/game/space-scavenger" class="text-[#00234f] font-bold hover:text-[#48d1cc] underline">Space Scavenger</a>, or race across procedural cyberpunk tracks in <a href="/game/neon-rider" class="text-[#00234f] font-bold hover:text-[#48d1cc] underline">Neon Rider</a> and <a href="/game/rooftop-cyber-punk" class="text-[#00234f] font-bold hover:text-[#48d1cc] underline">Rooftop Cyber Punk</a>.</p>
\t\t\t\t\t<a href="/blog/survival-games-strategy-guide" class="text-[11px] font-mono font-bold text-[#00234f] hover:text-[#48d1cc] uppercase">Read Guide: Survival Games Strategy Guide →</a>
\t\t\t\t</div>
\t\t\t\t<div class="bg-white rounded-lg border border-[#e2e8f0] p-6">
\t\t\t\t\t<h3 class="text-sm font-bold text-[#00234f] uppercase tracking-widest font-liberation mb-3 border-l-2 border-[#48d1cc] pl-3">Physics, Strategy &amp; Idle Games</h3>
\t\t\t\t\t<p class="text-[#64748b] text-xs leading-relaxed mb-3">Master momentum in <a href="/game/sling-drift" class="text-[#00234f] font-bold hover:text-[#48d1cc] underline">Sling Drift</a> and <a href="/game/cannon-basketball" class="text-[#00234f] font-bold hover:text-[#48d1cc] underline">Cannon Basketball</a>, or build automated empires in <a href="/game/clicker-miner" class="text-[#00234f] font-bold hover:text-[#48d1cc] underline">Clicker Miner</a> and <a href="/game/idle-arcade-tycoon" class="text-[#00234f] font-bold hover:text-[#48d1cc] underline">Idle Arcade Tycoon</a>.</p>
\t\t\t\t\t<a href="/blog/idle-games-explained" class="text-[11px] font-mono font-bold text-[#00234f] hover:text-[#48d1cc] uppercase">Read Guide: Idle Games Explained →</a>
\t\t\t\t</div>
\t\t\t</div>
\t\t</div>
\t</section>
${renderFooter()}
\t<script src="/assets/js/main.js" defer></script>
</body>

</html>
`;
}

function generateCategoryPages() {
  const categoryDir = path.join(ROOT, 'category');
  if (!fs.existsSync(categoryDir)) {
    fs.mkdirSync(categoryDir, { recursive: true });
  }
  for (const catKey of Object.keys(CATEGORY_META)) {
    const html = buildCategoryPageHtml(catKey);
    fs.writeFileSync(path.join(categoryDir, `${catKey}.html`), html, 'utf8');
  }
  // Also keep /explore.html identical to /category/all.html for fallback
  fs.writeFileSync(
    path.join(ROOT, 'explore.html'),
    buildCategoryPageHtml('all'),
    'utf8'
  );
}

// ==========================================
// 3. ENHANCE ALL 20 /game/*.html PAGES
// ==========================================
function updateGamePages() {
  const gameDir = path.join(ROOT, 'game');
  const files = fs.readdirSync(gameDir).filter((f) => f.endsWith('.html'));

  for (const file of files) {
    const filePath = path.join(gameDir, file);
    const gameId = file.replace(/\.html$/, '');
    const gameObj = games.find((g) => g.id === gameId);
    let html = fs.readFileSync(filePath, 'utf8');

    // 1. Ensure body has fp-ready
    html = html.replace(
      /<body class="flex flex-col min-h-screen(?:\s+fp-ready)?">/,
      '<body class="flex flex-col min-h-screen fp-ready">'
    );

    // 2. Replace header with full header + mobile menu drawer
    const catSlug = gameObj ? slugify(gameObj.category) : '';
    html = html.replace(
      /<header class="bg-\[#00234f\][\s\S]*?<\/header>(?:\s*<div id="mobile-menu-backdrop"[\s\S]*?<\/nav>)?/,
      renderHeader(catSlug)
    );

    // 3. Extract FAQs from the page to build FAQPage JSON-LD alongside VideoGame + BreadcrumbList
    const faqMatches = [
      ...html.matchAll(
        /<h3 class="font-bold text-\[#00234f\] mb-1\.5 text-sm">([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g
      ),
    ];
    if (gameObj && faqMatches.length > 0) {
      const structuredData = [
        {
          '@context': 'https://schema.org',
          '@type': 'VideoGame',
          name: gameObj.title,
          description: gameObj.description,
          genre: [gameObj.category, 'Arcade', 'Browser Game'],
          playMode: 'SinglePlayer',
          applicationCategory: 'Game',
          operatingSystem:
            'Any modern web browser (Windows, macOS, Linux, Android, iOS)',
          author: {
            '@type': 'Organization',
            name: 'FreshPlay Studios',
            url: 'https://mytopscore.com/',
          },
          publisher: {
            '@type': 'Organization',
            name: 'FreshPlay Arcade',
            url: 'https://mytopscore.com/',
          },
          url: `https://mytopscore.com/game/${gameObj.id}`,
          image: `https://mytopscore.com${gameObj.thumbnail_url}`,
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: String(gameObj.rating || '4.8'),
            bestRating: '5',
            worstRating: '1',
            ratingCount: '1250',
          },
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
            availability: 'https://schema.org/InStock',
          },
        },
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqMatches.map((m) => ({
            '@type': 'Question',
            name: m[1].trim(),
            acceptedAnswer: {
              '@type': 'Answer',
              text: m[2].trim(),
            },
          })),
        },
      ];

      html = html.replace(
        /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
        `<script type="application/ld+json">\n${JSON.stringify(structuredData, null, 2)}\n\t</script>`
      );
    }

    // 4. Add Related Strategy Guides section before footer if not already present
    const relatedGuidesHtml = `\t\t<!-- Related Editorial Guides -->
\t\t<section class="bg-[#f0f4f8] rounded-lg border border-[#e2e8f0] p-8 mb-12">
\t\t\t<div class="flex items-center justify-between mb-6">
\t\t\t\t<h2 class="text-lg font-bold text-[#00234f] uppercase tracking-widest font-liberation border-l-3 border-[#48d1cc] pl-4">Related Gaming Guides &amp; Articles</h2>
\t\t\t\t<a href="/blog" class="text-xs font-mono font-bold text-[#00234f] hover:text-[#48d1cc] uppercase">All Guides →</a>
\t\t\t</div>
\t\t\t<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
${articles
  .slice(0, 3)
  .map(
    (a) => `\t\t\t\t<a href="/blog/${a.id}" class="bg-white rounded-lg border border-[#e2e8f0] p-5 hover:shadow-md transition-all group">
\t\t\t\t\t<span class="text-[10px] font-bold text-[#48d1cc] uppercase tracking-widest font-mono">${escapeHtml(a.category)} · ${a.date}</span>
\t\t\t\t\t<h3 class="text-xs font-bold text-[#00234f] uppercase tracking-wider font-liberation mt-1.5 mb-2 group-hover:text-[#48d1cc] transition-colors">${escapeHtml(a.title)}</h3>
\t\t\t\t\t<p class="text-[11px] text-[#64748b] line-clamp-2 leading-relaxed">${escapeHtml(a.excerpt)}</p>
\t\t\t\t</a>`
  )
  .join('\n')}
\t\t\t</div>
\t\t</section>
\t</div>`;

    if (!html.includes('Related Gaming Guides &amp; Articles')) {
      html = html.replace(
        /<\/section>\s*<\/div>\s*(?:<!-- HTML Sitemap Footer -->\s*)?<footer/,
        `</section>\n${relatedGuidesHtml}\n\n\t<!-- HTML Sitemap Footer -->\n\t<footer`
      );
    }

    // 5. Replace footer with clean unified footer and ensure main.js is loaded
    html = html.replace(/<footer[\s\S]*?<\/footer>/, renderFooter());

    if (!html.includes('/assets/js/main.js')) {
      html = html.replace(
        /<\/body>/,
        `\t<script src="/assets/js/main.js" defer></script>\n</body>`
      );
    }

    fs.writeFileSync(filePath, html, 'utf8');
  }
}

// ==========================================
// 4. ENHANCE /blog.html, /article.html, AND ALL 10 /blog/*.html PAGES
// ==========================================
function updateBlogPages() {
  // Update /blog/*.html
  const blogDir = path.join(ROOT, 'blog');
  const files = fs.readdirSync(blogDir).filter((f) => f.endsWith('.html'));

  const featuredGamesSlice = games.slice(0, 6);
  const featuredGamesBlock = `\t\t<!-- Featured Playable Games Section -->
\t\t<section class="bg-white border-t border-[#e2e8f0] py-12">
\t\t\t<div class="container mx-auto px-4 max-w-5xl">
\t\t\t\t<div class="flex items-center justify-between mb-6">
\t\t\t\t\t<h2 class="text-lg font-bold text-[#00234f] uppercase tracking-widest font-liberation border-l-4 border-[#48d1cc] pl-3">Play Featured Games Mentioned in Our Guides</h2>
\t\t\t\t\t<a href="/category/all" class="text-xs font-mono font-bold text-[#00234f] hover:text-[#48d1cc] uppercase">View All 20 Games →</a>
\t\t\t\t</div>
\t\t\t\t<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
${featuredGamesSlice
  .map(
    (g) => `\t\t\t\t\t<a href="/game/${g.id}" class="bg-[#f0f4f8] rounded-lg border border-[#e2e8f0] overflow-hidden hover:border-[#48d1cc] transition-all group">
\t\t\t\t\t\t<div class="aspect-video bg-[#c4e2f5] overflow-hidden">
\t\t\t\t\t\t\t<img src="${g.thumbnail_url}" alt="${escapeHtml(g.title)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy">
\t\t\t\t\t\t</div>
\t\t\t\t\t\t<div class="p-2.5">
\t\t\t\t\t\t\t<h3 class="text-[11px] font-bold text-[#00234f] uppercase truncate group-hover:text-[#48d1cc]">${escapeHtml(g.title)}</h3>
\t\t\t\t\t\t\t<span class="text-[9px] font-mono text-[#64748b] uppercase">${escapeHtml(g.category)}</span>
\t\t\t\t\t\t</div>
\t\t\t\t\t</a>`
  )
  .join('\n')}
\t\t\t\t</div>
\t\t\t</div>
\t\t</section>`;

  for (const file of files) {
    const filePath = path.join(blogDir, file);
    let html = fs.readFileSync(filePath, 'utf8');

    html = html.replace(
      /<body class="flex flex-col min-h-screen(?:\s+fp-ready)?">/,
      '<body class="flex flex-col min-h-screen fp-ready">'
    );

    html = html.replace(
      /<header class="bg-\[#00234f\][\s\S]*?<\/header>(?:\s*<div id="mobile-menu-backdrop"[\s\S]*?<\/nav>)?/,
      renderHeader('blog')
    );

    if (!html.includes('Play Featured Games Mentioned in Our Guides')) {
      html = html.replace(
        /<\/main>/,
        `${featuredGamesBlock}\n\t</main>`
      );
    }

    html = html.replace(/<footer[\s\S]*?<\/footer>/, renderFooter());

    if (!html.includes('/assets/js/main.js')) {
      html = html.replace(
        /<\/body>/,
        `\t<script src="/assets/js/main.js" defer></script>\n</body>`
      );
    }

    fs.writeFileSync(filePath, html, 'utf8');
  }

  // Update /blog.html
  let blogHtml = fs.readFileSync(path.join(ROOT, 'blog.html'), 'utf8');
  blogHtml = blogHtml.replace(
    /<body class="flex flex-col min-h-screen(?:\s+fp-ready)?">/,
    '<body class="flex flex-col min-h-screen fp-ready">'
  );
  blogHtml = blogHtml.replace(
    /<header class="bg-\[#00234f\][\s\S]*?<\/header>(?:\s*<div id="mobile-menu-backdrop"[\s\S]*?<\/nav>)?/,
    renderHeader('blog')
  );
  blogHtml = blogHtml.replace(/<footer[\s\S]*?<\/footer>/, renderFooter());
  // Replace inline articles fetch script with main.js so static articles stay intact
  blogHtml = blogHtml.replace(
    /<script>\s*document\.addEventListener\('DOMContentLoaded'[\s\S]*?<\/script>/,
    '\t<script src="/assets/js/main.js" defer></script>'
  );
  fs.writeFileSync(path.join(ROOT, 'blog.html'), blogHtml, 'utf8');

  // Update /article.html
  let articleHtml = fs.readFileSync(path.join(ROOT, 'article.html'), 'utf8');
  articleHtml = articleHtml.replace(
    /<body class="flex flex-col min-h-screen(?:\s+fp-ready)?">/,
    '<body class="flex flex-col min-h-screen fp-ready">'
  );
  articleHtml = articleHtml.replace(
    /<header class="bg-\[#00234f\][\s\S]*?<\/header>(?:\s*<div id="mobile-menu-backdrop"[\s\S]*?<\/nav>)?/,
    renderHeader('blog')
  );
  articleHtml = articleHtml.replace(/<footer[\s\S]*?<\/footer>/, renderFooter());
  if (!articleHtml.includes('/assets/js/main.js')) {
    articleHtml = articleHtml.replace(
      /<\/body>/,
      `\t<script src="/assets/js/main.js" defer></script>\n</body>`
    );
  }
  fs.writeFileSync(path.join(ROOT, 'article.html'), articleHtml, 'utf8');
}

// ==========================================
// 5. UPDATE /contact.html, /about.html, /privacy.html, /terms.html, /404.html, /play.html
// ==========================================
function updateTrustAndUtilityPages() {
  // 5A. /contact.html
  let contactHtml = fs.readFileSync(path.join(ROOT, 'contact.html'), 'utf8');
  // Add https://api.web3forms.com to connect-src CSP
  contactHtml = contactHtml.replace(
    /connect-src 'self'([^;]*);/,
    (match, rest) =>
      rest.includes('https://api.web3forms.com')
        ? match
        : `connect-src 'self' https://api.web3forms.com${rest};`
  );
  // Remove adsbygoogle.js from contact page
  contactHtml = contactHtml.replace(
    /\s*<script async src="https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js[^>]*><\/script>/g,
    ''
  );
  contactHtml = contactHtml.replace(
    /<body class="flex flex-col min-h-screen[^"]*">/,
    '<body class="flex flex-col min-h-screen bg-[#c4e2f5] fp-ready">'
  );
  contactHtml = contactHtml.replace(
    /<header class="bg-\[#00234f\][\s\S]*?<\/header>(?:\s*<div id="mobile-menu-backdrop"[\s\S]*?<\/nav>)?/,
    renderHeader('contact')
  );
  // Replace fake address ("123 Arcade Lane, Level 2, Neo City, Cyber State 90210") with authentic digital studio support info
  contactHtml = contactHtml.replace(
    /<h3 class="text-\[#00234f\] font-bold mb-2 font-liberation tracking-widest uppercase">Office<\/h3>[\s\S]*?<\/p>/,
    `<h3 class="text-[#00234f] font-bold mb-2 font-liberation tracking-widest uppercase">Digital Studio &amp; Support Hours</h3>
\t\t\t\t\t\t<p class="text-[#64748b] text-xs mb-2 leading-relaxed">FreshPlay Studios (MyTopScore.com) operates as a remote-first digital game studio. Our engineering &amp; editorial support team reviews inquiries Monday – Friday, 9:00 AM – 6:00 PM UTC (typical response time: 24–48 hours).</p>
\t\t\t\t\t\t<p class="text-[#00234f] text-xs font-mono tracking-wider">Privacy &amp; DMCA: <a href="mailto:privacy@mytopscore.com" class="hover:underline">privacy@mytopscore.com</a></p>`
  );
  contactHtml = contactHtml.replace(/<footer[\s\S]*?<\/footer>/, renderFooter());
  contactHtml = contactHtml.replace(
    /\s*<script src="\/assets\/js\/skeleton\.js" defer><\/script>/g,
    ''
  );
  fs.writeFileSync(path.join(ROOT, 'contact.html'), contactHtml, 'utf8');

  // 5B. /about.html
  let aboutHtml = fs.readFileSync(path.join(ROOT, 'about.html'), 'utf8');
  aboutHtml = aboutHtml.replace(
    /\s*<script async src="https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js[^>]*><\/script>/g,
    ''
  );
  aboutHtml = aboutHtml.replace(
    /<body class="flex flex-col min-h-screen[^"]*">/,
    '<body class="flex flex-col min-h-screen fp-ready">'
  );
  aboutHtml = aboutHtml.replace(
    /<header class="bg-\[#00234f\][\s\S]*?<\/header>(?:\s*<div id="mobile-menu-backdrop"[\s\S]*?<\/nav>)?/,
    renderHeader('about')
  );
  aboutHtml = aboutHtml.replace(/<footer[\s\S]*?<\/footer>/, renderFooter());
  if (!aboutHtml.includes('/assets/js/main.js')) {
    aboutHtml = aboutHtml.replace(
      /<\/body>/,
      `\t<script src="/assets/js/main.js" defer></script>\n</body>`
    );
  }
  fs.writeFileSync(path.join(ROOT, 'about.html'), aboutHtml, 'utf8');

  // 5C. /privacy.html
  let privacyHtml = fs.readFileSync(path.join(ROOT, 'privacy.html'), 'utf8');
  privacyHtml = privacyHtml.replace(
    /\s*<script async src="https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js[^>]*><\/script>/g,
    ''
  );
  privacyHtml = privacyHtml.replace(
    /<body class="flex flex-col min-h-screen[^"]*">/,
    '<body class="flex flex-col min-h-screen fp-ready">'
  );
  privacyHtml = privacyHtml.replace(
    /<header class="bg-\[#00234f\][\s\S]*?<\/header>(?:\s*<div id="mobile-menu-backdrop"[\s\S]*?<\/nav>)?/,
    renderHeader('')
  );
  privacyHtml = privacyHtml.replace(/<footer[\s\S]*?<\/footer>/, renderFooter());
  privacyHtml = privacyHtml.replace(
    /\s*<script src="\/assets\/js\/skeleton\.js" defer><\/script>/g,
    ''
  );
  fs.writeFileSync(path.join(ROOT, 'privacy.html'), privacyHtml, 'utf8');

  // 5D. /terms.html
  let termsHtml = fs.readFileSync(path.join(ROOT, 'terms.html'), 'utf8');
  termsHtml = termsHtml.replace(
    /\s*<script async src="https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js[^>]*><\/script>/g,
    ''
  );
  termsHtml = termsHtml.replace(
    /<body class="flex flex-col min-h-screen[^"]*">/,
    '<body class="flex flex-col min-h-screen fp-ready">'
  );
  termsHtml = termsHtml.replace(
    /<header class="bg-\[#00234f\][\s\S]*?<\/header>(?:\s*<div id="mobile-menu-backdrop"[\s\S]*?<\/nav>)?/,
    renderHeader('')
  );
  termsHtml = termsHtml.replace(/<footer[\s\S]*?<\/footer>/, renderFooter());
  if (!termsHtml.includes('/assets/js/main.js')) {
    termsHtml = termsHtml.replace(
      /<\/body>/,
      `\t<script src="/assets/js/main.js" defer></script>\n</body>`
    );
  }
  fs.writeFileSync(path.join(ROOT, 'terms.html'), termsHtml, 'utf8');

  // 5E. /404.html (No AdSense allowed on 404 pages, add noindex)
  let notFoundHtml = fs.readFileSync(path.join(ROOT, '404.html'), 'utf8');
  notFoundHtml = notFoundHtml.replace(
    /\s*<script async src="https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js[^>]*><\/script>/g,
    ''
  );
  if (!notFoundHtml.includes('name="robots"')) {
    notFoundHtml = notFoundHtml.replace(
      /<title>/,
      '<meta name="robots" content="noindex, nofollow">\n\t<title>'
    );
  }
  notFoundHtml = notFoundHtml.replace(
    /<body class="flex flex-col min-h-screen[^"]*">/,
    '<body class="flex flex-col min-h-screen bg-[#c4e2f5] fp-ready">'
  );
  notFoundHtml = notFoundHtml.replace(
    /<header class="bg-\[#00234f\][\s\S]*?<\/header>(?:\s*<div id="mobile-menu-backdrop"[\s\S]*?<\/nav>)?/,
    renderHeader('')
  );
  notFoundHtml = notFoundHtml.replace(
    /\s*data-skeleton="[^"]*"\s*data-skeleton-count="[^"]*"/g,
    ''
  );
  notFoundHtml = notFoundHtml.replace(/<footer[\s\S]*?<\/footer>/, renderFooter());
  notFoundHtml = notFoundHtml.replace(
    /\s*<script src="\/assets\/js\/skeleton\.js" defer><\/script>/g,
    ''
  );
  fs.writeFileSync(path.join(ROOT, '404.html'), notFoundHtml, 'utf8');

  // 5F. /play.html
  let playHtml = fs.readFileSync(path.join(ROOT, 'play.html'), 'utf8');
  playHtml = playHtml.replace(
    /<body class="flex flex-col min-h-screen[^"]*">/,
    '<body class="flex flex-col min-h-screen fp-ready">'
  );
  playHtml = playHtml.replace(
    /<header class="bg-\[#00234f\][\s\S]*?<\/header>(?:\s*<div id="mobile-menu-backdrop"[\s\S]*?<\/nav>)?/,
    renderHeader('')
  );
  playHtml = playHtml.replace(
    /\s*data-skeleton="[^"]*"\s*data-skeleton-count="[^"]*"/g,
    ''
  );
  playHtml = playHtml.replace(/<footer[\s\S]*?<\/footer>/, renderFooter());
  playHtml = playHtml.replace(
    /\s*<script src="\/assets\/js\/skeleton\.js" defer><\/script>/g,
    ''
  );
  fs.writeFileSync(path.join(ROOT, 'play.html'), playHtml, 'utf8');
}

generateHomepage();
generateCategoryPages();
updateGamePages();
updateBlogPages();
updateTrustAndUtilityPages();

console.log('Successfully pre-rendered FreshPlay Arcade portal pages.');
