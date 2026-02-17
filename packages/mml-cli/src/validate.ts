import { validateMMLDocument } from "@mml-io/mml-schema-validator";
import * as fs from "fs";
import * as path from "path";

export interface ValidateOptions {
  json: boolean;
}

type FileResult = {
  file: string;
  errors: Array<{ line: number; col: number; message: string }>;
};

const bold = (s: string) => `\x1b[1m${s}\x1b[22m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[22m`;
const red = (s: string) => `\x1b[31m${s}\x1b[39m`;
const green = (s: string) => `\x1b[32m${s}\x1b[39m`;

export function validate(files: string[], options: ValidateOptions): void {
  const results: FileResult[] = [];

  for (const file of files) {
    const filePath = path.resolve(file);

    if (!fs.existsSync(filePath)) {
      results.push({
        file,
        errors: [{ line: 0, col: 0, message: `File not found: ${filePath}` }],
      });
      continue;
    }

    let contents: string;
    try {
      contents = fs.readFileSync(filePath, "utf8");
    } catch (e) {
      results.push({
        file,
        errors: [{ line: 0, col: 0, message: `Failed to read file: ${(e as Error).message}` }],
      });
      continue;
    }

    try {
      const validationErrors = validateMMLDocument(contents);
      if (validationErrors) {
        results.push({
          file,
          errors: validationErrors.map((err) => ({
            line: err.line,
            col: err.col,
            message: err.message.trim(),
          })),
        });
      }
    } catch (e) {
      results.push({
        file,
        errors: [{ line: 0, col: 0, message: `Validation failed: ${(e as Error).message}` }],
      });
    }
  }

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    if (results.length === 0) {
      console.log(green("\u2713 No errors found"));
    } else {
      let totalErrors = 0;
      for (const result of results) {
        console.log(bold(result.file));
        for (const err of result.errors) {
          const location = err.line > 0 ? `${err.line}:${err.col}` : "-";
          console.log(`  ${dim(location)}  ${red(err.message)}`);
          totalErrors++;
        }
        console.log();
      }
      const fileWord = results.length === 1 ? "file" : "files";
      const errorWord = totalErrors === 1 ? "error" : "errors";
      console.log(red(`\u2717 ${totalErrors} ${errorWord} in ${results.length} ${fileWord}`));
    }
  }

  const hasErrors = results.length > 0;
  process.exitCode = hasErrors ? 1 : 0;
}
