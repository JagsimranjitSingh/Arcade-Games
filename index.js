const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = __dirname;

const LEGACY_GAME_REDIRECTS = {
  'rooftop-cyber-runner': 'rooftop-cyber-punk',
  'gravity-flip': 'glitch-jumper',
  'shadow-dash': 'neon-blade-dash',
  'super-drift': 'sling-drift',
  'laser-bounce': 'neon-pinball',
  'cyber-dodge': 'orbit-striker',
  'neon-snake-evolved': 'neon-rider',
};

const CLEAN_PAGE_MAP = {
  '/blog': 'blog.html',
  '/about': 'about.html',
  '/contact': 'contact.html',
  '/terms': 'terms.html',
  '/privacy-policy': 'privacy.html',
  '/privacy': 'privacy.html',
  '/explore': 'explore.html',
  '/404': '404.html',
};

function resolveCleanRoute(urlPath, query = {}, fileExistsSync = fs.existsSync, rootDir = ROOT_DIR) {
  const normalizedPath = urlPath.replace(/\/+$/, '') || '/';

  if (normalizedPath === '/play' || normalizedPath === '/play.html') {
    if (query.id && /^[a-zA-Z0-9_-]+$/.test(String(query.id))) {
      return { type: 'redirect', status: 301, location: `/game/${query.id}` };
    }
    return { type: 'redirect', status: 301, location: '/category/all' };
  }

  if (CLEAN_PAGE_MAP[normalizedPath]) {
    return {
      type: 'file',
      filePath: path.join(rootDir, CLEAN_PAGE_MAP[normalizedPath]),
    };
  }

  const gameMatch = normalizedPath.match(/^\/game\/([a-zA-Z0-9_-]+)$/);
  if (gameMatch) {
    const slug = gameMatch[1];
    if (LEGACY_GAME_REDIRECTS[slug]) {
      return {
        type: 'redirect',
        status: 301,
        location: `/game/${LEGACY_GAME_REDIRECTS[slug]}`,
      };
    }
    const candidate = path.join(rootDir, 'game', `${slug}.html`);
    if (fileExistsSync(candidate)) {
      return { type: 'file', filePath: candidate };
    }
    return { type: 'file', filePath: path.join(rootDir, 'play.html') };
  }

  const categoryMatch = normalizedPath.match(/^\/category\/([a-zA-Z0-9_-]+)$/);
  if (categoryMatch) {
    const slug = categoryMatch[1];
    const candidate = path.join(rootDir, 'category', `${slug}.html`);
    if (fileExistsSync(candidate)) {
      return { type: 'file', filePath: candidate };
    }
    return { type: 'file', filePath: path.join(rootDir, 'explore.html') };
  }

  const blogMatch = normalizedPath.match(/^\/blog\/([a-zA-Z0-9_-]+)$/);
  if (blogMatch) {
    const slug = blogMatch[1];
    const candidate = path.join(rootDir, 'blog', `${slug}.html`);
    if (fileExistsSync(candidate)) {
      return { type: 'file', filePath: candidate };
    }
    return { type: 'file', filePath: path.join(rootDir, 'article.html') };
  }

  return null;
}

app.use((req, res, next) => {
  const resolution = resolveCleanRoute(req.path, req.query);
  if (!resolution) return next();

  if (resolution.type === 'redirect') {
    return res.redirect(resolution.status, resolution.location);
  }
  if (resolution.type === 'file' && fs.existsSync(resolution.filePath)) {
    return res.sendFile(resolution.filePath);
  }
  return next();
});

app.use(
  express.static(ROOT_DIR, {
    extensions: ['html'],
  })
);

app.use((req, res) => {
  const notFoundPage = path.join(ROOT_DIR, '404.html');
  if (fs.existsSync(notFoundPage)) {
    res.status(404).sendFile(notFoundPage);
  } else {
    res.status(404).send('Not Found');
  }
});

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FreshPlay Arcade server running on http://0.0.0.0:${PORT}`);
  });
}

module.exports = { app, resolveCleanRoute };