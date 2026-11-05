// Migration files are applied by more than one tool (psql, the Supabase SQL
// editor, the Supabase CLI) and sometimes pasted by hand. Slice 2A's first
// migration could not be applied in production: its resolver function was
// missing when the following REVOKE ran. These checks keep migrations from
// 20261005000000 onward free of constructs that SQL tools split differently
// (apostrophes or semicolons in comments, unlabeled dollar quotes, dollar signs
// in string literals) and require every function a migration grants or
// revokes to be created in the same file.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations');
const FIRST_CHECKED = '20261005000000';
const files = readdirSync(MIGRATIONS).filter((name) => name.endsWith('.sql') && name >= FIRST_CHECKED).sort();

/** Splits SQL on semicolons outside quotes and dollar quotes; optionally ignores comments. */
function splitStatements(sql: string, commentAware: boolean) {
  const statements: string[] = [];
  let current = '';
  let quoted = false;
  let tag: string | null = null;
  for (let index = 0; index < sql.length;) {
    if (tag) {
      if (sql.startsWith(tag, index)) { current += tag; index += tag.length; tag = null; } else { current += sql[index]; index += 1; }
      continue;
    }
    const char = sql[index];
    if (quoted) { current += char; quoted = char !== "'"; index += 1; continue; }
    if (commentAware && sql.startsWith('--', index)) {
      const end = sql.indexOf('\n', index);
      const stop = end < 0 ? sql.length : end;
      current += sql.slice(index, stop); index = stop; continue;
    }
    const dollar = /^\$[A-Za-z_]*\$/.exec(sql.slice(index));
    if (dollar) { tag = dollar[0]; current += tag; index += tag.length; continue; }
    if (char === "'") { quoted = true; current += char; index += 1; continue; }
    if (char === ';') { statements.push(current.trim()); current = ''; index += 1; continue; }
    current += char; index += 1;
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

test('there is at least one checked migration', () => {
  expect(files).toContain('20261005000000_scholarly_works.sql');
});

describe.each(files)('%s', (file) => {
  const sql = readFileSync(join(MIGRATIONS, file), 'utf8');
  const commentLines = sql.split('\n').filter((line) => /^\s*--/.test(line));

  test('comments contain no apostrophes or semicolons', () => {
    expect(commentLines.filter((line) => /['`;]/.test(line))).toEqual([]);
  });

  test('dollar quotes are labelled and dollar signs appear only in them', () => {
    expect(sql).not.toMatch(/\$\$/);
    const withoutTags = sql.replace(/\$[A-Za-z_]+\$/g, '');
    expect(withoutTags).not.toMatch(/\$/);
  });

  test('statements split the same whether or not a tool understands comments', () => {
    expect(splitStatements(sql, false)).toEqual(splitStatements(sql, true));
  });

  test('every function granted, revoked or looked up is created in the same migration, before it is used', () => {
    const statements = splitStatements(sql, true).map((statement) => statement.toLowerCase());
    const names = new Set([
      ...[...sql.toLowerCase().matchAll(/\bon function\s+([a-z_.]+)\s*\(/g)].map((match) => match[1]),
      ...[...sql.toLowerCase().matchAll(/to_regprocedure\('([a-z_.]+)\(/g)].map((match) => match[1]),
    ]);
    for (const name of names) {
      const created = statements.findIndex((statement) => new RegExp(`create (or replace )?function ${name.replace('.', '\\.')}\\(`).test(statement));
      const used = statements.findIndex((statement, index) => index !== created && (statement.includes(`on function ${name}(`) || statement.includes(`'${name}(`)));
      expect({ name, created: created >= 0 }).toEqual({ name, created: true });
      if (used >= 0) expect(created).toBeLessThan(used);
    }
  });
});

test('the Slice 2A migration aborts unless the resolver exists, checked with to_regprocedure', () => {
  const sql = readFileSync(join(MIGRATIONS, '20261005000000_scholarly_works.sql'), 'utf8');
  expect(sql).toContain("to_regprocedure('public.resolve_scholarly_works(jsonb)')");
  expect(sql).toMatch(/if v_resolver is null then\s+raise exception 'Slice 2A migration incomplete/);
  expect(sql).not.toMatch(/^\s*(grant|revoke)[^\n]*on function public\.resolve_scholarly_works/im);
});
