export type SystemSchema = {
  name: string;
  displayName?: string;
  description: string;
  script: string;
  version: string;
  schema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
  };
  attributes?: Array<{
    name: string;
    validElements: string[];
    schema: any;
  }>;
};

export type SystemPackage = {
  schema: SystemSchema;
  module: any;
};

export type SystemConfig = {
  [systemName: string]: Record<string, any>;
};

export type SystemPropertySchema = {
  type: string;
  description?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
};
