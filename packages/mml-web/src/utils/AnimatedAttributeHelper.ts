import * as THREE from "three";

import { AnimationType, AttributeAnimation } from "../elements/AttributeAnimation";
import { MElement } from "../elements/MElement";

type AttributeTuple<T> = [AnimationType, T | null, (newValue: T | null) => void];

export type AttributeHandlerRecord<T extends number | THREE.Color> = Record<
  string,
  AttributeTuple<T>
>;

export class AnimatedAttributeHelper {
  private element: MElement;
  private stateByAttribute: {
    [p: string]: {
      valueAndHandler: AttributeTuple<number | THREE.Color>;
      animationsSet: Set<AttributeAnimation>;
      animationsInOrder: Array<AttributeAnimation>;
    };
  } = {};
  private documentTimeTickListener: null | { remove: () => void } = null;

  constructor(element: MElement, handlers: AttributeHandlerRecord<number | THREE.Color>) {
    this.element = element;
    this.stateByAttribute = {};
    for (const key in handlers) {
      this.stateByAttribute[key] = {
        valueAndHandler: handlers[key],
        animationsInOrder: [],
        animationsSet: new Set(),
      };
    }
  }

  public elementSetAttribute(key: string, newValue: number | THREE.Color | null) {
    const state = this.stateByAttribute[key];
    if (!state) {
      return;
    }
    state.valueAndHandler[1] = newValue;
    if (state.animationsSet.size > 0) {
      return;
    }
    state.valueAndHandler[2](newValue);
  }

  public addAnimation(animation: AttributeAnimation, key: string) {
    const state = this.stateByAttribute[key];
    if (!state) {
      return;
    }
    if (state.animationsSet.size === 0) {
      // start listening to document time
      this.documentTimeTickListener = this.element.addDocumentTimeTickListener((documentTime) => {
        this.updateTime(documentTime);
      });
    }
    state.animationsSet.add(animation);
    state.animationsInOrder = [];
    const elementChildren = Array.from(this.element.children);
    for (const child of elementChildren) {
      if (state.animationsSet.has(child as AttributeAnimation)) {
        state.animationsInOrder.push(child as AttributeAnimation);
      }
    }
  }

  public removeAnimation(animation: AttributeAnimation, key: string) {
    const state = this.stateByAttribute[key];
    if (!state) {
      return;
    }
    state.animationsInOrder.splice(state.animationsInOrder.indexOf(animation), 1);
    state.animationsSet.delete(animation);
    if (state.animationsSet.size === 0) {
      state.valueAndHandler[2](state.valueAndHandler[1]);
    }
    if (state.animationsSet.size === 0) {
      // stop listening to document time
      if (this.documentTimeTickListener) {
        this.documentTimeTickListener.remove();
        this.documentTimeTickListener = null;
      }
    }
  }

  public updateTime(documentTime: number) {
    for (const key in this.stateByAttribute) {
      const state = this.stateByAttribute[key];
      let stale: { value: number | THREE.Color; state: number } | null = null;
      const animationType = state.valueAndHandler[0];
      for (const animation of state.animationsInOrder) {
        if (animationType === AnimationType.Color) {
          const [newValue, active] = animation.getColorValueForTime(documentTime);
          if (active === 0) {
            state.valueAndHandler[2](newValue);
            stale = null;
            break;
          } else {
            if (stale === null) {
              stale = { value: newValue, state: active };
            } else {
              const isAboutToStartRatherThanEnded = stale.state > 0 && active < 0;
              const isMoreRecentEnd = stale.state > 0 && active > 0 && stale.state > active;
              const isSoonerToStart = stale.state < 0 && active < 0 && stale.state < active;
              if (isAboutToStartRatherThanEnded || isMoreRecentEnd || isSoonerToStart) {
                stale = { value: newValue, state: active };
              }
            }
          }
        } else if (animationType === AnimationType.Number) {
          const [newValue, active] = animation.getFloatValueForTime(documentTime);
          if (active === 0) {
            state.valueAndHandler[2](newValue);
            stale = null;
            break;
          } else {
            if (stale === null) {
              stale = { value: newValue, state: active };
            } else {
              const isAboutToStartRatherThanEnded = stale.state > 0 && active < 0;
              const isMoreRecentEnd = stale.state > 0 && active > 0 && stale.state > active;
              const isSoonerToStart = stale.state < 0 && active < 0 && stale.state < active;
              if (isAboutToStartRatherThanEnded || isMoreRecentEnd || isSoonerToStart) {
                stale = { value: newValue, state: active };
              }
            }
          }
        }
      }
      if (stale !== null) {
        state.valueAndHandler[2](stale.value);
      }
    }
  }
}
