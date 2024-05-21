import * as THREE from "three";

import { AnimationType, AttributeAnimation } from "../elements/AttributeAnimation";
import { AttributeLerp } from "../elements/AttributeLerp";
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
  type: T;
  previousValue: AnimationTypeToValueType<T> | null;
  elementValue: AnimationTypeToValueType<T> | null;
  elementValueSetTime: number | null;
  latestValue: AnimationTypeToValueType<T> | null;
  defaultValue: AnimationTypeToValueType<T> | null;
  handler: (newValue: AnimationTypeToValueType<T> | null) => void;
};

type AnimationStateRecord<T extends AnimationType> = {
  config: AttributeState<T>;
  animationsInOrder: Array<AttributeAnimation>;
  animationsSet: Set<AttributeAnimation>;
  lerpsInOrder: Array<AttributeLerp>;
  lerpsSet: Set<AttributeLerp>;
};

function TupleToState<T extends AnimationType>(tuple: AttributeTuple<T>): AttributeState<T> {
  return {
    previousValue: null,
    elementValue: null,
    elementValueSetTime: null,
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
  if (newValue === null) {
    // There is no value from the source (likely there are no animations and no attribute value), so use the default.
    newValue = state.config.defaultValue;
  }
  if (state.config.latestValue !== newValue) {
    state.config.latestValue = newValue;
    state.config.handler(newValue);
  }
}

function isColorAttribute(
  attributeState: AttributeState<AnimationType>,
): attributeState is AttributeState<AnimationType.Color> {
  return attributeState.type === AnimationType.Color;
}

function isNumberAttribute(
  attributeState: AttributeState<AnimationType>,
): attributeState is AttributeState<AnimationType.Number> {
  return attributeState.type === AnimationType.Number;
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
  private allLerps: Set<AttributeLerp> = new Set();
  private documentTimeTickListener: null | { remove: () => void } = null;

  constructor(element: MElement, handlers: AttributeHandlerRecord) {
    this.element = element;
    for (const key in handlers) {
      const state = TupleToState(handlers[key]);
      this.stateByAttribute[key] = {
        config: state,
        animationsInOrder: [],
        animationsSet: new Set(),
        lerpsInOrder: [],
        lerpsSet: new Set(),
      };
    }
  }

  public addSideEffectChild(child: MElement): void {
    if (child instanceof AttributeAnimation) {
      const attr = child.getAnimatedAttributeName();
      if (attr) {
        this.addAnimation(child, attr);
      }
    } else if (child instanceof AttributeLerp) {
      const attr = child.getAnimatedAttributeName();
      if (attr) {
        this.addLerp(child, attr);
      }
    }
  }

  public removeSideEffectChild(child: MElement): void {
    if (child instanceof AttributeAnimation) {
      const attr = child.getAnimatedAttributeName();
      if (attr) {
        this.removeAnimation(child, attr);
      }
    } else if (child instanceof AttributeLerp) {
      const attr = child.getAnimatedAttributeName();
      if (attr) {
        this.removeLerp(child, attr);
      }
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
    state.config.previousValue = state.config.latestValue;
    state.config.elementValue = newValue;
    if (this.element.isConnected) {
      state.config.elementValueSetTime = this.element.getWindowTime();
    } else {
      state.config.elementValueSetTime = null;
    }
    if (state.animationsSet.size > 0 || state.lerpsSet.size > 0) {
      return;
    }
    updateIfChangedValue(state, newValue);
  }

  public getAttributesForAttributeValue(attr: string): Array<string> {
    // attr is in the format "some-attr, another-attr" or "all". Only return attributes that exist
    if (attr === "all") {
      return Object.keys(this.stateByAttribute);
    }
    return attr
      .split(",")
      .map((a) => a.trim())
      .filter((a) => this.stateByAttribute[a]);
  }

  public addLerp(lerp: AttributeLerp, attributeValue: string) {
    const attributes = this.getAttributesForAttributeValue(attributeValue);
    for (const key of attributes) {
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
      this.allLerps.add(lerp);
      state.lerpsSet.add(lerp);
      state.lerpsInOrder = [];
      const elementChildren = Array.from(this.element.children);
      for (const child of elementChildren) {
        if (state.lerpsSet.has(child as AttributeLerp)) {
          state.lerpsInOrder.push(child as AttributeLerp);
        }
      }
    }
  }

  public removeLerp(lerp: AttributeLerp, attributeValue: string) {
    const attributes = this.getAttributesForAttributeValue(attributeValue);
    for (const key of attributes) {
      const state = this.stateByAttribute[key];
      if (!state) {
        return;
      }
      state.lerpsInOrder.splice(state.lerpsInOrder.indexOf(lerp), 1);
      state.lerpsSet.delete(lerp);
      if (state.animationsSet.size === 0) {
        updateIfChangedValue(state, state.config.elementValue);
      }
      this.allLerps.delete(lerp);
      if (this.allLerps.size === 0) {
        // stop listening to document time
        if (this.documentTimeTickListener) {
          this.documentTimeTickListener.remove();
          this.documentTimeTickListener = null;
        }
      }
    }
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
        continue;
      }

      if (state.lerpsInOrder.length > 0) {
        const lerp = state.lerpsInOrder[0];
        const config = state.config;
        if (
          config.elementValueSetTime !== null &&
          config.previousValue !== null &&
          config.elementValue !== null
        ) {
          if (isColorAttribute(config)) {
            updateIfChangedValue(
              state,
              lerp.getColorValueForTime(
                this.element.getWindowTime(),
                config.elementValueSetTime,
                config.elementValue,
                config.previousValue,
              ),
            );
          } else if (isNumberAttribute(config)) {
            updateIfChangedValue(
              state,
              lerp.getFloatValueForTime(
                this.element.getWindowTime(),
                config.elementValueSetTime,
                config.elementValue,
                config.previousValue,
              ),
            );
          }
        }
      }
    }
  }
}
