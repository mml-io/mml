import { animationShowcase } from "./animation-showcase";
import { basicScene } from "./basic-scene";
import { blockTower } from "./block-tower";
import { camerasPriority } from "./cameras-priority";
import { characterControllerToggle } from "./character-controller-toggle";
import { characterStateDemo } from "./character-state-demo";
import { helmetAndDuck } from "./helmet-and-duck";
import { infiniteRunner } from "./infinite-runner";
import { mCharacterControllerTest } from "./m-character-controller-test";
import { mOverlayTest } from "./m-overlay-test";
import { tankBattle } from "./tank-battle";
import { tankCharacterDemo } from "./tank-character-demo";

export type ExampleDefinition = {
  name: string;
  description: string;
  content: Record<string, string>;
  systems?: {
    name: string;
    config: Record<string, unknown>;
  }[];
};

export const examples: Record<string, ExampleDefinition> = {
  "basic-scene": basicScene,
  "helmet-and-duck": helmetAndDuck,
  "cameras-priority": camerasPriority,
  "block-tower": blockTower,
  "animation-showcase": animationShowcase,
  "tank-battle": tankBattle,
  "infinite-runner": infiniteRunner,
  "m-character-controller-test": mCharacterControllerTest,
  "character-controller-toggle": characterControllerToggle,
  "m-overlay-test": mOverlayTest,
  "tank-character-demo": tankCharacterDemo,
  "character-state-demo": characterStateDemo,
};

export const exampleKeys = Object.keys(examples);
export const defaultExample = "helmet-and-duck";
