export interface Controls {
  type: string;
  enable: () => void;
  disable: () => void;
  update: (dt: number) => void;
  dispose: () => void;
}
