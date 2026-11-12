const email = process.env.ACADEMIC_API_EMAIL || 'waha.ai.co@gmail.com';
const checks = [
  ['OpenAlex', true, `https://api.openalex.org/works?search=machine%20learning&per-page=1&mailto=${encodeURIComponent(email)}`],
  ['Semantic Scholar', true, 'https://api.semanticscholar.org/graph/v1/paper/search?query=machine%20learning&limit=1&fields=title'],
  ['Crossref', true, `https://api.crossref.org/works?query.bibliographic=machine%20learning&rows=1&mailto=${encodeURIComponent(email)}`],
  ['CORE', 'https://api.core.ac.uk/v3/search/works/?q=machine%20learning&limit=1'],
  ['arXiv', 'https://export.arxiv.org/api/query?search_query=all%3A%22machine%20learning%22&max_results=1'],
  ['Europe PMC', 'https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=cancer&format=json&pageSize=1'],
  ['OpenAIRE', 'https://api.openaire.eu/graph/v3/research-products?search=machine%20learning&page=1&pageSize=1'],
  ['PLOS', 'https://api.plos.org/search?q=machine%20learning&wt=json&rows=1'],
  ['DOAB', 'https://directory.doabooks.org/rest/search?query=education&limit=1'],
  ['DOAJ', 'https://doaj.org/api/search/articles/education?pageSize=1'],
  ['DataCite', 'https://api.datacite.org/dois?query=machine%20learning&page%5Bsize%5D=1'],
  ['PubMed', `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=cancer&retmode=json&retmax=1&tool=WAHA_AI&email=${encodeURIComponent(email)}`],
  ['OpenCitations', 'https://opencitations.net/index/api/v2/citation-count/doi:10.1038/nature12373'],
  ['Unpaywall', `https://api.unpaywall.org/v2/10.1371/journal.pone.0000308?email=${encodeURIComponent(email)}`],
  ['CiteAs', `https://api.citeas.org/product/10.1038/nature12373?email=${encodeURIComponent(email)}`],
].map(([name, criticalOrUrl, maybeUrl]) => typeof criticalOrUrl === 'boolean'
  ? { name, critical: criticalOrUrl, url: maybeUrl }
  : { name, critical: false, url: criticalOrUrl });

const results = await Promise.all(checks.map(async ({ name, critical, url }) => {
  try {
    const response = await fetch(url, { headers: { 'User-Agent': `WAHA-AI/1.0 (mailto:${email})` }, signal: AbortSignal.timeout(20_000) });
    const text = await response.text();
    return { name, critical, ok: response.ok && text.trim().length > 2, status: response.status };
  } catch (error) {
    return { name, critical, ok: false, status: error instanceof Error ? error.name : 'ERROR' };
  }
}));
console.table(results);
const criticalAvailable = results.filter((result) => result.critical && result.ok).length;
const totalAvailable = results.filter((result) => result.ok).length;
const degraded = results.filter((result) => !result.ok).map((result) => result.name);
console.log(`Academic integration quorum: ${criticalAvailable}/3 core, ${totalAvailable}/${results.length} total.`);
if (degraded.length > 0) console.warn(`Degraded providers (quorum remains authoritative): ${degraded.join(', ')}`);
if (criticalAvailable < 2 || totalAvailable < 6) process.exitCode = 1;
