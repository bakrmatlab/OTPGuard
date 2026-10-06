import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import Home from './page';
it('labels the public demo and renders an empty field with no submission or account data', () => {
  const html = renderToStaticMarkup(createElement(Home));
  expect(html).toContain('Synthetic demo');
  expect(html).toContain('value=""');
  expect(html).toContain('readOnly=""');
  expect(html).toContain('href="/setup"');
  expect(html).not.toMatch(
    /047291|<form|type="submit"|Canva|Example connected/,
  );
});
