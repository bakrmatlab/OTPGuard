/** Generic search must fetch its entire bounded ID set, never a chosen subset. */
export const genericRetrievalLimits = Object.freeze({
  messages: 50,
  pages: 5,
  pageSize: 20,
  concurrency: 4,
  cycleMilliseconds: 30_000,
  responseBytes: 512 * 1024,
  cycleBytes: 8 * 1024 * 1024,
});
