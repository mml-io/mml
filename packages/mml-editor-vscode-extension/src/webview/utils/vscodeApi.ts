declare function acquireVsCodeApi<T>(): T & {
  postMessage: (message: unknown) => void;
  setState: (state: unknown) => void;
  getState: () => unknown;
};

type VscodeApi = ReturnType<
  typeof acquireVsCodeApi<{
    postMessage: (message: unknown) => void;
    setState: (state: unknown) => void;
    getState: () => unknown;
  }>
>;

let cached: VscodeApi | null = null;

export function getVscodeApi(): VscodeApi {
  if (!cached) {
    cached = acquireVsCodeApi();
  }
  return cached;
}
