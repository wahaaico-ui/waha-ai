#!/usr/bin/env node
/**
 * Captures the public-metadata fixtures used by the real-source unit tests
 * from OpenAlex (CC0 metadata), so the tests run from committed files instead
 * of an uncommitted output/qa folder. Rerun only to refresh the fixtures:
 *   node scripts/capture-qa-fixtures.mjs
 * Records are metadata and abstracts as indexed; they are not validated as
 * peer-reviewed or independent studies.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(process.cwd(), 'src', 'lib', '__tests__', 'fixtures');
const API = 'https://api.openalex.org/works';
const SELECT = 'id,title,doi,publication_year,authorships,abstract_inverted_index,primary_location,type';
// The nursing case keeps a study whose abstract reports a negative finding first.
const NEGATIVE_FINDING = 'W1965271829';

const clean = (text) => text.replace(/\s+/g, ' ').trim();
function abstractOf(index) {
  if (!index) return '';
  const words = [];
  for (const [word, positions] of Object.entries(index)) for (const position of positions) words[position] = word;
  return clean(words.filter(Boolean).join(' '));
}
function record(work) {
  return {
    id: work.id.replace('https://openalex.org/', ''),
    title: clean(work.title || ''),
    abstract: abstractOf(work.abstract_inverted_index),
    authors: (work.authorships || []).map((item) => item.author?.display_name).filter(Boolean).slice(0, 6),
    year: work.publication_year,
    doi: work.doi || '',
    journal: work.primary_location?.source?.display_name || null,
    publicationType: work.type || 'article',
    url: work.doi || work.id,
  };
}
async function search(query, pages) {
  const works = [];
  for (let page = 1; page <= pages; page++) {
    const url = `${API}?search=${encodeURIComponent(query)}&filter=has_abstract:true,has_doi:true&per-page=50&page=${page}&select=${SELECT}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`OpenAlex ${response.status} for ${query}`);
    works.push(...(await response.json()).results.map(record));
  }
  return works;
}
const usable = (paper, maximum) => paper.title && paper.doi && paper.abstract.length >= 200 && paper.abstract.length <= maximum && paper.authors.length;
function unique(papers, count, maximum) {
  const seen = new Set();
  return papers.filter((paper) => {
    const key = paper.doi.toLowerCase();
    if (!usable(paper, maximum) || seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, count);
}

const first = record(await (await fetch(`${API}/${NEGATIVE_FINDING}?select=${SELECT}`)).json());
if (!first.abstract.includes('simulation did not significantly enhance')) throw new Error('The negative-finding study changed upstream.');
const nursing = [first, ...unique((await search('simulation nursing education', 2)).filter((paper) => paper.id !== first.id), 49, 1300)];
const selected = unique(await search('generative artificial intelligence higher education', 3), 50, 2500);
if (nursing.length !== 50 || selected.length !== 50) throw new Error(`Not enough usable records: ${nursing.length}, ${selected.length}`);

const checkedAt = new Date().toISOString();
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'nursing-simulation.json'), `${JSON.stringify({
  checkedAt, query: 'simulation nursing education', source: 'OpenAlex',
  papers: nursing.map(({ id, title, abstract, authors, year }) => ({ id, title, abstract, authors, year, source: 'openalex' })),
}, null, 2)}\n`);
writeFileSync(join(OUT, 'real-source-inputs.json'), `${JSON.stringify({
  checkedAt, query: 'generative artificial intelligence higher education', source: 'OpenAlex',
  selected: selected.map((paper) => ({ ...paper, authors: paper.authors.join(', '), source: 'openalex' })),
}, null, 2)}\n`);
console.log(`nursing ${nursing.length}, selected ${selected.length}`);
