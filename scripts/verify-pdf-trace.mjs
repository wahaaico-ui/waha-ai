// Regression check for the deployed /api/academic/parse-pdf function.
//
// On Vercel a route function contains only the files Next.js traced for it.
// pdfjs-dist loads its worker and @napi-rs/canvas by run-time paths, so a
// missing trace entry makes every upload fail with "Unable to parse PDF." in
// production while `next dev` still works. Run after `next build`:
//   npm run test:pdf-trace
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import PDFDocument from 'pdfkit';

const root = process.cwd();
const tracePath = path.join(root, '.next/server/app/api/academic/parse-pdf/route.js.nft.json');
if (!existsSync(tracePath)) {
  console.error('No build trace found. Run `next build` before `npm run test:pdf-trace`.');
  process.exit(1);
}

const traced = JSON.parse(readFileSync(tracePath, 'utf8')).files
  .map((file) => path.relative(root, path.resolve(path.dirname(tracePath), file)))
  .filter((file) => !file.startsWith('..'));

assert.ok(traced.some((file) => file.endsWith('pdfjs-dist/legacy/build/pdf.worker.mjs')), 'pdfjs worker (pdf.worker.mjs) is missing from the parse-pdf trace');
assert.ok(traced.some((file) => file.includes('node_modules/@napi-rs/canvas/')), '@napi-rs/canvas is missing from the parse-pdf trace');
assert.ok(traced.some((file) => file.includes('@napi-rs/canvas-') && file.endsWith('.node')), 'The @napi-rs/canvas native binary is missing from the parse-pdf trace');

// Rebuild the function's file set in isolation and parse a real text PDF with it.
const bundle = mkdtempSync(path.join(tmpdir(), 'waha-pdf-trace-'));
try {
  for (const file of traced) {
    const source = path.join(root, file);
    const target = path.join(bundle, file);
    mkdirSync(path.dirname(target), { recursive: true });
    // Next.js traces its external-package links (.next/node_modules/<pkg>-<hash>)
    // as symlinks; keep them as links and skip plain directory entries.
    const entry = lstatSync(source);
    if (entry.isSymbolicLink()) symlinkSync(readlinkSync(source), target);
    else if (entry.isFile()) copyFileSync(source, target);
  }

  const marker = 'https://doi.org/10.1371/journal.pone.0298037';
  const pdf = await new Promise((resolve, reject) => {
    const document = new PDFDocument();
    const chunks = [];
    document.on('data', (chunk) => chunks.push(chunk));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);
    document.text('WAHA parse-pdf trace check').text(marker);
    document.end();
  });
  writeFileSync(path.join(bundle, 'sample.pdf'), pdf);
  writeFileSync(path.join(bundle, 'parse.mjs'), [
    "import { readFileSync } from 'node:fs';",
    "import { PDFParse } from 'pdf-parse';",
    "const parser = new PDFParse({ data: readFileSync('sample.pdf') });",
    'try { process.stdout.write((await parser.getText()).text); } finally { await parser.destroy(); }',
  ].join('\n'));

  const text = execFileSync(process.execPath, ['parse.mjs'], { cwd: bundle, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert.ok(text.includes(marker), 'The traced parse-pdf bundle did not extract the PDF text');
  console.log(`PASS parse-pdf trace includes the pdfjs worker and @napi-rs/canvas (${traced.length} files) and parses a text PDF in isolation`);
} finally {
  rmSync(bundle, { recursive: true, force: true });
}
