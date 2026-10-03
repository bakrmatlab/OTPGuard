import { ConvexError, v } from 'convex/values';
import {
  mutation,
  query,
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server';
import { makeFunctionReference } from 'convex/server';
import { activityValue } from './schema';
import {
  ACTIVITY_LIMIT,
  CLOUD_RETENTION_MS,
  parseActivity,
} from '../packages/shared';
import { cloudActivityPolicyApproved } from '../packages/shared/activity-policy';
import { supportedServices } from '../packages/security';
async function owner(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError('AUTH_REQUIRED');
  return identity.tokenIdentifier;
}
async function records(ctx: QueryCtx, user: string) {
  return ctx.db
    .query('activity')
    .withIndex('by_owner', (q) => q.eq('owner', user))
    .take(ACTIVITY_LIMIT);
}
const live = (time: number) =>
  Number.isSafeInteger(time) &&
  time > Date.now() - CLOUD_RETENTION_MS &&
  time <= Date.now();
async function erase(ctx: MutationCtx, user: string) {
  for (const record of await records(ctx, user))
    await ctx.db.delete(record._id);
}
export const setCloudHistory = mutation({
  args: { enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { enabled }) => {
    const user = await owner(ctx);
    if (enabled && !cloudActivityPolicyApproved())
      throw new ConvexError('POLICY_UNRESOLVED');
    const preference = await ctx.db
      .query('activityPreferences')
      .withIndex('by_owner', (q) => q.eq('owner', user))
      .unique();
    if (preference) await ctx.db.patch(preference._id, { enabled });
    else await ctx.db.insert('activityPreferences', { owner: user, enabled });
    if (!enabled) await erase(ctx, user);
    return null;
  },
});
export const append = mutation({
  args: { event: activityValue },
  returns: v.null(),
  handler: async (ctx, { event }) => {
    const user = await owner(ctx);
    const installation = await ctx.db
      .query('installations')
      .withIndex('by_installation', (q) =>
        q.eq('installationId', event.installationId),
      )
      .unique();
    if (!installation || installation.owner !== user)
      throw new ConvexError('INSTALLATION_UNAVAILABLE');
    if (!cloudActivityPolicyApproved())
      throw new ConvexError('POLICY_UNRESOLVED');
    const preference = await ctx.db
      .query('activityPreferences')
      .withIndex('by_owner', (q) => q.eq('owner', user))
      .unique();
    if (!preference?.enabled) throw new ConvexError('HISTORY_OFF');
    const parsed = parseActivity(
      event,
      supportedServices.map((service) => service.id),
    );
    if (!parsed || !live(parsed.time))
      throw new ConvexError('INVALID_ACTIVITY');
    const existing = await records(ctx, user);
    for (const record of existing)
      if (!live(record.event.time)) await ctx.db.delete(record._id);
    const retained = existing.filter((record) => live(record.event.time));
    if (retained.length >= ACTIVITY_LIMIT)
      await ctx.db.delete(retained[0]!._id);
    await ctx.db.insert('activity', { owner: user, event: parsed });
    return null;
  },
});
/** Export projects only the current owner's nonexpired closed records. */
export const exportHistory = query({
  args: {},
  returns: v.array(activityValue),
  handler: async (ctx) =>
    (await records(ctx, await owner(ctx)))
      .filter((record) => live(record.event.time))
      .map((record) => record.event),
});
export const deleteHistory = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await owner(ctx);
    const preference = await ctx.db
      .query('activityPreferences')
      .withIndex('by_owner', (q) => q.eq('owner', user))
      .unique();
    if (preference) await ctx.db.patch(preference._id, { enabled: false });
    await erase(ctx, user);
    return null;
  },
});
/** Hourly cleanup plus bounded continuation; inaccessible as a public endpoint. */
export const expire = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const expired = await ctx.db
      .query('activity')
      .withIndex('by_time', (q) =>
        q.lte('event.time', Date.now() - CLOUD_RETENTION_MS),
      )
      .take(100);
    for (const record of expired) await ctx.db.delete(record._id);
    if (expired.length === 100)
      await ctx.scheduler.runAfter(
        0,
        makeFunctionReference<'mutation'>('activity:expire'),
        {},
      );
    return null;
  },
});
/** Physical expiry is bounded and owner-scoped; production upload cannot populate it yet. */
export const prune = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    for (const record of await records(ctx, await owner(ctx)))
      if (!live(record.event.time)) await ctx.db.delete(record._id);
    return null;
  },
});
