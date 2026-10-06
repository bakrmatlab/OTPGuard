import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    HTMLFormElement.prototype.submit = () => {
      throw new Error('Unexpected form.submit invocation');
    };
    HTMLFormElement.prototype.requestSubmit = () => {
      throw new Error('Unexpected form.requestSubmit invocation');
    };
    const click = HTMLElement.prototype.click;
    HTMLElement.prototype.click = function () {
      if (this instanceof HTMLButtonElement && this.type === 'submit')
        throw new Error('Unexpected submit-button click invocation');
      click.call(this);
    };
  });
  await page.goto('http://127.0.0.1:3001/insertion');
  await expect(page.locator('#react-single input')).toBeVisible();
});

for (const target of ['plain', 'react-single', 'react-split']) {
  test(`${target} preserves leading zero and updates DOM/framework state without submission`, async ({
    page,
  }) => {
    await page.locator('#target').selectOption(target);
    await page.locator('#fill').click();
    await expect(page.locator('#fill-result')).toHaveText(
      '{"status":"filled"}',
    );
    expect(
      await page
        .locator(`#${target} input`)
        .evaluateAll((fields) =>
          fields.map((field) => (field as HTMLInputElement).value).join(''),
        ),
    ).toBe('042681');
    if (target.startsWith('react'))
      await expect(page.locator(`#${target} output`)).toHaveText('042681');
    await expect(page.locator('#submissions')).toHaveText('0');
    await expect(page.locator('#submit-clicks')).toHaveText('0');
  });
  test(`${target} preserves user input and refuses repeat fills`, async ({
    page,
  }) => {
    await page.locator(`#${target} input`).first().fill('9');
    await page.locator('#target').selectOption(target);
    await page.locator('#fill').click();
    await expect(page.locator('#fill-result')).toContainText('user-value');
    await expect(page.locator(`#${target} input`).first()).toHaveValue('9');
    await page.locator(`#${target} input`).first().fill('');
    await page.locator('#fill').click();
    await expect(page.locator('#fill-result')).toContainText('filled');
    await page.locator('#fill').click();
    await expect(page.locator('#fill-result')).toContainText('user-value');
  });
}

test('invalid codes and incompatible single/split lengths reject without mutation or events', async ({
  page,
}) => {
  const results = await page.evaluate(async () => {
    const path = '/insertion.js';
    const { createDetector, insertCode } = await import(path);
    let events = 0;
    document.addEventListener('input', () => events++);
    document.addEventListener('change', () => events++);
    const groups = createDetector(document).scan().groups;
    const plain = groups.find(
      (group: { fields: HTMLInputElement[] }) =>
        group.fields[0]?.closest('form')?.id === 'plain',
    );
    const split = groups.find(
      (group: { fields: HTMLInputElement[] }) =>
        group.fields[0]?.closest('form')?.id === 'react-split',
    );
    const rejected = [
      insertCode(plain, '12345', 6),
      insertCode(plain, '12345', 5),
      insertCode(split, '12345', 5),
      insertCode(plain, '01$345', 6),
      insertCode(plain, '123456789', 9),
    ];
    return {
      rejected,
      events,
      values: Array.from(
        document.querySelectorAll('input'),
        (field) => field.value,
      ),
    };
  });
  expect(
    results.rejected.map((result: { status: string }) => result.status),
  ).toEqual(Array(5).fill('rejected'));
  expect(results.events).toBe(0);
  expect(results.values.every((value: string) => value === '')).toBe(true);
});

test('native setter bypasses instance setter and emits input then change', async ({
  page,
}) => {
  await page.locator('#plain input').evaluate((element) => {
    const input = element as HTMLInputElement;
    const get = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.get!;
    Object.defineProperty(input, 'value', {
      get,
      set() {
        throw new Error('instance setter called');
      },
    });
    const output = document.createElement('output');
    output.id = 'events';
    document.body.append(output);
    for (const type of ['input', 'change'])
      input.addEventListener(type, (event) => {
        output.textContent += `${event.type}:${event.bubbles}:${event.isTrusted};`;
      });
  });
  await page.locator('#fill').click();
  await expect(page.locator('#fill-result')).toContainText('filled');
  await expect(page.locator('#events')).toHaveText(
    'input:true:false;change:true:false;',
  );
});

