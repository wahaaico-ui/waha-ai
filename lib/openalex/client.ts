/**
 * OpenAlex API Client
 * Low-level API integration for querying research works
 * https://docs.openalex.org/
 *
 * Contract: this client NEVER invents data and NEVER hides a failure.
 * A failed call returns { ok: false, failure } carrying the real reason
 * (HTTP status + OpenAlex's own message). An empty `evidence` array with
 * ok: true means OpenAlex genuinely matched zero works.
 */

import {
  OpenAlexResponse,
  ResearchEvidence,
  OpenAlexWork,
  OpenAlexErrorBody,
  OpenAlexSearchResult,
  OpenAlexFailure,
} from '@/types/OpenAlex';

/** Fields we actually consume — keeps the payload small and the contract explicit. */
const SELECT_FIELDS = [
  'id',
  'title',
  'doi',
  'publication_year',
  'cited_by_count',
  'primary_location',
  'authorships',
  'abstract_inverted_index',
  'concepts',
].join(',');

export class OpenAlexClient {
  private static readonly BASE_URL = 'https://api.openalex.org/works';
  private static readonly TIMEOUT = 15000; // 15 seconds
  private static readonly MAX_ATTEMPTS = 3;
  /** OpenAlex caps per_page at 200. */
  private static readonly MAX_PER_PAGE = 200;

  /**
   * Contact address for the OpenAlex "polite pool", which gets far more
   * predictable rate limits than anonymous traffic.
   * https://docs.openalex.org/how-to-use-the-api/rate-limits-and-authentication
   */
  private static get contactEmail(): string {
    return process.env.OPENALEX_EMAIL?.trim() || '';
  }

  /**
   * Search for research works by query string.
   *
   * Defaults to relevance ranking. Sorting by `cited_by_count` instead makes
   * OpenAlex return the globally most-cited works that merely contain the
   * terms — e.g. an "AI in higher education" query returns NumPy and
   * cardiology guidelines — which is useless as topic evidence.
   */
  static async searchWorks(
    query: string,
    limit: number = 10,
    options: { sortBy?: 'relevance' | 'citations' } = {}
  ): Promise<OpenAlexSearchResult> {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      return {
        ok: false,
        failure: {
          code: 'API_ERROR',
          message: 'Search query is empty, so no OpenAlex request was made.',
        },
      };
    }

    const perPage = Math.min(Math.max(Math.trunc(limit) || 1, 1), this.MAX_PER_PAGE);

    const params = new URLSearchParams({
      search: trimmedQuery,
      per_page: String(perPage),
      sort:
        options.sortBy === 'citations' ? 'cited_by_count:desc' : 'relevance_score:desc',
      select: SELECT_FIELDS,
    });

    // `mailto` is how OpenAlex identifies polite-pool traffic.
    if (this.contactEmail) {
      params.set('mailto', this.contactEmail);
    }

    const url = `${this.BASE_URL}?${params.toString()}`;

    let lastFailure: OpenAlexFailure = {
      code: 'NETWORK_ERROR',
      message: 'OpenAlex request was never attempted.',
      requestUrl: url,
    };

    for (let attempt = 1; attempt <= this.MAX_ATTEMPTS; attempt++) {
      const outcome = await this.attemptRequest(url);

      if (outcome.ok) return outcome;

      lastFailure = outcome.failure;

      // Only transient conditions are worth retrying. A 400 will fail identically forever.
      if (!this.isRetryable(outcome.failure) || attempt === this.MAX_ATTEMPTS) {
        return outcome;
      }

      // Linear backoff: 1s, 2s.
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }

