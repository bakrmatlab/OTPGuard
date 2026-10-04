import { createAccountGate } from '../../apps/extension/account/gate';

type RecordValue = Record<string, unknown>;
const providerRejections = [
  'PROVIDER_REJECTED',
  'ACCOUNT_NOT_FOUND',
  'PASSWORD_TOO_SHORT',
  'PASSWORD_REJECTED',
  'CODE_REJECTED',
  'CAPTCHA_REQUIRED',
  'BROWSER_TRANSPORT_UNSUPPORTED',
] as const;
const errors = new Set<string>([
  ...providerRejections,
  'UNSUPPORTED_FACTOR',
  'AUTH_UNAVAILABLE',
  'CANCELLED',
  'BUSY',
]);
export const publicAuthError = (error: unknown) =>
  error instanceof Error && errors.has(error.message)
    ? error.message
    : 'AUTH_UNAVAILABLE';
const providerCodes = new Map([
  ['form_identifier_not_found', 'ACCOUNT_NOT_FOUND'],
  ['form_password_length_too_short', 'PASSWORD_TOO_SHORT'],
  ['form_password_pwned', 'PASSWORD_REJECTED'],
  ['form_password_compromised', 'PASSWORD_REJECTED'],
  ['form_password_validation_failed', 'PASSWORD_REJECTED'],
  ['form_password_or_identifier_incorrect', 'PASSWORD_REJECTED'],
  ['form_code_incorrect', 'CODE_REJECTED'],
  ['captcha_missing_token', 'CAPTCHA_REQUIRED'],
  ['captcha_invalid', 'CAPTCHA_REQUIRED'],
  ['origin_authorization_headers_conflict', 'BROWSER_TRANSPORT_UNSUPPORTED'],
]);
const object = (value: unknown): RecordValue => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('INVALID_RESPONSE');
  return value as RecordValue;
};
const id = (value: unknown, prefix: string) => {
  if (
    typeof value !== 'string' ||
    !new RegExp(`^${prefix}_[A-Za-z0-9]+$`).test(value)
  )
    throw new Error('INVALID_RESPONSE');
  return value;
};
export function nativeOrigin(value: string) {
  const url = new URL(value);
  if (
    url.origin !== value ||
    url.protocol !== 'https:' ||
    url.port ||
    url.username ||
    url.password ||
    !/^[a-z0-9-]+\.clerk\.accounts\.dev$/.test(url.hostname)
  )
    throw new Error('EXACT_DEVELOPMENT_ORIGIN_REQUIRED');
  return value;
}
/** Experimental direct FAPI client. It has no storage, browser SDK or cookie fallback. */
export function createNativeAuth(
  frontendApi: string,
  request = fetch,
  now = Date.now,
) {
  const origin = nativeOrigin(frontendApi);
  let credential: string | undefined;
  let sessionId: string | undefined;
  let signIn: RecordValue | undefined;
  let registering = false;
  let epoch = 0;
  let busy = false;
  let closing = false;
  let idle = Promise.resolve();
  let controller = new AbortController();
  const reset = () => {
    epoch++;
    controller.abort();
    controller = new AbortController();
    credential = undefined;
    sessionId = undefined;
    signIn = undefined;
    registering = false;
    gate.invalidate();
  };
  async function call(
    path: string,
    method = 'GET',
    fields?: Record<string, string>,
  ) {
    if (!/^\/v1\/client(?:\/[A-Za-z0-9_/]+)?$/.test(path))
      throw new Error('INVALID_PATH');
    const generation = epoch;
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    if (credential) headers.Authorization = credential;
    const signal = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(15_000),
    ]);
    const response = await request(origin + path + '?_is_native=1', {
      method,
      headers,
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal,
      ...(method === 'GET' ? {} : { body: new URLSearchParams(fields) }),
    });
    if (generation !== epoch) throw new Error('CANCELLED');
    // Bound decoded bytes even when Content-Length is absent or untrusted.
    const reader = response.body?.getReader();
    if (!reader) throw new Error('INVALID_RESPONSE');
    let text = '';
    let bytes = 0;
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 256 * 1024) throw new Error('RESPONSE_TOO_LARGE');
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      await reader.cancel();
    }
    if (generation !== epoch) throw new Error('CANCELLED');
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) reset();
      const data = object(JSON.parse(text));
      const error = Array.isArray(data.errors) ? data.errors[0] : undefined;
      const code =
        error && typeof error === 'object' && typeof error.code === 'string'
          ? error.code
          : '';
      throw new Error(providerCodes.get(code) ?? 'PROVIDER_REJECTED');
    }
    const rotated = response.headers.get('Authorization');
    if (rotated) {
      if (rotated.length > 16_384 || /[\r\n]/.test(rotated))
        throw new Error('INVALID_RESPONSE');
      credential = rotated;
    }
    return object(JSON.parse(text));
  }
  async function exclusive<T>(
    operation: () => Promise<T>,
    logout = false,
  ): Promise<T> {
    if (busy || (closing && !logout)) throw new Error('BUSY');
    busy = true;
    let finished!: () => void;
    idle = new Promise<void>((resolve) => {
      finished = resolve;
    });
    try {
      return await operation();
    } catch (error) {
      gate.invalidate();
      // A failed credential rotation/transport cannot leave a usable stale identity.
      if (
        !(
          error instanceof Error &&
          (providerRejections as readonly string[]).includes(error.message)
        )
      )
        reset();
      // Provider/network errors may contain identifiers or credentials. Never retain a cause.
      // eslint-disable-next-line preserve-caught-error
      throw new Error(publicAuthError(error));
    } finally {
      busy = false;
      finished();
    }
  }
  const gate = createAccountGate(async () => {
    if (!credential || !sessionId) return null;
    const selected = sessionId;
    const generation = epoch;
    const client = object((await call('/v1/client')).response);
    if (client.last_active_session_id !== selected) {
      reset();
      return null;
    }
    const session = object(
      (await call(`/v1/client/sessions/${selected}`)).response,
    );
    const user = object(session.user);
    if (
      generation !== epoch ||
      sessionId !== selected ||
      session.id !== selected ||
      session.status !== 'active' ||
      typeof session.expire_at !== 'number' ||
      session.expire_at <= now()
    ) {
      reset();
      return null;
    }
    return {
      userId: id(user.id, 'user'),
      sessionId: selected,
      expiresAt: Math.min(session.expire_at, now() + 30_000),
      label: id(user.id, 'user'),
    };
  }, now);
  async function result(value: RecordValue) {
    signIn = object(value.response);
    id(signIn.id, registering ? 'sua' : 'sia');
    if (signIn.status === 'complete') {
      sessionId = id(signIn.created_session_id, 'sess');
      await call(`/v1/client/sessions/${sessionId}/touch`, 'POST', {
        intent: 'select_session',
      });
      signIn = undefined;
      if (!(await gate.refresh())) throw new Error('AUTH_UNAVAILABLE');
      return 'SIGNED_IN';
    }
    if (signIn.status === 'needs_first_factor') return 'FIRST_FACTOR_REQUIRED';
    if (signIn.status === 'needs_second_factor')
      return 'SECOND_FACTOR_REQUIRED';
    if (
      registering &&
      signIn.status === 'missing_requirements' &&
      Array.isArray(signIn.unverified_fields) &&
      signIn.unverified_fields.includes('email_address') &&
      Array.isArray(signIn.missing_fields) &&
      signIn.missing_fields.length === 0
    )
      return 'EMAIL_VERIFICATION_REQUIRED';
    throw new Error('UNSUPPORTED_FACTOR');
  }
  return {
    gate,
    cancel: reset,
    async register(identifier: string, password: string) {
      return exclusive(async () => {
        reset();
        if (!identifier || identifier.length > 254 || password.length > 1024)
          throw new Error('INVALID_IDENTIFIER');
        await call('/v1/client', 'POST');
        if (!credential) throw new Error('NATIVE_HEADER_UNAVAILABLE');
        registering = true;
        return result(
          await call('/v1/client/sign_ups', 'POST', {
            email_address: identifier,
            ...(password ? { password } : {}),
          }),
        );
      });
    },
    async start(identifier: string) {
      return exclusive(async () => {
        reset();
        if (!identifier || identifier.length > 254)
          throw new Error('INVALID_IDENTIFIER');
        await call('/v1/client', 'POST');
        if (!credential) throw new Error('NATIVE_HEADER_UNAVAILABLE');
        return result(
          await call('/v1/client/sign_ins', 'POST', { identifier }),
        );
      });
    },
    async prepareEmail() {
      return exclusive(async () => {
        if (registering && signIn) {
          return result(
            await call(
              `/v1/client/sign_ups/${id(signIn.id, 'sua')}/prepare_verification`,
              'POST',
              { strategy: 'email_code' },
            ),
          );
        }
        if (!signIn || signIn.status !== 'needs_first_factor')
          throw new Error('UNSUPPORTED_FACTOR');
        const factors = signIn.supported_first_factors;
        const factor = Array.isArray(factors)
          ? factors.map(object).find((x) => x.strategy === 'email_code')
          : undefined;
        if (!factor || typeof factor.email_address_id !== 'string')
          throw new Error('UNSUPPORTED_FACTOR');
        return result(
          await call(
            `/v1/client/sign_ins/${id(signIn.id, 'sia')}/prepare_first_factor`,
            'POST',
            {
              strategy: 'email_code',
              email_address_id: factor.email_address_id,
            },
          ),
        );
      });
    },
    async verify(
      strategy: 'password' | 'email_code' | 'totp' | 'backup_code',
      secret: string,
    ) {
      return exclusive(async () => {
        if (!signIn || !secret || secret.length > 1024)
          throw new Error('UNSUPPORTED_FACTOR');
        if (registering) {
          if (strategy !== 'email_code') throw new Error('UNSUPPORTED_FACTOR');
          return result(
            await call(
              `/v1/client/sign_ups/${id(signIn.id, 'sua')}/attempt_verification`,
              'POST',
              { strategy, code: secret },
            ),
          );
        }
        const second = signIn.status === 'needs_second_factor';
        const factors = second
          ? signIn.supported_second_factors
          : signIn.supported_first_factors;
        if (
          !Array.isArray(factors) ||
          !factors.some((x) => object(x).strategy === strategy)
        )
          throw new Error('UNSUPPORTED_FACTOR');
        return result(
          await call(
            `/v1/client/sign_ins/${id(signIn.id, 'sia')}/attempt_${second ? 'second' : 'first'}_factor`,
            'POST',
            {
              strategy,
              [strategy === 'password' ? 'password' : 'code']: secret,
            },
          ),
        );
      });
    },
    async status() {
      return exclusive(async () =>
        (await gate.refresh()) ? 'SIGNED_IN' : 'SIGN_IN_REQUIRED',
      );
    },
    async withConvexToken<T>(
      consume: (token: string, userId: string) => Promise<T>,
    ) {
      return exclusive(async () => {
        const bound = await gate.refresh();
        if (!bound) throw new Error('AUTH_UNAVAILABLE');
        const token = await call(
          `/v1/client/sessions/${bound.sessionId}/tokens/convex`,
          'POST',
        );
        if (
          typeof token.jwt !== 'string' ||
          token.jwt.length > 16_384 ||
          !(await gate.current(bound))
        )
          throw new Error('AUTH_UNAVAILABLE');
        const value = await consume(token.jwt, bound.userId);
        if (!(await gate.current(bound))) throw new Error('CANCELLED');
        return value;
      });
    },
    async signOut() {
      // Invalidate synchronously; late reads/token work cannot resurrect authority.
      const selected = sessionId;
      const saved = credential;
      if (closing) throw new Error('BUSY');
      closing = true;
      const pending = idle;
      reset();
      try {
        await pending;
        if (!selected || !saved) return 'LOCAL_SIGN_OUT';
        return await exclusive(async () => {
          credential = saved;
          try {
            await call(`/v1/client/sessions/${selected}/end`, 'POST');
            return 'SIGNED_OUT';
          } finally {
            reset();
          }
        }, true);
      } finally {
        closing = false;
      }
    },
  };
}
