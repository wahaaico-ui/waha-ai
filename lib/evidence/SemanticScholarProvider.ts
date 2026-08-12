// @ts-nocheck
import type {
  SemanticScholarPaper,
  SemanticScholarSearchResult,
} from '@/types/SemanticScholar';

interface ApiPaper {
  paperId?: unknown;
  title?: unknown;
  abstract?: unknown;
  authors?: unknown;
  year?: unknown;
  citationCount?: unknown;
  referenceCount?: unknown;
  fieldsOfStudy?: unknown;
  venue?: unknown;
  externalIds?: unknown;
  url?: unknown;
}

interface ApiResponse {
  total?: unknown;
  data?: unknown;
  error?: unknown;
  message?: unknown;
}

const SEARCH_FIELDS = [
  'paperId',
  'title',
  'abstract',
  'authors',
  'year',
  'citationCount',
  'referenceCount',
  'fieldsOfStudy',
  'venue',
  'externalIds',
  'url',
].join(',');

export class SemanticScholarProvider {
  private static readonly SEARCH_URL =
    'https://api.semanticscholar.org/graph/v1/paper/search';
  private static readonly TIMEOUT_MS = 15_000;
  private static readonly MAX_LIMIT = 100;

  static async searchPapers(
    query: string,
    limit: number = 10
  ): Promise<SemanticScholarSearchResult> {
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      return {
        ok: false,
        failure: { code: 'API_ERROR', message: 'Semantic Scholar search query is empty.' },
      };
    }

    const requestedLimit = Math.min(
      Math.max(Number.isFinite(limit) ? Math.trunc(limit) : 10, 1),
      this.MAX_LIMIT
    );
    const params = new URLSearchParams({
      query: cleanQuery,
      limit: String(requestedLimit),
      fields: SEARCH_FIELDS,
    });
    const requestUrl = `${this.SEARCH_URL}?${params.toString()}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

    try {
      const headers: HeadersInit = { Accept: 'application/json' };
      const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY?.trim();
      if (apiKey) headers['x-api-key'] = apiKey;

      const response = await fetch(requestUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
        cache: 'no-store',
      });
      const body = (await response.json().catch(() => ({}))) as ApiResponse;

      if (!response.ok) {
        return {
          ok: false,
          failure: {
            code: response.status === 429 ? 'RATE_LIMITED' : 'API_ERROR',
            message: this.errorMessage(body, response.status),
            httpStatus: response.status,
          },
        };
      }

      if (!Array.isArray(body.data)) {
        return {
          ok: false,
          failure: {
            code: 'INVALID_RESPONSE',
            message: 'Semantic Scholar returned a response without a data array.',
          },
        };
      }

      return {
        ok: true,
        papers: body.data
          .map(item => this.transform(item as ApiPaper))
          .filter((paper): paper is SemanticScholarPaper => paper !== null),
        totalAvailable: this.number(body.total),
        requestUrl,
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          ok: false,
          failure: { code: 'TIMEOUT', message: 'Semantic Scholar request timed out.' },
        };
      }

      return {
        ok: false,
        failure: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Semantic Scholar network error.',
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private static transform(paper: ApiPaper): SemanticScholarPaper | null {
    const paperId = this.string(paper.paperId);
    const title = this.string(paper.title);
    if (!paperId || !title) return null;

    const authors = Array.isArray(paper.authors)
      ? paper.authors
          .map(author => {
            if (!author || typeof author !== 'object') return null;
            const value = author as Record<string, unknown>;
            const name = this.string(value.name);
            return name ? { authorId: this.string(value.authorId), name } : null;
          })
          .filter((author): author is { authorId: string | null; name: string } => author !== null)
      : [];
    const externalIds =
      paper.externalIds && typeof paper.externalIds === 'object'
        ? (paper.externalIds as Record<string, unknown>)
        : {};

    return {
      paperId,
      title,
      abstract: this.string(paper.abstract) ?? undefined,
      authors,
      publicationYear: this.nullableNumber(paper.year),
      citationCount: this.number(paper.citationCount),
      referenceCount: this.number(paper.referenceCount),
      fieldsOfStudy: Array.isArray(paper.fieldsOfStudy)
        ? paper.fieldsOfStudy.map(this.string).filter((value): value is string => Boolean(value))
        : [],
      venue: this.string(paper.venue),
      doi: this.string(externalIds.DOI),
      url: this.string(paper.url) ?? undefined,
    };
  }

  private static errorMessage(body: ApiResponse, status: number): string {
    return (
      this.string(body.message) ||
      this.string(body.error) ||
      `Semantic Scholar request failed with HTTP ${status}.`
    );
  }

  private static string(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private static number(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }

  private static nullableNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }
}