    return { ok: false, failure: lastFailure };
  }

  /** One HTTP attempt, with every failure mode mapped to a concrete reason. */
  private static async attemptRequest(url: string): Promise<OpenAlexSearchResult> {
    let response: Response;

    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': this.contactEmail
            ? `WAHA-AI/1.0 (${this.contactEmail})`
            : 'WAHA-AI/1.0',
        },
        signal: AbortSignal.timeout(this.TIMEOUT),
        cache: 'no-store',
      });
    } catch (error) {
      return { ok: false, failure: this.describeTransportError(error, url) };
    }

    if (!response.ok) {
      const body = await this.readErrorBody(response);
      const detail = [body.error, body.message].filter(Boolean).join(' ');

      return {
        ok: false,
        failure: {
          code: response.status === 429 ? 'RATE_LIMITED' : 'API_ERROR',
          message: detail
            ? `OpenAlex returned HTTP ${response.status}: ${detail}`
            : `OpenAlex returned HTTP ${response.status} ${response.statusText}.`,
          httpStatus: response.status,
          requestUrl: url,
        },
      };
    }

    let data: OpenAlexResponse;
    try {
      data = (await response.json()) as OpenAlexResponse;
    } catch (error) {
      return {
        ok: false,
        failure: {
          code: 'INVALID_RESPONSE',
          message: `OpenAlex returned a body that is not valid JSON: ${
            error instanceof Error ? error.message : String(error)
          }`,
          httpStatus: response.status,
          requestUrl: url,
        },
      };
    }

    if (!Array.isArray(data?.results)) {
      return {
        ok: false,
        failure: {
          code: 'INVALID_RESPONSE',
          message: 'OpenAlex response is missing the expected "results" array.',
          httpStatus: response.status,
          requestUrl: url,
        },
      };
    }

    return {
      ok: true,
      evidence: this.transformWorks(data.results),
      totalAvailable: data.meta?.count ?? data.results.length,
      requestUrl: url,
    };
  }

  /** Turn a thrown fetch/abort error into a reason a human can act on. */
  private static describeTransportError(error: unknown, url: string): OpenAlexFailure {
    // AbortSignal.timeout() rejects with a DOMException named 'TimeoutError'.
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      return {
        code: 'TIMEOUT',
        message: `OpenAlex did not respond within ${this.TIMEOUT / 1000}s.`,
        requestUrl: url,
      };
    }

    // Node surfaces DNS/TLS/connection problems as a TypeError with a `cause`.
    const cause = (error as { cause?: unknown })?.cause;
    const causeText =
      cause instanceof Error
        ? `${cause.message}${(cause as { code?: string }).code ? ` (${(cause as { code?: string }).code})` : ''}`
        : undefined;

    return {
      code: 'NETWORK_ERROR',
      message: `Could not reach api.openalex.org: ${
        causeText || (error instanceof Error ? error.message : String(error))
      }`,
      requestUrl: url,
    };
  }

  private static async readErrorBody(response: Response): Promise<OpenAlexErrorBody> {
    try {
      const text = await response.text();
      if (!text) return {};
      try {
        return JSON.parse(text) as OpenAlexErrorBody;
      } catch {
        return { message: text.slice(0, 300) };
      }
    } catch {
      return {};
    }
  }

  private static isRetryable(failure: OpenAlexFailure): boolean {
    if (failure.code === 'TIMEOUT' || failure.code === 'NETWORK_ERROR') return true;
    if (failure.code === 'RATE_LIMITED') return true;
    // Server-side hiccups only; 4xx is a bad request on our side.
    return failure.httpStatus !== undefined && failure.httpStatus >= 500;
  }

  /**
   * Transform OpenAlex work objects to ResearchEvidence format
   */
  private static transformWorks(works: OpenAlexWork[]): ResearchEvidence[] {
    return works.map(work => ({
      title: this.normalizeTitle(work.title),
      publicationYear: work.publication_year ?? null,
      doi: work.doi || null,
      openalexId: work.id,
      citationCount: work.cited_by_count ?? 0,
      journal: work.primary_location?.source?.display_name || null,
      authors: (work.authorships || [])
        .map(a => a?.author?.display_name)
        .filter((name: string | null | undefined): name is string => Boolean(name)),
      abstract: this.reconstructAbstract(work.abstract_inverted_index),
      concepts: (work.concepts || [])
        .map((c: { display_name?: string | null }) => c?.display_name)
        .filter((name: string | null | undefined): name is string => Boolean(name)),
      countries: this.extractCountries(work),
      openalexUrl: work.id,
    }));
  }

  /**
   * Affiliation countries for a work, deduplicated.
   * OpenAlex exposes them twice: `authorships[].countries` (newer) and
   * `authorships[].institutions[].country_code`. Both are read because older
   * records only carry the institution form, and works with no affiliation
   * data at all legitimately yield an empty array.
   */
  private static extractCountries(work: OpenAlexWork): string[] {
    const codes = new Set<string>();

    for (const authorship of work.authorships || []) {
      for (const code of authorship?.countries || []) {
        if (code) codes.add(code.trim().toUpperCase());
      }
      for (const institution of authorship?.institutions || []) {
        const code = institution?.country_code;
        if (code) codes.add(code.trim().toUpperCase());
      }
    }

    return [...codes];
  }

  /**
   * OpenAlex titles carry publisher markup, e.g.
   * "Diagnosis and Classification of Diabetes:<i>Standards of Care</i>".
   * React escapes it, so the tags would show up literally on screen.
   */
  private static normalizeTitle(title?: string): string {
    if (!title) return 'Untitled';

    const stripped = title
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    return stripped || 'Untitled';
  }

  /**
   * Reconstruct abstract from OpenAlex's inverted index (word -> positions).
   */
  private static reconstructAbstract(invertedIndex?: Record<string, number[]>): string | null {
    if (!invertedIndex) return null;

    const entries = Object.entries(invertedIndex);
    if (entries.length === 0) return null;

    // Reduce instead of Math.max(...spread) — a long abstract can blow the argument limit.
    let highestPosition = -1;
    for (const [, positions] of entries) {
      for (const position of positions) {
        if (position > highestPosition) highestPosition = position;
      }
    }

    if (highestPosition < 0) return null;

    const words = new Array<string>(highestPosition + 1).fill('');
    for (const [word, positions] of entries) {
      for (const position of positions) {
        words[position] = word;
      }
    }

    const abstract = words.filter(Boolean).join(' ').trim();
    return abstract || null;
  }
}
