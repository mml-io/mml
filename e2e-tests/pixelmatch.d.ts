declare module "pixelmatch" {
  function pixelmatch(
    img1: Buffer | Uint8Array | Uint8ClampedArray,
    img2: Buffer | Uint8Array | Uint8ClampedArray,
    output: Buffer | Uint8Array | Uint8ClampedArray | null,
    width: number,
    height: number,
    options?: {
      threshold?: number;
      includeAA?: boolean;
      alpha?: number;
      aaColor?: [number, number, number];
      diffColor?: [number, number, number];
      diffColorAlt?: [number, number, number];
      diffMask?: boolean;
    },
  ): number;
  export = pixelmatch;
}
