import { matchStructuredNames, resolveStructuredAuthorNames } from '@/lib/citations/author-names';

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

describe('matchStructuredNames', () => {
  test('accepts supplied family and given names that match the displayed names in order', () => {
    expect(matchStructuredNames(['Jill A. Boggs'], [{ family: 'Boggs', given: 'Jill A.' }])).toEqual([{ family: 'Boggs', given: 'Jill A.' }]);
    expect(matchStructuredNames(['Sibo Chen', 'Hossein Nassaji'], [{ family: 'Chen', given: 'Sibo' }, { family: 'Nassaji', given: 'Hossein' }]))
      .toEqual([{ family: 'Chen', given: 'Sibo' }, { family: 'Nassaji', given: 'Hossein' }]);
  });

  test('ignores case and accents when comparing the family name', () => {
    expect(matchStructuredNames(['Jorge Patricio Chávez Reinoso'], [{ family: 'CHAVEZ REINOSO', given: 'Jorge Patricio' }]))
      .toEqual([{ family: 'CHAVEZ REINOSO', given: 'Jorge Patricio' }]);
  });

  test('rejects a different number of authors, a different order or an unrelated family name', () => {
    expect(matchStructuredNames(['A Smith', 'B Jones'], [{ family: 'Smith', given: 'A' }])).toBeNull();
    expect(matchStructuredNames(['A Smith', 'B Jones'], [{ family: 'Jones', given: 'B' }, { family: 'Smith', given: 'A' }])).toBeNull();
    expect(matchStructuredNames(['Jill A. Boggs'], [{ family: 'Brown', given: 'Jill' }])).toBeNull();
    expect(matchStructuredNames([], [])).toBeNull();
  });

  test('keeps an organisation or a name without a supplied family name literal', () => {
    expect(matchStructuredNames(['WHO Working Group', 'Ana Ruiz'], [{ literal: 'WHO Working Group' }, { family: 'Ruiz', given: 'Ana' }]))
      .toEqual([{ literal: 'WHO Working Group' }, { family: 'Ruiz', given: 'Ana' }]);
  });
});

describe('resolveStructuredAuthorNames', () => {
  test('reads Crossref family and given names for the DOI', async () => {
    global.fetch = jest.fn().mockResolvedValue(json({ message: { author: [{ given: 'Jill A.', family: 'Boggs', sequence: 'first' }] } }));
    await expect(resolveStructuredAuthorNames('10.1016/j.jslw.2019.100671', ['Jill A. Boggs']))
      .resolves.toEqual({ names: [{ family: 'Boggs', given: 'Jill A.' }], source: 'crossref' });
    expect(String((global.fetch as jest.Mock).mock.calls[0][0])).toMatch(/^https:\/\/api\.crossref\.org\/works\/10\.1016%2Fj\.jslw\.2019\.100671\?mailto=/);
  });

  test('falls back to DataCite when Crossref does not register the DOI', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(json({ status: 'error' }, 404))
      .mockResolvedValueOnce(json({ data: { attributes: { creators: [{ name: 'Abbas, Rebaz Yaseen', nameType: 'Personal', givenName: 'Rebaz Yaseen', familyName: 'Abbas' }] } } }));
    await expect(resolveStructuredAuthorNames('10.5281/zenodo.15096622', ['Rebaz Yaseen Abbas']))
      .resolves.toEqual({ names: [{ family: 'Abbas', given: 'Rebaz Yaseen' }], source: 'datacite' });
  });

  test('returns null rather than guessing when the registry disagrees, fails or has no DOI', async () => {
    global.fetch = jest.fn().mockResolvedValue(json({ message: { author: [{ given: 'X', family: 'Other' }] } }));
    await expect(resolveStructuredAuthorNames('10.1000/x', ['Jill A. Boggs'])).resolves.toBeNull();
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));
    await expect(resolveStructuredAuthorNames('10.1000/x', ['Jill A. Boggs'])).resolves.toBeNull();
    global.fetch = jest.fn();
    await expect(resolveStructuredAuthorNames(null, ['Jill A. Boggs'])).resolves.toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
