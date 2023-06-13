type ListenerFunc = (...args: any[]) => void;

type EventSpecificationTuple = [EventTarget, string, ListenerFunc, AddEventListenerOptions?];

export class EventHandlerCollection {
  private eventsByTarget: Map<EventTarget, Map<string, Set<ListenerFunc>>> = new Map();

  public add(
    target: EventTarget,
    key: string,
    listener: ListenerFunc,
    options?: AddEventListenerOptions,
  ): this {
    target.addEventListener(key, listener, options);

    let existingTarget = this.eventsByTarget.get(target);
    if (existingTarget === undefined) {
      existingTarget = new Map();
      this.eventsByTarget.set(target, existingTarget);
    }
    let existingKey = existingTarget.get(key);
    if (existingKey === undefined) {
      existingKey = new Set();
      existingTarget.set(key, existingKey);
    }
    existingKey.add(listener);

    return this;
  }

  public clear() {
    this.eventsByTarget.forEach((keyMap, target) => {
      keyMap.forEach((listenerSet, key) => {
        listenerSet.forEach((listenerFunc) => {
          target.removeEventListener(key, listenerFunc);
        });
      });
    });
    this.eventsByTarget.clear();
  }

  static create(initial?: Array<EventSpecificationTuple>): EventHandlerCollection {
    const instance = new EventHandlerCollection();
    if (initial !== undefined) {
      initial.forEach(([target, key, listenerFunc, options]) => {
        instance.add(target, key, listenerFunc, options);
      });
    }
    return instance;
  }
}
