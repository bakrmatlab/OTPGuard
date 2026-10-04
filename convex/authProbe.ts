import { ConvexError, v } from 'convex/values';
import { query } from './_generated/server';
/** Read-only authenticated transport probe; no mailbox or installation data. */
export const subject = query({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError('AUTH_REQUIRED');
    return identity.subject;
  },
});
