import * as TypeDoc from "typedoc";

(async function main() {
  const app = new TypeDoc.Application();
  app.options.addReader(new TypeDoc.TSConfigReader());
  app.options.addReader(new TypeDoc.TypeDocReader());

  app.bootstrap({
    entryPoints: ["src/schema-src/events.d.ts"],
  });

  const project = app.convert();
  await app.generateDocs(project, "docs");
})();
