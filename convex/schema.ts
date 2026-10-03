import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { supportedServices } from '../packages/security';
import { ACTIVITY_RESULTS, ACTIVITY_REASONS } from '../packages/shared';
export const settingsValue = v.object({ autofillEnabled: v.boolean() });
export const providerStatusValue = v.union(
  v.literal('DISCONNECTED'),
  v.literal('CONNECTED'),
  v.literal('RECONNECT_REQUIRED'),
);
export const activityValue = v.object({
  serviceId: v.union(
    v.null(),
    ...supportedServices.map((service) => v.literal(service.id)),
  ),
  action: v.literal('FILL'),
  result: v.union(...ACTIVITY_RESULTS.map((result) => v.literal(result))),
  reason: v.union(...ACTIVITY_REASONS.map((reason) => v.literal(reason))),
  time: v.number(),
  installationId: v.string(),
});
export default defineSchema({
  activity: defineTable({ owner: v.string(), event: activityValue })
    .index('by_owner', ['owner'])
    .index('by_time', ['event.time']),
  activityPreferences: defineTable({
    owner: v.string(),
    enabled: v.boolean(),
  }).index('by_owner', ['owner']),
  settings: defineTable({ owner: v.string(), value: settingsValue }).index(
    'by_owner',
    ['owner'],
  ),
  installations: defineTable({
    owner: v.string(),
    installationId: v.string(),
    providerStatus: providerStatusValue,
    lastSeenAt: v.number(),
  })
    .index('by_installation', ['installationId'])
    .index('by_owner', ['owner']),
});
