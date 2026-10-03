import { ConvexError, v } from 'convex/values';
import { query, mutation, type QueryCtx } from './_generated/server';
import { settingsValue, providerStatusValue } from './schema';
import { defaultSettings, installationIdPattern } from '../packages/shared';
async function owner(ctx: QueryCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError('AUTH_REQUIRED');
  return identity.tokenIdentifier;
}
const reportValue = v.object({
  installationId: v.string(),
  providerStatus: providerStatusValue,
});
async function ownedInstallation(
  ctx: QueryCtx,
  installationId: string,
  user: string,
) {
  if (!installationIdPattern.test(installationId))
    throw new ConvexError('INVALID_INSTALLATION');
  const record = await ctx.db
    .query('installations')
    .withIndex('by_installation', (q) => q.eq('installationId', installationId))
    .unique();
  // Do not reveal whether a foreign ID exists.
  if (!record || record.owner !== user)
    throw new ConvexError('INSTALLATION_UNAVAILABLE');
  return record;
}
export const readSettings = query({
  args: {},
  returns: settingsValue,
  handler: async (ctx) => {
    const user = await owner(ctx);
    const record = await ctx.db
      .query('settings')
      .withIndex('by_owner', (q) => q.eq('owner', user))
      .unique();
    return record?.value ?? defaultSettings;
  },
});
export const writeSettings = mutation({
  args: { settings: settingsValue },
  returns: v.null(),
  handler: async (ctx, { settings }) => {
    const user = await owner(ctx);
    const record = await ctx.db
      .query('settings')
      .withIndex('by_owner', (q) => q.eq('owner', user))
      .unique();
    if (record) await ctx.db.patch(record._id, { value: settings });
    else await ctx.db.insert('settings', { owner: user, value: settings });
    return null;
  },
});
export const registerInstallation = mutation({
  args: { report: reportValue },
  returns: v.null(),
  handler: async (ctx, { report }) => {
    const user = await owner(ctx);
    if (!installationIdPattern.test(report.installationId))
      throw new ConvexError('INVALID_INSTALLATION');
    const record = await ctx.db
      .query('installations')
      .withIndex('by_installation', (q) =>
        q.eq('installationId', report.installationId),
      )
      .unique();
    if (record) {
      if (record.owner !== user)
        throw new ConvexError('INSTALLATION_UNAVAILABLE');
      // Registration is idempotent, never an ownership transfer.
      await ctx.db.patch(record._id, {
        providerStatus: report.providerStatus,
        lastSeenAt: Date.now(),
      });
    } else {
      const count = await ctx.db
        .query('installations')
        .withIndex('by_owner', (q) => q.eq('owner', user))
        .take(100);
      if (count.length >= 100) throw new ConvexError('INSTALLATION_LIMIT');
      await ctx.db.insert('installations', {
        owner: user,
        ...report,
        lastSeenAt: Date.now(),
      });
    }
    return null;
  },
});
export const reportProvider = mutation({
  args: { report: reportValue },
  returns: v.null(),
  handler: async (ctx, { report }) => {
    const user = await owner(ctx);
    const record = await ownedInstallation(ctx, report.installationId, user);
    await ctx.db.patch(record._id, {
      providerStatus: report.providerStatus,
      lastSeenAt: Date.now(),
    });
    return null;
  },
});
const installationValue = v.object({
  installationId: v.string(),
  providerStatus: providerStatusValue,
  lastSeenAt: v.number(),
});
export const readInstallation = query({
  args: { installationId: v.string() },
  returns: installationValue,
  handler: async (ctx, { installationId }) => {
    const record = await ownedInstallation(
      ctx,
      installationId,
      await owner(ctx),
    );
    return {
      installationId: record.installationId,
      providerStatus: record.providerStatus,
      lastSeenAt: record.lastSeenAt,
    };
  },
});
export const listInstallations = query({
  args: {},
  returns: v.array(installationValue),
  handler: async (ctx) => {
    const user = await owner(ctx);
    const records = await ctx.db
      .query('installations')
      .withIndex('by_owner', (q) => q.eq('owner', user))
      .take(100);
    return records.map((record) => ({
      installationId: record.installationId,
      providerStatus: record.providerStatus,
      lastSeenAt: record.lastSeenAt,
    }));
  },
});
