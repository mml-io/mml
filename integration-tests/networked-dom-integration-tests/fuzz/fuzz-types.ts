export const AVAILABLE_TAGS = [
  "div",
  "span",
  "section",
  "article",
  "aside",
  "header",
  "footer",
] as const;

export const CLIENT_CONNECTION_IDS = ["1", "2"] as const;

export type ClientConnectionId = (typeof CLIENT_CONNECTION_IDS)[number];

export interface FuzzNodeSpec {
  tag: string;
  id: string;
  attributes: Record<string, string>;
  textContent?: string;
  children: FuzzNodeSpec[];
}

export interface AddOperation {
  type: "add";
  parentId: string;
  node: FuzzNodeSpec;
  delayMs: number;
}

export interface RemoveOperation {
  type: "remove";
  targetId: string;
  delayMs: number;
}

export interface SetAttributeOperation {
  type: "set-attribute";
  targetId: string;
  name: string;
  value: string;
  delayMs: number;
}

export interface RemoveAttributeOperation {
  type: "remove-attribute";
  targetId: string;
  name: string;
  delayMs: number;
}

export interface ReloadOperation {
  type: "reload";
  html: string;
  delayMs: number;
}

export type DeepReadonly<T> = T extends (infer U)[]
  ? DeepReadonlyArray<U>
  : T extends object
    ? DeepReadonlyObject<T>
    : T;
export type DeepReadonlyArray<T> = ReadonlyArray<DeepReadonly<T>>;
export type DeepReadonlyObject<T> = {
  readonly [P in keyof T]: DeepReadonly<T[P]>;
};

export type FuzzOperation =
  | AddOperation
  | RemoveOperation
  | SetAttributeOperation
  | RemoveAttributeOperation
  | ReloadOperation;

export type OperationSequence = {
  html: string;
  operations: DeepReadonly<FuzzOperation[]>;
};

export interface TreeNode {
  id: string;
  tag: string;
  attributes: Record<string, string>;
  children: TreeNode[];
  textContent?: string;
}

export interface FuzzScenario {
  operations: FuzzOperation[];
  finalTree: TreeNode;
  expectedDocumentHTML: string;
  expectedClientHTMLByConnection: Record<string, string>;
  expectedClientHTMLByConnectionV02: Record<string, string>;
}