test('stale, hidden, disabled and email fields and iframe targets fail safely', async ({
  page,
}) => {
  const results = await page.evaluate(async () => {
    const path = '/insertion.js';
    const { createDetector, insertCode } = await import(path);
    const input = document.querySelector('#plain input') as HTMLInputElement;
    const find = () =>
      createDetector(document)
        .scan()
        .groups.find(
          (group: { fields: HTMLInputElement[] }) => group.fields[0] === input,
        );
    const original = find();
    input.replaceWith(input.cloneNode());
    const results = [insertCode(original, '042681', 6)];
    const replacement = document.querySelector(
      '#plain input',
    ) as HTMLInputElement;
    const group = createDetector(document)
      .scan()
      .groups.find(
        (group: { fields: HTMLInputElement[] }) =>
          group.fields[0] === replacement,
      );
    replacement.disabled = true;
    results.push(insertCode(group, '042681', 6));
    replacement.disabled = false;
    replacement.hidden = true;
    results.push(insertCode(group, '042681', 6));
    replacement.hidden = false;
    replacement.type = 'email';
    results.push(insertCode(group, '042681', 6));
    const frame = document.createElement('iframe');
    frame.srcdoc = '<input autocomplete="one-time-code">';
    document.body.append(frame);
    await new Promise((resolve) =>
      frame.addEventListener('load', resolve, { once: true }),
    );
    results.push(
      insertCode(
        { ...group, fields: [frame.contentDocument!.querySelector('input')] },
        '042681',
        6,
      ),
    );
    return {
      results,
      values: [
        input.value,
        replacement.value,
        frame.contentDocument!.querySelector('input')!.value,
      ],
    };
  });
  expect(
    results.results.every(
      (result: { status: string }) => result.status === 'rejected',
    ),
  ).toBe(true);
  expect(results.values).toEqual(['', '', '']);
});

test('split page interference stops before overwriting a later value', async ({
  page,
}) => {
  await page.locator('#target').selectOption('react-split');
  await page.evaluate(() => {
    document.addEventListener(
      'input',
      () => {
        (
          document.querySelectorAll('#react-split input')[1] as HTMLInputElement
        ).value = '9';
      },
      { once: true },
    );
  });
  await page.locator('#fill').click();
  await expect(page.locator('#fill-result')).toContainText('page-interference');
  await expect(page.locator('#react-split input').nth(1)).toHaveValue('9');
  await expect(page.locator('#react-split input').nth(2)).toHaveValue('');
});

test('constraints changed by an input handler stop insertion', async ({
  page,
}) => {
  await page.locator('#plain input').evaluate((input) => {
    input.addEventListener(
      'input',
      () => {
        // Chromium rejects an IDL maxLength smaller than minLength; make the
        // changed range valid so this exercises interference rather than an exception.
        (input as HTMLInputElement).minLength = 0;
        (input as HTMLInputElement).maxLength = 0;
      },
      { once: true },
    );
  });
  await page.locator('#fill').click();
  await expect(page.locator('#fill-result')).toContainText('page-interference');
  await expect(page.locator('#submissions')).toHaveText('0');
});

test('retained acknowledgement catches asynchronous clearing and field replacement', async ({
  page,
}) => {
  const results = await page.evaluate(async () => {
    const modulePath = '/insertion.js';
    const { createDetector, insertCodeRetained } = await import(modulePath);
    const field = document.querySelector<HTMLInputElement>('#plain input')!;
    const group = () =>
      createDetector(document)
        .scan()
        .groups.find(
          (g: { fields: HTMLInputElement[] }) => g.fields[0] === field,
        );
    field.addEventListener(
      'input',
      () =>
        setTimeout(() => {
          field.value = '';
        }, 0),
      { once: true },
    );
    const cleared = await insertCodeRetained(group(), '042681', 6);
    field.value = '';
    field.addEventListener(
      'input',
      () =>
        setTimeout(() => {
          field.replaceWith(field.cloneNode());
        }, 0),
      { once: true },
    );
    const replaced = await insertCodeRetained(group(), '042681', 6);
    return [cleared, replaced];
  });
  expect(results).toEqual(
    Array(2).fill({ status: 'rejected', reason: 'page-interference' }),
  );
});

