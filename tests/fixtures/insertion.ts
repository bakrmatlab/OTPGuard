import React from 'react';
import { createRoot } from 'react-dom/client';
import { createDetector } from '../../apps/extension/detection';
import { insertCode } from '../../apps/extension/insertion';

// Explicit fixture adapter, bundled only by the loopback fixture server.
const syntheticCode = '042681';
function Controlled({ split }: { split: boolean }) {
  const [values, setValues] = React.useState<string[]>(
    Array(split ? 6 : 1).fill(''),
  );
  return React.createElement(
    'form',
    { id: split ? 'react-split' : 'react-single' },
    React.createElement('p', null, 'Verification code sent to your email'),
    ...values.map((value, index) =>
      React.createElement('input', {
        key: index,
        value,
        maxLength: split ? 1 : 6,
        inputMode: 'numeric',
        autoComplete: 'one-time-code',
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
          const next = event.target.value;
          setValues((previous) =>
            previous.map((old, position) => (position === index ? next : old)),
          );
        },
      }),
    ),
    React.createElement('output', null, values.join('')),
    React.createElement('button', { type: 'submit' }, 'Submit fixture'),
  );
}
createRoot(document.querySelector('#react')!).render(
  React.createElement(
    React.Fragment,
    null,
    React.createElement(Controlled, { split: false }),
    React.createElement(Controlled, { split: true }),
  ),
);
let submissions = 0;
let clicks = 0;
document.addEventListener('submit', (event) => {
  event.preventDefault();
  submissions++;
  document.querySelector('#submissions')!.textContent = String(submissions);
});
document.addEventListener('click', (event) => {
  if ((event.target as Element).matches('button[type="submit"]')) {
    clicks++;
    document.querySelector('#submit-clicks')!.textContent = String(clicks);
  }
});
document.querySelector('#fill')!.addEventListener('click', () => {
  const target = (document.querySelector('#target') as HTMLSelectElement).value;
  const group = createDetector(document)
    .scan()
    .groups.find(
      (candidate) => candidate.fields[0]?.closest('form')?.id === target,
    );
  document.querySelector('#fill-result')!.textContent = JSON.stringify(
    group
      ? insertCode(group, syntheticCode, 6)
      : { status: 'rejected', reason: 'missing-group' },
  );
});
export { createDetector, insertCode };
