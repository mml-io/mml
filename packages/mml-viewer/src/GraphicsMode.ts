import { FormIteration } from "./FormIteration";
import { MMLSourceDefinition } from "./MMLSourceDefinition";

export type GraphicsMode = {
  type: string;
  dispose: () => void;
  update: (formIteration: FormIteration) => void;
  updateSource(source: MMLSourceDefinition): void;
};
