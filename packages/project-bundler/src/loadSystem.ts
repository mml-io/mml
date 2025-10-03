import mathSystemSchemaJson from "mml-game-math-system/build/mml.schema.json";
import physicsSystemSchemaJson from "mml-game-physics-system/build/mml.schema.json";
import navigationSystemSchemaJson from "mml-game-navigation-system/build/mml.schema.json";
import { SystemPackage, SystemSchema } from "mml-game-systems-common";

const physicsSystemSchema: SystemSchema = {
  name: "physics",
  displayName: "Physics System",
  description: "Physics system using Rapier physics engine for realistic 3D physics simulation",
  script: "index.js",
  version: "0.1.0",
  schema: physicsSystemSchemaJson.schema,
  attributes: physicsSystemSchemaJson.attributes,
};

const mathSystemSchema: SystemSchema = {
  name: "math",
  displayName: "Math System",
  description: "Math utilities for vectors, quaternions, and DOM transforms",
  script: "index.js",
  version: "0.1.0",
  schema: mathSystemSchemaJson.schema,
  attributes: mathSystemSchemaJson.attributes,
};

export type BuiltInSystemNames = "physics" | "math" | "navigation";

export const builtInSystemNameSet: Set<BuiltInSystemNames> = new Set(["physics", "math", "navigation"]);

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
        const physicsSystemModule = (
          await import("mml-game-physics-system/build/index.js?text")
        ).default;
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
        schema: navigationSystemSchemaJson.schema,
        attributes: navigationSystemSchemaJson.attributes,
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
            schema: navigationSystemSchemaJson.schema,
            attributes: navigationSystemSchemaJson.attributes,
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
