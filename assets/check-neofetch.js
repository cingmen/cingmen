/**
 * Integrity check for the neofetch header block that renders this profile.
 *
 * Source of truth: assets/neofetch.txt — the exact text shown inside the
 * ```text fence at the top of README.md. A fixed-column layout like this
 * breaks silently, so this script guards the three ways it happens:
 *
 *   1. README.md drifting away from assets/neofetch.txt,
 *   2. column drift when whitespace gets rewritten (one missing space in the
 *      art column and the cat stops lining up with the info column),
 *   3. the block being wrapped in <div align="center">, which makes GitHub
 *      centre every line on its own and skews the art.
 *
 * Usage:
 *   node assets/check-neofetch.js
 *
 * Exit code 0 = clean, 1 = problems listed on stderr.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BLOCK_FILE = path.join(__dirname, 'neofetch.txt');
const README_FILE = path.join(ROOT, 'README.md');

const INFO_COL = 22; // first column of the info text; the art owns columns 0..21
const SWATCH = '\u2588';
const MIN_ART_ROWS = 5;

const problems = [];
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

const blockText = read(BLOCK_FILE);
const block = blockText.replace(/\n$/, '');
const lines = block.split('\n');

lines.forEach((line, i) => {
  const at = `neofetch.txt line ${i + 1}`;
  if (line === '') return;
  if (line.includes('\t')) problems.push(`${at}: contains a tab — tabs collapse the fixed column layout`);
  if (/\s+$/.test(line)) problems.push(`${at}: trailing whitespace`);
  if (line.length <= INFO_COL) problems.push(`${at}: shorter than the info column (${INFO_COL})`);
  else if (line[INFO_COL] === ' ') problems.push(`${at}: info text must start at column ${INFO_COL}`);
});

const artRows = lines.filter((l) => l.length > INFO_COL && l.slice(0, INFO_COL).trim() !== '');
if (artRows.length < MIN_ART_ROWS) problems.push(`expected the cat art to span >= ${MIN_ART_ROWS} rows, found ${artRows.length}`);
if (!lines.some((l) => l.includes(SWATCH))) problems.push('missing the colour-swatch rows');

const readme = read(README_FILE);
const fence = /```text\n([\s\S]*?)\n```/.exec(readme);
if (!fence) {
  problems.push('README.md has no ```text fence');
} else {
  if (fence[1] !== block) problems.push('README.md block differs from assets/neofetch.txt');
  if (/<div align="center">\s*$/.test(readme.slice(0, fence.index))) {
    problems.push('block sits inside <div align="center"> — GitHub centres each line separately and skews the art');
  }
}

if (problems.length) {
  console.error('NEOFETCH CHECK FAILED:');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}

const width = Math.max(...lines.map((l) => l.length));
console.log('NEOFETCH CHECK PASSED');
console.log(`  block:     assets/neofetch.txt (${lines.length} lines, ${width} cols, info column ${INFO_COL})`);
console.log(`  cat art:   ${artRows.length} rows`);
console.log(`  palette:   ${lines.filter((l) => l.includes(SWATCH)).length} swatch rows`);
console.log('  README.md: embeds the block verbatim, no centering wrapper');
