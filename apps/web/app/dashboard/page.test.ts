import { beforeEach, expect, it, vi } from 'vitest';
const boundary = vi.hoisted(() => ({ configured: vi.fn(), protect: vi.fn() }));
vi.mock('../../account-config', () => ({
  webAccountConfigured: boundary.configured,
}));
vi.mock('@clerk/nextjs/server', () => ({
  auth: { protect: boundary.protect },
}));
vi.mock('../account', () => ({ Account: () => null }));
vi.mock('../dashboard', () => ({ Dashboard: () => null }));
import DashboardPage from './page';
beforeEach(() => vi.resetAllMocks());
it('requires a session before returning the configured dashboard', async () => {
  boundary.configured.mockReturnValue(true);
  const redirect = new Error('authentication redirect');
  boundary.protect.mockRejectedValue(redirect);
  await expect(DashboardPage()).rejects.toBe(redirect);
  expect(boundary.protect).toHaveBeenCalledWith({
    unauthenticatedUrl: '/sign-in',
  });
});
it('renders the dashboard after the session check succeeds', async () => {
  boundary.configured.mockReturnValue(true);
  boundary.protect.mockResolvedValue({ userId: 'test-user' });
  expect(await DashboardPage()).toBeDefined();
  expect(boundary.protect).toHaveBeenCalledOnce();
});
it('keeps the unconfigured preview independent of the provider', async () => {
  boundary.configured.mockReturnValue(false);
  expect(await DashboardPage()).toBeDefined();
  expect(boundary.protect).not.toHaveBeenCalled();
});
