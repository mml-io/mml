import * as THREE from "three";

import { AnimationType, AttributeAnimation } from "../elements/AttributeAnimation";
import { MElement } from "../elements/MElement";

type AttributeTuple<T extends AnimationType> = T extends AnimationType.Number
  ? [
      AnimationType.Number,
      AnimationTypeToValueType<T> | null,
      (newValue: AnimationTypeToValueType<T> | null) => void,
    ]
  : [
      AnimationType.Color,
      AnimationTypeToValueType<T> | null,
      (newValue: AnimationTypeToValueType<T> | null) => void,
    ];

export type AttributeHandlerRecord = Record<
  string,
  AttributeTuple<AnimationType.Number> | AttributeTuple<AnimationType.Color>
>;

type AnimationTypeToValueType<T extends AnimationType> = T extends AnimationType.Number
  ? number
  : THREE.Color;

type AttributeState<T extends AnimationType> = {
  type: AnimationType;
  elementValue: AnimationTypeToValueType<T> | null;
  latestValue: AnimationTypeToValueType<T> | null;
  defaultValue: AnimationTypeToValueType<T> | null;
  handler: (newValue: AnimationTypeToValueType<T> | null) => void;
};

type AnimationStateRecord<T extends AnimationType> = {
  config: AttributeState<T>;
  animationsInOrder: Array<AttributeAnimation>;
  animationsSet: Set<AttributeAnimation>;
};

function TupleToState<T extends AnimationType>(tuple: AttributeTuple<T>): AttributeState<T> {
  return {
    elementValue: null,
    type: tuple[0],
    latestValue: tuple[1],
    defaultValue: tuple[1],
    handler: tuple[2],
  } as AttributeState<T>;
}

function updateIfChangedValue<T extends AnimationType>(
  state: AnimationStateRecord<T>,
  newValue: AnimationTypeToValueType<T> | null,
) {
  if (state.config.latestValue !== newValue) {
    state.config.latestValue = newValue;
    state.config.handler(newValue);
  }
}

/**
 * The AnimatedAttributeHelper is a utility class that manages the application of attribute animations to an element.
 *
 * It is used by an MElement that has animateable attributes and is responsible for applying the animations to the
 * element according to the precedence rules defined in the AttributeAnimation class, and falling back to the element's
 * attribute value if no animations are active.
 */
export class AnimatedAttributeHelper {
  private element: MElement;
  private stateByAttribute: {
    [p: string]: AnimationStateRecord<AnimationType>;
  } = {};
  private allAnimations: Set<AttributeAnimation> = new Set();
  private documentTimeTickListener: null | { remove: () => void } = null;

  constructor(element: MElement, handlers: AttributeHandlerRecord) {
    this.element = element;
    for (const key in handlers) {
      const state = TupleToState(handlers[key]);
      this.stateByAttribute[key] = {
        config: state,
        animationsInOrder: [],
        animationsSet: new Set(),
      };
    }
  }

  public elementSetAttribute(
    key: string,
    newValue: AnimationTypeToValueType<AnimationType> | null,
  ) {
    const state = this.stateByAttribute[key] as AnimationStateRecord<AnimationType>;
    if (!state) {
      return;
    }
    state.config.elementValue = newValue;
    if (state.animationsSet.size > 0) {
      return;
    }
    updateIfChangedValue(state, newValue);
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
    this.allAnimations.add(animation);
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
      updateIfChangedValue(state, state.config.elementValue);
    }
    this.allAnimations.delete(animation);
    if (this.allAnimations.size === 0) {
      // stop listening to document time
      if (this.documentTimeTickListener) {
        this.documentTimeTickListener.remove();
        this.documentTimeTickListener = null;
      }
    }
  }

  public updateTime(documentTime: number) {
    for (const key in this.stateByAttribute) {
      let stale: { value: number | THREE.Color; state: number } | null = null;
      const state = this.stateByAttribute[key];
      for (const animation of state.animationsInOrder) {
        const [newValue, active] =
          state.config.type === AnimationType.Color
            ? animation.getColorValueForTime(documentTime)
            : animation.getFloatValueForTime(documentTime);

        if (active === 0) {
          updateIfChangedValue(state, newValue);
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

      if (stale !== null) {
        updateIfChangedValue(state, stale.value);
      }
    }
  }
}
