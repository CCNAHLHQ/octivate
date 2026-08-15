/** Simple async mutex for serializing job-store RMW / per-file writes. */
export function createAsyncMutex() {
  let chain: Promise<void> = Promise.resolve();
  return function withLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = chain.then(fn, fn);
    chain = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  };
}
