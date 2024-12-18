import { Link, MLinkProps } from "../elements";
import { GraphicsAdapter } from "./GraphicsAdapter";

export abstract class LinkGraphics<G extends GraphicsAdapter = GraphicsAdapter> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element: Link<G>) {}

  abstract enable(): void;

  abstract disable(): void;

  abstract setHref(href: string | null, props: MLinkProps): void;

  abstract setTarget(target: string | null, props: MLinkProps): void;

  abstract dispose(): void;
}
