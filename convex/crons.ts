import { cronJobs, makeFunctionReference } from 'convex/server';
const crons = cronJobs();
crons.interval(
  'expire activity',
  { hours: 1 },
  makeFunctionReference<'mutation'>('activity:expire'),
  {},
);
export default crons;
