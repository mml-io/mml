import { easingFunctions } from "./easingFunctions";

export const easingsByName: Record<
  string,
  (amount: number, base: number, change: number, duration: number) => number
> = easingFunctions;
