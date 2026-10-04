export {};
const el = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const status = el<HTMLOutputElement>('status');
const email = el<HTMLInputElement>('identifier');
const password = el<HTMLInputElement>('password');
const secret = el<HTMLInputElement>('secret');
const form = el<HTMLFormElement>('account-form');
const next = el<HTMLButtonElement>('continue');
let creating = true;
let step:
  | 'account'
  | 'password'
  | 'email_code'
  | 'totp'
  | 'backup_code'
  | 'connected' = 'account';
let generation = 0;
const descriptions: Record<string, string> = {
  SIGN_IN_REQUIRED: 'Ready to continue.',
  EMAIL_VERIFICATION_REQUIRED:
    'Check your email for the Clerk verification code.',
  FIRST_FACTOR_REQUIRED: 'Enter your password to sign in.',
  SECOND_FACTOR_REQUIRED: 'Enter your authenticator code.',
  SIGNED_IN: 'Signed in. You can now check the cloud connection.',
  CONVEX_IDENTITY_VERIFIED: 'Cloud connection verified for your account.',
  SIGNED_OUT: 'Signed out of the extension.',
  LOCAL_SIGN_OUT: 'Local session cleared. Remote logout was not confirmed.',
  ACCOUNT_NOT_FOUND: 'No account found. Choose Create account.',
  PASSWORD_TOO_SHORT: 'Use a password of at least 15 characters.',
  PASSWORD_REJECTED:
    'Clerk rejected this password. Choose a different password or check your sign-in password.',
  CODE_REJECTED: 'That code was not accepted. Check it and try again.',
  PROVIDER_REJECTED:
    'Clerk could not complete this step. Check your details and try again.',
  UNSUPPORTED_FACTOR:
    'Clerk requires a verification method this prototype does not support. Start over to try again.',
  AUTH_UNAVAILABLE:
    'Connection or session unavailable. Start over to try again.',
  CANCELLED: 'Cancelled. You can start again.',
  BUSY: 'Another request is finishing. Try again shortly.',
};
function display(state: string) {
  status.dataset.state = state;
  status.textContent =
    descriptions[state] ?? 'This request could not be completed.';
}
function render() {
  const account = step === 'account';
  el('email-field').hidden = !account;
  el('password-field').hidden = !account || !creating;
  password.required = account && creating;
  email.required = account;
  el('factor-field').hidden = account || step === 'connected';
  secret.required = !account && step !== 'connected';
  el('modes').hidden = !account;
  form.hidden = step === 'connected';
  el('connected').hidden = step !== 'connected';
  el('use-email').hidden = step !== 'password';
  el('use-backup').hidden = step !== 'totp';
  el('back').hidden = account;
  el('heading').textContent =
    step === 'connected'
      ? 'Your account is connected'
      : account
        ? creating
          ? 'Create your account'
          : 'Sign in'
        : step === 'password'
          ? 'Enter your password'
          : 'Verify your account';
  el('description').textContent = account
    ? creating
      ? 'Use your email and a password of at least 15 characters.'
      : 'Enter the email for your OTPGuard account.'
    : step === 'connected'
      ? 'This session belongs to the extension.'
      : step === 'email_code'
        ? 'Enter the code Clerk sent to your email. Keep it in this browser.'
        : step === 'password'
          ? 'Use the password for your OTPGuard account.'
          : 'Complete the second verification step required by Clerk.';
  el('secret-label').textContent =
    step === 'password'
      ? 'Password'
      : step === 'email_code'
        ? 'Email verification code'
        : step === 'totp'
          ? 'Authenticator code'
          : 'Backup code';
  next.textContent = account
    ? creating
      ? 'Create account'
      : 'Continue'
    : step === 'password'
      ? 'Sign in'
      : 'Verify';
  el('create-mode').setAttribute('aria-pressed', String(creating));
  el('login-mode').setAttribute('aria-pressed', String(!creating));
}
async function send(message: Record<string, unknown>) {
  const result = await chrome.runtime.sendMessage(message);
  return typeof result?.state === 'string'
    ? (result.state as string)
    : 'AUTH_UNAVAILABLE';
}
async function run(operation: () => Promise<string>) {
  const before = generation;
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    'button:not(#back)',
  ))
    button.disabled = true;
  status.textContent = 'Connecting…';
  try {
    const state = await operation();
    if (before !== generation) return;
    if (state === 'SIGNED_IN') step = 'connected';
    if (state === 'FIRST_FACTOR_REQUIRED') step = 'password';
    if (state === 'SECOND_FACTOR_REQUIRED') step = 'totp';
    if (state === 'EMAIL_VERIFICATION_REQUIRED') step = 'email_code';
    if (state === 'SIGNED_OUT' || state === 'LOCAL_SIGN_OUT') step = 'account';
    render();
    display(state);
    if (!form.hidden) (step === 'account' ? email : secret).focus();
  } catch {
    if (before === generation) display('AUTH_UNAVAILABLE');
  } finally {
    for (const button of document.querySelectorAll<HTMLButtonElement>('button'))
      button.disabled = false;
  }
}
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const pass = password.value;
  const code = secret.value;
  password.value = secret.value = '';
  void run(async () => {
    if (step === 'account') {
      const state = await send(
        creating
          ? { action: 'register', identifier: email.value, secret: pass }
          : { action: 'start', identifier: email.value },
      );
      if (state === 'EMAIL_VERIFICATION_REQUIRED')
        return send({ action: 'email' });
      return state;
    }
    return send({ action: 'verify', strategy: step, secret: code });
  });
});
el('use-email').addEventListener('click', () => {
  secret.value = '';
  void run(async () => {
    const state = await send({ action: 'email' });
    if (state === 'FIRST_FACTOR_REQUIRED') {
      step = 'email_code';
      return 'EMAIL_VERIFICATION_REQUIRED';
    }
    return state;
  });
});
el('use-backup').addEventListener('click', () => {
  secret.value = '';
  step = 'backup_code';
  render();
  secret.focus();
});
for (const [id, mode] of [
  ['create-mode', true],
  ['login-mode', false],
] as const)
  el(id).addEventListener('click', () => {
    creating = mode;
    password.value = secret.value = '';
    render();
    display('SIGN_IN_REQUIRED');
  });
el('convex').addEventListener('click', () => {
  void run(() => send({ action: 'convex' }));
});
el('logout').addEventListener('click', () => {
  void run(() => send({ action: 'logout' }));
});
el('back').addEventListener('click', () => {
  generation++;
  password.value = secret.value = '';
  step = 'account';
  void send({ action: 'cancel' });
  render();
  display('CANCELLED');
});
render();
