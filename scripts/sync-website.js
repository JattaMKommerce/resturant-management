#!/usr/bin/env node
/**
 * Copies the built frontend (frontend/dist) to the places it is served from:
 *  - the repository's top folder: hotel.jattamkommerce.com is deployed by Hostinger Git straight
 *    from this folder, so index.html, sw.js and assets/ must live here (the top-level .htaccess
 *    keeps the source folders private on that site);
 *  - backend/public: the copy the Node.js Web App serves.
 * Old bundle files are removed so each folder holds exactly one build.
 *
 * Usage: npm --prefix frontend run build && node scripts/sync-website.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'frontend', 'dist');
if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('frontend/dist/index.html not found. Build first: npm --prefix frontend run build');
  process.exit(1);
}
const builtAssets = fs.readdirSync(path.join(dist, 'assets'));

for (const target of [root, path.join(root, 'backend', 'public')]) {
  const assetsDir = path.join(target, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });
  for (const old of fs.readdirSync(assetsDir)) {
    // index-* is the app; FlowScene-* is the landing page's 3D scene, loaded only on that page
    if (/^(index|FlowScene)-[A-Za-z0-9_-]+\.(js|css)$/.test(old) && !builtAssets.includes(old)) fs.rmSync(path.join(assetsDir, old));
  }
  for (const f of builtAssets) fs.copyFileSync(path.join(dist, 'assets', f), path.join(assetsDir, f));
  for (const f of ['index.html', 'sw.js']) fs.copyFileSync(path.join(dist, f), path.join(target, f));
  // backend/public takes the website .htaccess as is; the top folder has its own (source protection).
  if (target !== root) fs.copyFileSync(path.join(dist, '.htaccess'), path.join(target, '.htaccess'));
  console.log(`✔ ${path.relative(root, target) || '(top folder)'}: index.html, sw.js, assets/${builtAssets.join(', assets/')}`);
}
