/** Serialize popup checks/actions; logout remains immediate outside this queue. */
export function createConnectionQueue() {
  let tail: Promise<void> = Promise.resolve();
  let pending = 0;
  return {
    busy: () => pending > 0,
    run<T>(work: () => Promise<T>): Promise<T> {
      pending++;
      const result = tail.then(work);
      tail = result.then(
        () => {
          pending--;
        },
        () => {
          pending--;
        },
      );
      return result;
    },
  };
}
