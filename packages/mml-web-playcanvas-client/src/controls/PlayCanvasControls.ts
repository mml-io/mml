export interface PlayCanvasControls {
  type: string;
  enable: () => void;
  disable: () => void;
  update: (dt: number) => void;
  dispose: () => void;
}
