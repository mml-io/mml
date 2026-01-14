import { SystemPackage, SystemSchema } from "mml-game-systems-common";

import physicsSystemSchemaJsonText from "mml-game-physics-system/build/mml.schema.json?text";
import mathSystemSchemaJsonText from "mml-game-math-system/build/mml.schema.json?text";
import navigationSystemSchemaJsonText from "mml-game-navigation-system/build/mml.schema.json?text";

type SystemSchemaJson = {
  schema: unknown;
  attributes: unknown;
};

const physicsSystemSchemaJson = JSON.parse(physicsSystemSchemaJsonText) as SystemSchemaJson;
const mathSystemSchemaJson = JSON.parse(mathSystemSchemaJsonText) as SystemSchemaJson;
const navigationSystemSchemaJson = JSON.parse(navigationSystemSchemaJsonText) as SystemSchemaJson;

const physicsSystemSchema: SystemSchema = {
  name: "physics",
  displayName: "Physics System",
  description: "Physics system using Rapier physics engine for realistic 3D physics simulation",
  script: "index.js",
  version: "0.1.0",
  schema: physicsSystemSchemaJson.schema as SystemSchema["schema"],
  attributes: physicsSystemSchemaJson.attributes as SystemSchema["attributes"],
};

const mathSystemSchema: SystemSchema = {
  name: "math",
  displayName: "Math System",
  description: "Math utilities for vectors, quaternions, and DOM transforms",
  script: "index.js",
  version: "0.1.0",
  schema: mathSystemSchemaJson.schema as SystemSchema["schema"],
  attributes: mathSystemSchemaJson.attributes as SystemSchema["attributes"],
};

export type BuiltInSystemNames = "physics" | "math" | "navigation";

export const builtInSystemNameSet: Set<BuiltInSystemNames> = new Set([
  "physics",
  "math",
  "navigation",
]);

const builtInSystems = new Map<
  BuiltInSystemNames,
  {
    schema: SystemSchema;
    loadPackage: () => Promise<SystemPackage>;
  }
>([
  [
    "physics",
    {
      schema: physicsSystemSchema,
      loadPackage: async () => {
        const physicsSystemModule = (await import("mml-game-physics-system/build/index.js?text"))
          .default;
        const physicsSystemPackage: SystemPackage = {
          schema: physicsSystemSchema,
          module: physicsSystemModule,
        };
        return physicsSystemPackage;
      },
    },
  ],
  [
    "math",
    {
      schema: mathSystemSchema,
      loadPackage: async () => {
        const mathSystemModule = (await import("mml-game-math-system/build/index.umd.js?text"))
          .default;
        const mathSystemPackage: SystemPackage = {
          schema: mathSystemSchema,
          module: mathSystemModule,
        };
        return mathSystemPackage;
      },
    },
  ],
  [
    "navigation",
    {
      schema: {
        name: "navigation",
        displayName: "Navigation System",
        description: "Navigation system using recast-navigation for pathfinding",
        script: "index.js",
        version: "0.1.0",
        schema: navigationSystemSchemaJson.schema as SystemSchema["schema"],
        attributes: navigationSystemSchemaJson.attributes as SystemSchema["attributes"],
      },
      loadPackage: async () => {
        const navigationSystemModule = (
          await import("mml-game-navigation-system/build/index.js?text")
        ).default;
        const navigationSystemPackage: SystemPackage = {
          schema: {
            name: "navigation",
            displayName: "Navigation System",
            description: "Navigation system using recast-navigation for pathfinding",
            script: "index.js",
            version: "0.1.0",
            schema: navigationSystemSchemaJson.schema as SystemSchema["schema"],
            attributes: navigationSystemSchemaJson.attributes as SystemSchema["attributes"],
          },
          module: navigationSystemModule,
        };
        return navigationSystemPackage;
      },
    },
  ],
]);

function isBuiltInSystemName(systemUrlOrName: string): systemUrlOrName is BuiltInSystemNames {
  return builtInSystemNameSet.has(systemUrlOrName as BuiltInSystemNames);
}

export async function loadSystemSchema(systemUrlOrName: string): Promise<SystemSchema> {
  // This function should be async in principle because it may load external module information in future
  await new Promise((resolve) => setTimeout(resolve, 0));

  const builtInSystemName = isBuiltInSystemName(systemUrlOrName);
  if (builtInSystemName) {
    const system = builtInSystems.get(systemUrlOrName);
    if (!system) {
      throw new Error(`Built in system ${systemUrlOrName} not found`);
    }
    return system.schema;
  }

  throw new Error(`System ${systemUrlOrName} not found`);
}

export async function loadSystemPackage(systemUrlOrName: string): Promise<SystemPackage> {
  const builtInSystemName = isBuiltInSystemName(systemUrlOrName);
  if (builtInSystemName) {
    const system = builtInSystems.get(systemUrlOrName);
    if (!system) {
      throw new Error(`Built in system ${systemUrlOrName} not found`);
    }
    return system.loadPackage();
  }

  throw new Error(`System ${systemUrlOrName} not found`);
}
