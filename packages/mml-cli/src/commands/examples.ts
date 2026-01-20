import { elementSchemas, generateExamples } from "@mml-io/mml-schema";
import fs from "fs";
import path from "path";
import type { Argv } from "yargs";

interface ExamplesArgs {
  element?: string;
  category?: string;
  output?: string;
}

function runExamples(argv: ExamplesArgs): void {
  const { element, category, output } = argv;

  const content = generateExamples(element, category);

  if (output) {
    const outputPath = path.resolve(output);

    if (output.endsWith(".md")) {
      // Single file
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, content);
      console.log(`Examples written to ${outputPath}`);
    } else {
      // Directory with individual files per element
      fs.mkdirSync(outputPath, { recursive: true });

      let filesWritten = 0;
      for (const schema of Object.values(elementSchemas)) {
        if (!schema.examples || schema.examples.length === 0) continue;

        const elementExamples = generateExamples(schema.tagName);
        const filePath = path.join(outputPath, `${schema.tagName}.md`);
        fs.writeFileSync(filePath, elementExamples);
        filesWritten++;
      }

      console.log(`Examples written to ${outputPath}/`);
      console.log(`  - ${filesWritten} example files`);
    }
  } else {
    console.log(content);
  }
}

export function registerExamplesCommand(yargs: Argv): Argv {
  return yargs.command(
    "examples",
    "Show MML usage examples",
    (y) =>
      y
        .option("element", {
          alias: "e",
          type: "string",
          description: "Show examples for a specific element (e.g., m-cube)",
        })
        .option("category", {
          alias: "c",
          type: "string",
          description: "Filter examples by category (e.g., physics, animation)",
        })
        .option("output", {
          alias: "o",
          type: "string",
          description: "Output path (file or directory)",
        })
        .example("$0 examples", "List all examples")
        .example("$0 examples --element m-cube", "Show examples for m-cube")
        .example("$0 examples --output ./docs/examples/", "Write example files"),
    (argv) => {
      runExamples(argv);
    },
  );
}
