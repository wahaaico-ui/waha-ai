import { availableAbstract } from '../research-abstracts';

test.each(['المستخلص غير متوفر', 'المستخلص غير متاح.', 'No abstract available', '', null])('missing abstract marker is not source content: %s', (value) => {
  expect(availableAbstract(value)).toBe('');
});
test('does not discard real content merely mentioning abstract availability', () => {
  expect(availableAbstract('Study findings discuss unavailable abstracts and access.')).toBe('Study findings discuss unavailable abstracts and access.');
});
