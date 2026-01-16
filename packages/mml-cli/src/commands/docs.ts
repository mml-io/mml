import {
  elementSchemas,
  generateAllElementsMarkdown,
  generateAttributeGroupMarkdown,
  generateBriefDocs,
  generateElementMarkdown,
  generateJSON,
  generateXsd,
  schemaRegistry,
} from "@mml-io/mml-schema";
import fs from "fs";
import path from "path";
import type { Argv } from "yargs";

interface DocsArgs {
  element?: string;
  output?: string;
  format?: "markdown" | "json" | "xsd";
  verbose?: boolean;
}

async function runDocs(argv: DocsArgs): Promise<void> {
  const { element, output, format = "markdown", verbose } = argv;

  let content: string;

  if (format === "json") {
    content = generateJSON(element);
  } else if (format === "xsd") {
    if (element) {
      console.error("XSD format does not support single element output. Generating full XSD.");
    }
    content = generateXsd();
  } else {
    // Markdown format
    if (output) {
      // Output to files
      if (element) {
        // Single element to file
        const schema = elementSchemas[element];
        if (!schema) {
          console.error(`Unknown element: ${element}`);
          process.exit(1);
        }
        content = generateElementMarkdown(schema);
      } else {
        // All elements to directory or single file
        const outputPath = path.resolve(output);

        if (output.endsWith(".md")) {
          // Single combined file
          content = generateAllElementsMarkdown();
          fs.mkdirSync(path.dirname(outputPath), { recursive: true });
          fs.writeFileSync(outputPath, content);
          console.log(`Documentation written to ${outputPath}`);
          return;
        } else {
          // Directory with individual files
          fs.mkdirSync(path.join(outputPath, "elements"), { recursive: true });
          fs.mkdirSync(path.join(outputPath, "attributes"), { recursive: true });

          // Write element files
          for (const schema of Object.values(elementSchemas)) {
            const filePath = path.join(outputPath, "elements", `${schema.tagName}.md`);
            fs.writeFileSync(filePath, generateElementMarkdown(schema));
          }

          // Write attribute group files
          for (const group of Object.values(schemaRegistry.attributeGroups)) {
            const filePath = path.join(outputPath, "attributes", `${group.name}.md`);
            fs.writeFileSync(filePath, generateAttributeGroupMarkdown(group));
          }

          // Write index
          const indexContent = generateAllElementsMarkdown();
          fs.writeFileSync(path.join(outputPath, "index.md"), indexContent);

          console.log(`Documentation written to ${outputPath}/`);
          console.log(`  - ${Object.keys(elementSchemas).length} element files`);
          console.log(
            `  - ${Object.keys(schemaRegistry.attributeGroups).length} attribute group files`,
          );
          console.log(`  - index.md`);
          return;
        }
      }
    } else {
      // Output to stdout
      if (verbose) {
        content = element
          ? generateElementMarkdown(elementSchemas[element]!)
          : generateAllElementsMarkdown();
      } else {
        content = generateBriefDocs(element);
      }
    }
  }

  // Output to stdout or single file
  if (output) {
    const outputPath = path.resolve(output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, content);
    console.log(`Documentation written to ${outputPath}`);
  } else {
    console.log(content);
  }
}

export function registerDocsCommand(yargs: Argv): Argv {
  return yargs.command(
    "docs",
    "Generate MML element documentation",
    (y) =>
      y
        .option("element", {
          alias: "e",
          type: "string",
          description: "Generate docs for a specific element (e.g., m-cube)",
        })
        .option("output", {
          alias: "o",
          type: "string",
          description: "Output path (file or directory)",
        })
        .option("format", {
          alias: "f",
          type: "string",
          choices: ["markdown", "json", "xsd"] as const,
          default: "markdown",
          description: "Output format",
        })
        .option("verbose", {
          alias: "v",
          type: "boolean",
          default: false,
          description: "Include full attribute details in stdout output",
        })
        .example("$0 docs", "List all elements with attributes")
        .example("$0 docs --element m-cube", "Show docs for m-cube")
        .example("$0 docs --output ./docs/", "Generate markdown files")
        .example("$0 docs --format json", "Output as JSON")
        .example("$0 docs --format xsd --output mml.xsd", "Generate XSD schema"),
    async (argv) => {
      await runDocs(argv);
    },
  );
}
