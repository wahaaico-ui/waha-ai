import { renderToStaticMarkup } from 'react-dom/server';
import SampleSizeCalculator from './SampleSizeCalculator';
jest.mock('./SampleSizeCalculator.module.css', () => ({}));

test.each(['ar','en'] as const)('public calculator renders without an account or network in %s', language => {
  const html = renderToStaticMarkup(<SampleSizeCalculator language={language}/>);
  expect(html).toContain('role="tablist"'); expect(html).toContain('role="tabpanel"');
  expect(html).toContain('data-testid="sample-completed">385');
  expect(html).toContain('Krejcie &amp; Morgan'); expect(html).toContain('PNG');
  expect(html).toContain('001316447003000308'); expect(html).not.toContain('href="/login"');
  if (language === 'en') expect(html).not.toMatch(/[\u0600-\u06ff]/);
});
