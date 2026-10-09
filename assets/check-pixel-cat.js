/**
 * Headless render-check for cingmen/assets/pixel-cat.svg.
 *
 * Usage (from the repository root):
 *   node assets/check-pixel-cat.js <url-or-file-url>
 *     - <url>            : any URL serving the SVG (e.g. the live raw.githubusercontent URL)
 *     - (no argument)    : prints instructions, because plain `node` cannot open the
 *                          workspace file:// page outside a real browser.
 *
 * Assertions performed inside the page (paste `--snippet` output via check-pixel-cat.browser.js
 * when run through the Freebuff preview browser):
 *   1. the SVG parses and is visible with the expected intrinsic size,
 *   2. every @keyframes name referenced by the animation classes exists,
 *   3. the tail element's animated transform actually changes over time.
 */
const fs = require('fs');
const path = require('path');

const EXPECTED_KEYFRAMES = ['wag', 'blink', 'blinkclosed', 'floatz', 'earflick-l', 'earflick-r', 'orbit'];
const EXPECTED_ORBITS = 3;

const target = process.argv[2];
if (!target) {
  console.log('Usage: node assets/check-pixel-cat.js <url-or-file-url>');
  console.log('  e.g. node assets/check-pixel-cat.js https://raw.githubusercontent.com/cingmen/cingmen/main/assets/pixel-cat.svg');
  console.log('For the local file inside Freebuff preview, paste the snippet printed by:');
  console.log('  node assets/check-pixel-cat.js --snippet');
  process.exit(0);
}

if (target === '--snippet') {
  // Print the in-page assertion program (browser-side), for use with preview_evaluate.
  const snippet = `(() => new Promise(resolve => {
  const svg = document.querySelector('svg');
  if (!svg) { resolve({ fail: 'no <svg> element parsed' }); return; }
  const box = svg.getBoundingClientRect();
  const cssText = Array.from(document.styleSheets).map(s => { try { return Array.from(s.cssRules).map(r => r.cssText).join('\\n'); } catch { return ''; } }).join('\\n');
  const defined = new Set([...cssText.matchAll(/@keyframes\\s+([\\w-]+)/g)].map(m => m[1]));
  const expected = ${JSON.stringify(EXPECTED_KEYFRAMES)};
  const missing = expected.filter(k => !defined.has(k));
  const tail = document.querySelector('.tail');
  const t1 = tail ? getComputedStyle(tail).transform : null;
  setTimeout(() => {
    const t2 = tail ? getComputedStyle(tail).transform : null;
    const orbits = document.querySelectorAll('.orb-1,.orb-2,.orb-3').length;
    resolve({
      box: { w: Math.round(box.width), h: Math.round(box.height) },
      viewBox: svg.getAttribute('viewBox'),
      missing, orbits, t1, t2,
      tailMoves: !!(tail && t1 && t2 && t1 !== t2),
    });
  }, 450);
}))()`;
  console.log(snippet);
  process.exit(0);
}

(async () => {
  // Node path: fetch SVG text over HTTP(S) or read a local file, then assert statically.
  let svg, label;
  if (/^https?:\/\//.test(target)) {
    const res = await fetch(target);
    if (!res.ok) { console.error(`RENDER CHECK FAILED: HTTP ${res.status} for ${target}`); process.exit(1); }
    svg = await res.text();
    label = target;
  } else {
    svg = fs.readFileSync(path.resolve(target), 'utf8');
    label = 'local:' + target;
  }
  const problems = [];
  if (!/<svg[\s>]/.test(svg)) problems.push('no <svg> root element');
  if (!/viewBox="0 0 220 180"/.test(svg)) problems.push('viewBox must be "0 0 220 180"');
  for (const k of EXPECTED_KEYFRAMES) {
    if (!new RegExp(`@keyframes\\s+${k}\\b`).test(svg)) problems.push(`missing @keyframes ${k}`);
  }
  const orbits = (svg.match(/class="orb-\d"/g) || []).length;
  if (orbits !== EXPECTED_ORBITS) problems.push(`expected ${EXPECTED_ORBITS} orbit elements, found ${orbits}`);
  if (!/class="tail"/.test(svg)) problems.push('missing .tail element');
  if (!/@media\s*\(prefers-color-scheme:\s*dark\)/.test(svg)) problems.push('missing dark-mode adaptation');

  if (problems.length) {
    console.error('RENDER CHECK FAILED:');
    problems.forEach(p => console.error('  - ' + p));
    process.exit(1);
  }
  console.log('RENDER CHECK PASSED (static)');
  console.log(`  target:    ${label}`);
  console.log(`  keyframes: ${EXPECTED_KEYFRAMES.join(', ')}`);
  console.log(`  orbits:    ${orbits}/${EXPECTED_ORBITS}, tail present, dark adaptation present`);
})().catch(e => { console.error('RENDER CHECK ERROR:', e.message); process.exit(2); });
