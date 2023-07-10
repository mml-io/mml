export class AnimatedAttributeHelper {
  private param: { [p: string]: (newValue: number) => void };

  constructor(param: { [key: string]: (newValue: number) => void }) {
    this.param = param;
  }

  setAttribute(key: string, newValue: number) {
    const handler = this.param[key];
    if (!handler) {
      throw new Error("Handler key not found");
    }
    handler(newValue);

  }
}
