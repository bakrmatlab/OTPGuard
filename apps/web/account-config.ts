// Server-only configuration gate; never serialize the secret or forward it to the extension.
export function webAccountConfigured() {
  return (
    !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_live_') &&
    !!process.env.CLERK_SECRET_KEY?.startsWith('sk_live_')
  );
}
