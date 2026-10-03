import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
export const settingsValue = v.object({ autofillEnabled: v.boolean() });
export const providerStatusValue = v.union(
  v.literal('DISCONNECTED'),
  v.literal('CONNECTED'),
  v.literal('RECONNECT_REQUIRED'),
);
export default defineSchema({
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
