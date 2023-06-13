export interface Controls {
  enable: () => void;
  disable: () => void;
  update: (dt: number) => void;
}
