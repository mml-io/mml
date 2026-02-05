export type FieldDefinition = {
  readonly name: string;
  readonly label: string;
  readonly type: "string" | "number" | "x,y,z" | "color" | "boolean" | "action";
  readonly requireSubmission?: boolean;
  readonly options?: string[];
  readonly defaultValue: string | number | boolean;
  readonly groupDefinition: GroupDefinition;
  readonly onClick?: () => void;
};

export type GroupDefinition = {
  readonly name: string;
  readonly label: string;
};
