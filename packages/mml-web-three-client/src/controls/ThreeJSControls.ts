export interface ThreeJSControls {
  type: string;
  enable: () => void;
  disable: () => void;
  update: (dt: number) => void;
  dispose: () => void;
}