test('maxLength is an upper bound, exact patterns are enforced, and retained numeric fields preserve zeros', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const modulePath = '/insertion.js';
    const { createDetector, insertCodeRetained } = await import(modulePath);
    document.body.innerHTML =
      '<form><p>Your email verification code</p><input autocomplete="one-time-code" maxlength="8"></form>';
    const get = () => createDetector(document).scan().groups[0];
    const shorter = await insertCodeRetained(get(), '042681', 6);
    const field = document.querySelector('input')!;
    field.value = '';
    field.pattern = '[0-9]{8}';
    const pattern = await insertCodeRetained(get(), '042681', 6);
    field.pattern = '';
    field.type = 'number';
    const numeric = await insertCodeRetained(get(), '042681', 6);
    return { shorter, pattern, numeric, value: field.value };
  });
  expect(result).toEqual({
    shorter: { status: 'filled' },
    pattern: { status: 'rejected', reason: 'length' },
    numeric: { status: 'filled' },
    value: '042681',
  });
});

for (const interference of ['late-clear', 'constraint', 'transient-edit']) {
  test(`retention refuses ${interference} without a second insertion`, async ({
    page,
  }) => {
    const result = await page.evaluate(async (scenario) => {
      const modulePath = '/insertion.js';
      const { createDetector, insertCodeRetained } = await import(modulePath);
      const field = document.querySelector<HTMLInputElement>('#plain input')!;
      const group = createDetector(document)
        .scan()
        .groups.find(
          (g: { fields: HTMLInputElement[] }) => g.fields[0] === field,
        );
      let inputs = 0;
      field.addEventListener('input', () => inputs++);
      field.addEventListener(
        'input',
        () => {
          setTimeout(
            () => {
              if (scenario === 'late-clear') field.value = '';
              if (scenario === 'constraint') field.pattern = '[A-Z]{6}';
              if (scenario === 'transient-edit') {
                field.value = '9';
                field.dispatchEvent(new Event('input', { bubbles: true }));
                field.value = '042681';
              }
            },
            scenario === 'late-clear' ? 200 : 0,
          );
        },
        { once: true },
      );
      const result = await insertCodeRetained(group, '042681', 6);
      return { result, inputs, value: field.value };
    }, interference);
    expect(result.result).toEqual({
      status: 'rejected',
      reason: 'page-interference',
    });
    expect(result.inputs).toBe(interference === 'transient-edit' ? 2 : 1);
    expect(result.value).toBe(interference === 'late-clear' ? '' : '042681');
  });
}

for (const target of ['react-single', 'react-split']) {
  test(`${target} retains framework state through the observation window`, async ({
    page,
  }) => {
    const result = await page.evaluate(async (id) => {
      const path = '/insertion.js';
      const { createDetector, insertCodeRetained } = await import(path);
      const group = createDetector(document)
        .scan()
        .groups.find(
          (g: { fields: HTMLInputElement[] }) =>
            g.fields[0]?.closest('form')?.id === id,
        );
      return insertCodeRetained(group, '042681', 6);
    }, target);
    expect(result).toEqual({ status: 'filled' });
    await expect(page.locator(`#${target} output`)).toHaveText('042681');
    await expect(page.locator('#submissions')).toHaveText('0');
  });
}

test('site completion removes fields and is reported as interference without extension submission', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const path = '/insertion.js';
    const { createDetector, insertCodeRetained } = await import(path);
    const field = document.querySelector<HTMLInputElement>('#plain input')!;
    const group = createDetector(document)
      .scan()
      .groups.find(
        (g: { fields: HTMLInputElement[] }) => g.fields[0] === field,
      );
    let completed = false;
    field.addEventListener(
      'input',
      () => {
        // A site's completion handler may transition without a form submission.
        completed = field.value === '042681';
        field.closest('form')!.remove();
      },
      { once: true },
    );
    return { result: await insertCodeRetained(group, '042681', 6), completed };
  });
  expect(result).toEqual({
    result: { status: 'rejected', reason: 'page-interference' },
    completed: true,
  });
  await expect(page.locator('#submissions')).toHaveText('0');
  await expect(page.locator('#submit-clicks')).toHaveText('0');
});
