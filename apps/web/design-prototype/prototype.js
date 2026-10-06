/* Throwaway, synthetic design review. No extension APIs, providers or persistence. */
/* global document, window, URL */
const main = document.querySelector('#main');
const screens = new Set([
  'home',
  'manage',
  'popups',
  'setup',
  'activity',
  'help',
]);
let currentScreen;

function renderScreen() {
  const requested = window.location.hash.slice(1) || 'home';
  if (requested === 'demo' && currentScreen === 'home') return;
  const screen = screens.has(requested) ? requested : 'home';
  main.replaceChildren(
    document.querySelector(`#${screen}`).content.cloneNode(true),
  );
  currentScreen = screen;
  document.querySelectorAll('.review-bar a').forEach((link) => {
    if (link.hash === `#${screen}`) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  document.title = `OTPGuard — ${screen === 'home' ? 'Homepage' : screen[0].toUpperCase() + screen.slice(1)} prototype`;
  bindScreen(screen);
  if (requested === 'demo') document.querySelector('#demo').scrollIntoView();
  else window.scrollTo(0, 0);
  if (window.location.hash && requested !== 'demo')
    main.focus({ preventScroll: true });
}

function bindScreen(screen) {
  if (screen === 'home') {
    const input = main.querySelector('#demo-code');
    const fill = main.querySelector('.demo-fill');
    const status = main.querySelector('.demo-result');
    fill.addEventListener('click', () => {
      if (input.value) return;
      input.value = '047291';
      input.classList.add('filled');
      status.textContent = 'Example code inserted. Nothing was submitted.';
      main.querySelector('.demo-popup .popup-status').textContent =
        'Code inserted';
      fill.hidden = true;
    });
    main.querySelector('.reset-demo').addEventListener('click', () => {
      input.value = '';
      input.classList.remove('filled');
      status.textContent = 'Waiting for your click.';
      main.querySelector('.demo-popup .popup-status').textContent =
        'Code found';
      fill.hidden = false;
    });
  }
  if (screen === 'manage') {
    const feedback = main.querySelector('.action-feedback');
    const toggle = main.querySelector('.switch');
    toggle.addEventListener('click', () => {
      const enabled = toggle.getAttribute('aria-checked') !== 'true';
      toggle.setAttribute('aria-checked', String(enabled));
      feedback.textContent = `Example automatic finding ${enabled ? 'on' : 'off'}. Your extension has not changed.`;
    });
    main
      .querySelector('[data-action="account"]')
      .addEventListener('click', (event) => {
        const row = event.currentTarget.closest('.setting-row');
        const signedIn = event.currentTarget.textContent === 'Sign out';
        event.currentTarget.textContent = signedIn ? 'Sign in' : 'Sign out';
        row.querySelector('.state-tag').textContent = signedIn
          ? 'Example signed out'
          : 'Example signed in';
        row.querySelector('.state-tag').classList.toggle('off', signedIn);
        feedback.textContent =
          'Example account state changed. Your real session has not changed.';
      });
    main
      .querySelector('[data-action="mailbox"]')
      .addEventListener('click', (event) => {
        const connected = event.currentTarget.textContent === 'Disconnect';
        event.currentTarget.textContent = connected
          ? 'Connect Gmail'
          : 'Disconnect';
        main.querySelector('#mailbox-state').textContent = connected
          ? 'Example disconnected'
          : 'Example connected';
        main.querySelector('#mailbox-state').classList.toggle('off', connected);
        feedback.textContent =
          'Example mailbox state changed. No provider request was made.';
      });
    main.querySelector('#blocks').addEventListener('click', (event) => {
      if (!event.target.closest('.remove-block')) return;
      event.target.closest('.blocked-row').remove();
      if (!main.querySelector('.blocked-row')) {
        const empty = document.createElement('p');
        empty.className = 'fine empty-blocks';
        empty.textContent = 'No sites blocked in this example.';
        main.querySelector('#blocks').append(empty);
      }
      feedback.textContent =
        'Example block removed. Your extension has not changed.';
      main.querySelector('#block-url').focus();
    });
    main.querySelector('.add-block').addEventListener('click', () => {
      const input = main.querySelector('#block-url');
      const status = main.querySelector('#block-feedback');
      let url;
      try {
        url = new URL(input.value);
      } catch {
        status.textContent =
          'Enter a full HTTPS origin, such as https://example.test.';
        input.focus();
        return;
      }
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.pathname !== '/' ||
        url.search ||
        url.hash
      ) {
        status.textContent =
          'Use an HTTPS origin without a path, query or credentials.';
        input.focus();
        return;
      }
      const existing = [...main.querySelectorAll('.blocked-row h3')].some(
        (node) => node.textContent === url.origin,
      );
      if (existing) {
        status.textContent = 'That site is already blocked in this example.';
        return;
      }
      main.querySelector('.empty-blocks')?.remove();
      const row = document.createElement('div');
      row.className = 'setting-row blocked-row';
      const symbol = document.createElement('span');
      symbol.className = 'block-symbol';
      symbol.setAttribute('aria-hidden', 'true');
      symbol.textContent = '⊘';
      const copy = document.createElement('div');
      copy.className = 'row-copy';
      const heading = document.createElement('h3');
      heading.textContent = url.origin;
      copy.append(heading);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'button secondary remove-block';
      remove.textContent = 'Remove';
      row.append(symbol, copy, remove);
      main.querySelector('#blocks').append(row);
      input.value = '';
      status.textContent =
        'Example site added. Your extension has not changed.';
    });
  }
  if (screen === 'popups') {
    main.querySelector('.state-fill').addEventListener('click', (event) => {
      event.currentTarget
        .closest('.popup')
        .querySelector('.popup-status').textContent = 'Code inserted';
      event.currentTarget.hidden = true;
    });
    main.querySelectorAll('.state-find, .state-retry').forEach((button) =>
      button.addEventListener('click', () => {
        button.closest('.popup').querySelector('.popup-status').textContent =
          'Finding a code…';
        button.closest('.popup').querySelector('p').textContent =
          'Synthetic search preview. No mailbox is accessed.';
        button.hidden = true;
      }),
    );
    const refusals = {
      none: ['No code found', 'Request a new code, then retry.', true],
      ambiguous: [
        'Multiple possible codes',
        'Use the code from your email.',
        false,
      ],
      changed: ['Page changed', 'Return to the code field, then retry.', true],
      reconnect: ['Reconnect Gmail', 'Open OTPGuard to reconnect.', false],
      blocked: ['Site blocked', 'Manage blocked sites on OTPGuard.', false],
      unsupported: ['Field not supported', 'Enter your code manually.', false],
      expired: ['Code expired', 'Request a new code, then retry.', true],
      replay: ['Code already used', 'Request a new code, then retry.', true],
    };
    main.querySelector('#failure-state').addEventListener('change', (event) => {
      const [title, explanation, retry] = refusals[event.currentTarget.value];
      const popup = main.querySelector('.popup-case:last-child .popup');
      popup.querySelector('.popup-status').textContent = title;
      popup.querySelector('p').textContent = explanation;
      popup.querySelector('button').hidden = !retry;
    });
  }
}

window.addEventListener('hashchange', renderScreen);
renderScreen();
