/**
 * GET /api/openalex/health
 *
 * Live connectivity check against the real OpenAlex API.
 * Performs an actual query — nothing here is mocked or cached.
 *
 * Query params:
 *   q     — search query (default: a fixed probe query)
 *   limit — how many works to return (default 10, max 200)
 *
 * 200 => OpenAlex answered. 502 => it did not, and `error.message` says why.
 */

import { NextResponse } from 'next/server';
import { OpenAlexClient } from '@/lib/openalex/client';

export const dynamic = 'force-dynamic';

const DEFAULT_PROBE_QUERY = 'artificial intelligence higher education';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim() || DEFAULT_PROBE_QUERY;
  const limit = Number.parseInt(searchParams.get('limit') || '10', 10);

  const startedAt = Date.now();
  const result = await OpenAlexClient.searchWorks(query, Number.isNaN(limit) ? 10 : limit);
  const elapsedMs = Date.now() - startedAt;

  if (!result.ok) {
    return NextResponse.json(
      {
        reachable: false,
        query,
        elapsedMs,
        politePool: Boolean(process.env.OPENALEX_EMAIL),
        error: result.failure,
      },
      { status: 502 }
    );
  }

  return NextResponse.json(
    {
      reachable: true,
      query,
      elapsedMs,
      politePool: Boolean(process.env.OPENALEX_EMAIL),
      returned: result.evidence.length,
      totalAvailable: result.totalAvailable,
      requestUrl: result.requestUrl,
      papers: result.evidence.map(paper => ({
        title: paper.title,
        authors: paper.authors,
        publicationYear: paper.publicationYear,
        doi: paper.doi,
        citationCount: paper.citationCount,
        journal: paper.journal,
      })),
    },
    { status: 200 }
  );
}
