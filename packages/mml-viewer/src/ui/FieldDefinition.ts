export type FieldDefinition = {
  readonly name: string;
  readonly label: string;
  readonly type: string;
  readonly requireSubmission?: boolean;
  readonly options?: string[];
  readonly defaultValue: string | number | boolean;
  readonly groupDefinition: GroupDefinition;
};

export type GroupDefinition = {
  readonly name: string;
  readonly label: string;
};
