export class QueryParamState {
  private params: Map<string, string> = new Map();
  private usedParams: Set<string> = new Set();

  constructor(arg: string | Map<string, string> = new Map()) {
    if (typeof arg === "string") {
      this.params = new Map(new URLSearchParams(arg));
    } else {
      this.params = new Map(arg);
    }
  }

  public cloneWithAdditionalParams(params: Map<string, string>): QueryParamState {
    const newParams = new Map(this.params);
    params.forEach((value, key) => {
      newParams.set(key, value);
    });
    return new QueryParamState(newParams);
  }

  public read(key: string): string | null {
    this.usedParams.add(key);
    return this.params.get(key) ?? null;
  }

  public getUnusedParams(): Set<string> {
    const unusedParams = new Set(this.params.keys());
    this.usedParams.forEach((key) => {
      unusedParams.delete(key);
    });
    return unusedParams;
  }

  public toString(): string {
    const searchParams = new URLSearchParams();
    this.params.forEach((value, key) => {
      searchParams.set(key, value);
    });
    return searchParams.toString();
  }
}
