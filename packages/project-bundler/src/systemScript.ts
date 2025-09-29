import { SystemPackage } from "ai-game-creator-systems-common";

export function generateSystemScripts(
  systemName: string,
  systemPackage: SystemPackage,
  config: Record<string, unknown>,
): Array<string> {
  const { module } = systemPackage;

  // Remove export statements since systems register themselves globally
  // and exports are invalid inside function scopes
  const moduleWithoutExports = module
    .replace(/export\s+default\s+[^;]+;?/g, "") // Remove 'export default ...'
    .replace(/export\s*{[^}]*};?/g, "") // Remove 'export { ... }'
    .replace(/export\s+(const|let|var|function|class)\s+/g, "$1 ") // Remove 'export ' from declarations
    .trim();

  // Wrap the entire system module in a single IIFE to create isolated scope
  // This prevents conflicts between systems while preserving side-effects
  const wrappedSystemScript = `
(function() {
  console.log("Initializing ${systemName} system");
  
  // Initialize ${systemName} config
  if (!window.systemsConfig) {
    window.systemsConfig = {};
  }

  window.systemsConfig["${systemName}"] = ${JSON.stringify(config)};

  // Execute the entire system module in an isolated scope
  ${moduleWithoutExports}
})();`;

  return [wrappedSystemScript];
}
