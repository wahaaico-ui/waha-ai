import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isShareToken, newShareToken, parseShareSections, sharePath } from '@/lib/career-share';

describe('career share links (DOC-30-03)', () => {
  test('sections must be a known, non-empty choice, kept in a fixed order', () => {
    expect(parseShareSections(['directions', 'timeline'])).toEqual(['timeline', 'directions']);
    expect(parseShareSections([])).toBeNull();
    expect(parseShareSections(['timeline', 'projects'])).toBeNull();
    expect(parseShareSections('timeline')).toBeNull();
  });

  test('a token is 32 URL-safe random characters', () => {
    const token = newShareToken();
    expect(isShareToken(token)).toBe(true);
    expect(newShareToken()).not.toBe(token);
    expect(isShareToken('short')).toBe(false);
    expect(isShareToken('../../etc/passwd/aaaaaaaaaaaaaaaaaa')).toBe(false);
    expect(sharePath(token)).toBe(`/career/${token}`);
  });
});

describe('share link table', () => {
  const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20261112000000_career_share_links.sql'), 'utf8');

  test('only the owner reads, creates or revokes a link, and only one is active', () => {
    expect(sql).toContain('alter table public.career_share_links enable row level security');
    expect(sql).toContain('revoke all on table public.career_share_links from anon');
    expect(sql).toContain('grant update (revoked_at) on table public.career_share_links to authenticated');
    expect(sql.match(/using \(\(select auth\.uid\(\)\) = user_id\)/g)).toHaveLength(2);
    expect(sql).toMatch(/create unique index career_share_links_one_active[\s\S]*where revoked_at is null/);
  });

  test('visitors reach a link only through its token, and a revoked link returns nothing', () => {
    expect(sql).toMatch(/where links\.token = p_token and links\.revoked_at is null/);
    expect(sql).toContain('security definer');
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain('grant execute on function public.shared_career(text) to anon');
    expect(sql).not.toMatch(/grant select[^;]*to anon/);
  });
});
