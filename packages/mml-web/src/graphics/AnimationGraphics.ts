import { Animation, MAnimationProps } from "../elements";
import { GraphicsAdapter } from "./GraphicsAdapter";

export abstract class AnimationGraphics<G extends GraphicsAdapter = GraphicsAdapter> {
  constructor(element: Animation<G>) {
    void element; // suppressing unused for linter
  }

  abstract setSrc(src: string | null, mAnimationProps: MAnimationProps): void;

  abstract setWeight(weight: number, mAnimationProps: MAnimationProps): void;

  abstract dispose(): void;
}
