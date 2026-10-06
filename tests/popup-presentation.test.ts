import { expect, it } from 'vitest';
import { popupPresentation } from '../apps/extension/popup-state';
it('offers Fill only for a signed-in current offer, never uncertainty or setup', () => {
  expect(
    popupPresentation(
      { state: 'READY', requestId: 'synthetic' },
      'SIGNED_IN',
      true,
    ).fill,
  ).toBe(true);
  for (const account of [
    'CHECKING',
    'SIGN_IN_REQUIRED',
    'SIGN_OUT_FAILED',
    'UNCONFIGURED',
  ])
    expect(
      popupPresentation(
        { state: 'READY', requestId: 'synthetic' },
        account,
        true,
      ).fill,
    ).toBe(false);
  expect(popupPresentation({ state: 'READY' }, 'SIGNED_IN', true).fill).toBe(
    false,
  );
  expect(
    popupPresentation(
      { state: 'READY', requestId: 'synthetic', replay: 'already-used' },
      'SIGNED_IN',
      true,
    ).fill,
  ).toBe(false);
  for (const state of [
    'SEARCHING',
    'FILLING',
    'UNKNOWN',
    'BLOCKED',
    'MISMATCH',
    'CANCELLED',
    'REPLAY_REFUSED',
    'EMAIL_CONFIRMATION_REQUIRED',
  ])
    expect(
      popupPresentation({ state, requestId: 'synthetic' }, 'SIGNED_IN', true)
        .fill,
    ).toBe(false);
});
it('keeps the popup minimal and explains uncertainty without exposing secrets', () => {
  expect(
    popupPresentation(
      { state: 'UNKNOWN', reason: 'ambiguity' },
      'SIGNED_IN',
      true,
    ),
  ).toMatchObject({
    title: 'Multiple possible codes',
    fill: false,
    retry: false,
  });
  expect(
    popupPresentation({ state: 'DELIVERY_UNCONFIRMED' }, 'SIGNED_IN', true)
      .detail,
  ).toContain('Check the site');
  expect(
    popupPresentation({ state: 'SEARCHING' }, 'SIGNED_IN', true),
  ).toMatchObject({ fill: false, retry: false, busy: true });
});
it('offers an actionable website-access explanation and avoids retrying Gmail failures', () => {
  expect(
    popupPresentation({ state: 'IDLE' }, 'SIGNED_IN', false),
  ).toMatchObject({
    title: 'Website access needed',
    fill: false,
    retry: false,
  });
  expect(
    popupPresentation(
      { state: 'UNKNOWN', retrievalIssue: 'mailbox' },
      'SIGNED_IN',
      true,
    ).retry,
  ).toBe(false);
});
