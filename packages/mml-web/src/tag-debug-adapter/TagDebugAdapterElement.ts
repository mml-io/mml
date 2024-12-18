import { MElement } from "../elements";
import { TagDebugGraphicsAdapter } from "./StandaloneTagDebugAdapter";

export function TagDebugAdapterElement<
  T extends Record<string, string>,
  G extends Record<string, any>,
>(
  functionToAttribute: T,
  additionalFunctions: G,
): (element: MElement<TagDebugGraphicsAdapter>) => {
  enable: () => void;
  disable: () => void;
  dispose: () => void;
  getCollisionElement(): null;
} & Record<keyof T, (val: any, props: any) => void> &
  G {
  return (element: MElement<TagDebugGraphicsAdapter>) => {
    const result = {} as Record<keyof T, (val: any, props: any) => void>;
    for (const key in functionToAttribute) {
      const attributeName = functionToAttribute[key];
      result[key] = (val: any) => {
        element.getContainer()?.setAppliedAttributeValue(attributeName, val);
      };
    }
    return {
      ...result,
      enable: () => {
        // no-op
      },
      disable: () => {
        // no-op
      },
      getCollisionElement() {
        return null;
      },
      dispose: () => {
        // no-op
      },
      ...additionalFunctions,
    };
  };
}
