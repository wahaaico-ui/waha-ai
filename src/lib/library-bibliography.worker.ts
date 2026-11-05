import { BibliographyEngine } from './citations/BibliographyEngine';
import { CITATION_STYLES, type CitationItem, type CitationStyle } from './citations/types';

// A dedicated worker: no cookies, credentials, network, or mutable shared cache.
const scope = globalThis as unknown as {
  onmessage: (event: MessageEvent<{ items: CitationItem[]; style: CitationStyle }>) => void;
  postMessage: (message: unknown) => void;
};
scope.onmessage = ({ data }) => {
  try {
    if (!Array.isArray(data.items) || !CITATION_STYLES.includes(data.style)) throw new Error('Invalid formatting request');
    scope.postMessage({ success: true, entries: BibliographyEngine.build(data.items, data.style) });
  } catch { scope.postMessage({ success: false }); }
};
