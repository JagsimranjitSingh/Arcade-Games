const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { resolveCleanRoute } = require('./index.js');

const ROOT = __dirname;

test('resolveCleanRoute redirects /play without id to /category/all', () => {
  const res = resolveCleanRoute('/play', {}, () => false, ROOT);
  assert.deepEqual(res, {
    type: 'redirect',
    status: 301,
    location: '/category/all',
  });
});

test('resolveCleanRoute redirects /play?id=neon-rider to /game/neon-rider', () => {
  const res = resolveCleanRoute('/play.html', { id: 'neon-rider' }, () => false, ROOT);
  assert.deepEqual(res, {
    type: 'redirect',
    status: 301,
    location: '/game/neon-rider',
  });
});

test('resolveCleanRoute maps legacy game slugs to canonical game paths', () => {
  const res = resolveCleanRoute('/game/gravity-flip', {}, () => false, ROOT);
  assert.deepEqual(res, {
    type: 'redirect',
    status: 301,
    location: '/game/glitch-jumper',
  });
});

test('resolveCleanRoute serves pre-rendered game HTML when present', () => {
  const res = resolveCleanRoute('/game/neon-blade-dash', {}, () => true, ROOT);
  assert.deepEqual(res, {
    type: 'file',
    filePath: path.join(ROOT, 'game', 'neon-blade-dash.html'),
  });
});

test('resolveCleanRoute routes /category/:slug to dedicated category HTML when present', () => {
  const res = resolveCleanRoute('/category/puzzle', {}, () => true, ROOT);
  assert.deepEqual(res, {
    type: 'file',
    filePath: path.join(ROOT, 'category', 'puzzle.html'),
  });
});

test('resolveCleanRoute falls back to explore.html when category HTML is absent', () => {
  const res = resolveCleanRoute('/category/unknown', {}, () => false, ROOT);
  assert.deepEqual(res, {
    type: 'file',
    filePath: path.join(ROOT, 'explore.html'),
  });
});

test('style.css sets body opacity to 1 so pages never render blank to crawlers', () => {
  const css = fs.readFileSync(path.join(ROOT, 'assets', 'css', 'style.css'), 'utf8');
  const bodyRuleMatch = css.match(/body\s*\{([^}]*)\}/);
  assert.ok(bodyRuleMatch, 'body rule should exist in style.css');
  assert.match(bodyRuleMatch[1], /opacity:\s*1\s*;/);
});

test('robots.txt allows Mediapartners-Google and Googlebot without blocking /games/, /explore.html, or /blog.html', () => {
  const robots = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
  assert.match(robots, /User-agent:\s*Mediapartners-Google/);
  assert.doesNotMatch(robots, /Disallow:\s*\/games\//);
  assert.doesNotMatch(robots, /Disallow:\s*\/explore\.html/);
  assert.doesNotMatch(robots, /Disallow:\s*\/blog\.html/);
});

test('all 20 game pages, 10 blog pages, and 7 category pages exist with fp-ready body and no dead href="#" links', () => {
  const games = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'games.json'), 'utf8'));
  const articles = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'articles.json'), 'utf8'));
  const categories = ['all', 'puzzle', 'action', 'survival', 'physics-skill', 'endless-runner', 'strategy-idle'];

  assert.equal(games.length, 20);
  assert.equal(articles.length, 10);

  for (const g of games) {
    const html = fs.readFileSync(path.join(ROOT, 'game', `${g.id}.html`), 'utf8');
    assert.match(html, /<body[^>]*class="[^"]*fp-ready[^"]*"/);
    assert.match(html, new RegExp(`<link rel="canonical" href="https://mytopscore.com/game/${g.id}">`));
    assert.doesNotMatch(html, /href="#"/);
  }

  for (const a of articles) {
    const html = fs.readFileSync(path.join(ROOT, 'blog', `${a.id}.html`), 'utf8');
    assert.match(html, /<body[^>]*class="[^"]*fp-ready[^"]*"/);
    assert.match(html, new RegExp(`<link rel="canonical" href="https://mytopscore.com/blog/${a.id}">`));
    assert.doesNotMatch(html, /href="#"/);
  }

  for (const c of categories) {
    const html = fs.readFileSync(path.join(ROOT, 'category', `${c}.html`), 'utf8');
    assert.match(html, /<body[^>]*class="[^"]*fp-ready[^"]*"/);
    assert.match(html, new RegExp(`<link rel="canonical" href="https://mytopscore.com/category/${c}">`));
    assert.doesNotMatch(html, /href="#"/);
  }
});

test('index.html has pre-rendered games and articles, contact.html allows web3forms CSP without fake address, and 404.html has no ads', () => {
  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.match(indexHtml, /href="\/game\/neon-blade-dash"/);
  assert.match(indexHtml, /href="\/blog\/top-10-free-browser-games"/);
  assert.doesNotMatch(indexHtml, /data-skeleton=/);

  const contactHtml = fs.readFileSync(path.join(ROOT, 'contact.html'), 'utf8');
  assert.match(contactHtml, /https:\/\/api\.web3forms\.com/);
  assert.doesNotMatch(contactHtml, /123 Arcade Lane/);
  assert.doesNotMatch(contactHtml, /adsbygoogle\.js/);

  const notFoundHtml = fs.readFileSync(path.join(ROOT, '404.html'), 'utf8');
  assert.match(notFoundHtml, /noindex,\s*nofollow/);
  assert.doesNotMatch(notFoundHtml, /adsbygoogle\.js/);
});
