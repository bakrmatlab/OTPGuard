import {
  ACTIVITY_LIMIT,
  LOCAL_RETENTION_MS,
  parseActivity,
  type ActivityEvent,
} from '../../../packages/shared';
export interface HistoryStore {
  read(): Promise<unknown>;
  write(value: { version: 1; events: ActivityEvent[] }): Promise<void>;
}
/** Profile-local, sanitized records only. No secret-bearing context/envelope accepted. */
export function createLocalHistory(
  store: HistoryStore,
  serviceIds: readonly string[],
  now = Date.now,
) {
  let queue: Promise<unknown> = Promise.resolve();
  const serialize = <T>(run: () => Promise<T>): Promise<T> => {
    const result = queue.then(run);
    queue = result.catch(() => {});
    return result;
  };
  const read = async () => {
    const value = await store.read();
    if (value === undefined) return [];
    if (
      !value ||
      typeof value !== 'object' ||
      Object.keys(value).length !== 2 ||
      !Object.hasOwn(value, 'version') ||
      !Object.hasOwn(value, 'events') ||
      !('version' in value) ||
      value.version !== 1 ||
      !('events' in value) ||
      !Array.isArray(value.events) ||
      value.events.length > ACTIVITY_LIMIT
    )
      throw new Error('HISTORY_UNAVAILABLE');
    const events = value.events.map((event) =>
      parseActivity(event, serviceIds),
    );
    if (events.some((event) => !event)) throw new Error('HISTORY_UNAVAILABLE');
    const time = now();
    if (!Number.isSafeInteger(time) || time < 0)
      throw new Error('HISTORY_UNAVAILABLE');
    return (events as ActivityEvent[]).filter(
      (event) => event.time > time - LOCAL_RETENTION_MS && event.time <= time,
    );
  };
  const save = (events: ActivityEvent[]) => store.write({ version: 1, events });
  return {
    list: () =>
      serialize(async () => {
        const events = await read();
        await save(events);
        return events;
      }),
    append: (input: unknown) =>
      serialize(async () => {
        const event = parseActivity(input, serviceIds);
        const time = now();
        if (
          !event ||
          event.time > time ||
          event.time <= time - LOCAL_RETENTION_MS
        )
          throw new Error('INVALID_ACTIVITY');
        const events = await read();
        await save([...events, event].slice(-ACTIVITY_LIMIT));
      }),
    export: () =>
      serialize(async () => {
        const events = await read();
        await save(events);
        return JSON.stringify({ version: 1, events });
      }),
    // Explicit deletion can also recover a corrupt history record.
    clear: (authorize?: () => Promise<boolean>) =>
      serialize(async () => {
        if (authorize && !(await authorize()))
          throw new Error('AUTHORITY_CHANGED');
        await save([]);
      }),
  };
}
