import { authProviders } from './authPolicy';
// Default remains production-only; the prototype is bound to the authorized dev deployment.
export default authProviders(
  process.env.CLERK_JWT_ISSUER_DOMAIN,
  process.env.OTPGUARD_AUTH_PROFILE,
  process.env.CONVEX_CLOUD_URL,
);
