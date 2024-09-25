import { FormIteration } from "./FormIteration";

export type GraphicsMode = {
  type: string;
  dispose: () => void;
  update: (formIteration: FormIteration) => void;
};
