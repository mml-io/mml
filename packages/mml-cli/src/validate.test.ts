import * as path from "path";

vi.mock("@mml-io/mml-schema-validator", () => ({
  validateMMLDocument: vi.fn(),
}));

vi.mock("fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

import { validateMMLDocument } from "@mml-io/mml-schema-validator";
import * as fs from "fs";

import { validate } from "./validate.js";

describe("validate", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let originalExitCode: typeof process.exitCode;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    originalExitCode = process.exitCode;
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.exitCode = originalExitCode;
    consoleLogSpy.mockRestore();
  });

  describe("file not found", () => {
    test("reports error when file does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      validate(["missing.html"], { json: true });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output).toHaveLength(1);
      expect(output[0].file).toBe("missing.html");
      expect(output[0].errors).toHaveLength(1);
      expect(output[0].errors[0].message).toContain("File not found");
      expect(output[0].errors[0].line).toBe(0);
      expect(output[0].errors[0].col).toBe(0);
    });

    test("sets process.exitCode to 1", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      validate(["missing.html"], { json: true });

      expect(process.exitCode).toBe(1);
    });

    test("includes resolved path in error message", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      validate(["missing.html"], { json: true });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      const resolvedPath = path.resolve("missing.html");
      expect(output[0].errors[0].message).toContain(resolvedPath);
    });
  });

  describe("file read error", () => {
    test("reports error when readFileSync throws", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error("EACCES: permission denied");
      });

      validate(["unreadable.html"], { json: true });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output).toHaveLength(1);
      expect(output[0].errors[0].message).toContain("Failed to read file");
      expect(output[0].errors[0].message).toContain("EACCES: permission denied");
    });

    test("sets process.exitCode to 1", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error("read error");
      });

      validate(["unreadable.html"], { json: true });

      expect(process.exitCode).toBe(1);
    });
  });

  describe("validation errors", () => {
    test("reports validation errors with line, col, and message", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("<m-invalid />");
      vi.mocked(validateMMLDocument).mockReturnValue([
        { line: 1, col: 1, message: "Unknown element m-invalid" },
        { line: 1, col: 5, message: "Another error  " },
      ] as any);

      validate(["test.html"], { json: true });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output).toHaveLength(1);
      expect(output[0].errors).toHaveLength(2);
      expect(output[0].errors[0]).toEqual({
        line: 1,
        col: 1,
        message: "Unknown element m-invalid",
      });
    });

    test("trims whitespace from error messages", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("<html/>");
      vi.mocked(validateMMLDocument).mockReturnValue([
        { line: 1, col: 1, message: "  trailing whitespace  " },
      ] as any);

      validate(["test.html"], { json: true });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output[0].errors[0].message).toBe("trailing whitespace");
    });

    test("sets process.exitCode to 1", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("<html/>");
      vi.mocked(validateMMLDocument).mockReturnValue([
        { line: 1, col: 1, message: "error" },
      ] as any);

      validate(["test.html"], { json: true });

      expect(process.exitCode).toBe(1);
    });
  });

  describe("validation passes", () => {
    test("sets process.exitCode to 0 when no errors", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("<m-cube></m-cube>");
      vi.mocked(validateMMLDocument).mockReturnValue(null as any);

      validate(["valid.html"], { json: false });

      expect(process.exitCode).toBe(0);
    });

    test("does not include passing files in results", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("<m-cube></m-cube>");
      vi.mocked(validateMMLDocument).mockReturnValue(undefined as any);

      validate(["valid.html"], { json: true });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output).toHaveLength(0);
    });
  });

  describe("validation throws", () => {
    test("reports error when validateMMLDocument throws", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("<html/>");
      vi.mocked(validateMMLDocument).mockImplementation(() => {
        throw new Error("Parser crashed");
      });

      validate(["bad.html"], { json: true });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output).toHaveLength(1);
      expect(output[0].errors[0].message).toContain("Validation failed");
      expect(output[0].errors[0].message).toContain("Parser crashed");
    });

    test("sets process.exitCode to 1", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("<html/>");
      vi.mocked(validateMMLDocument).mockImplementation(() => {
        throw new Error("crash");
      });

      validate(["bad.html"], { json: true });

      expect(process.exitCode).toBe(1);
    });
  });

  describe("multiple files", () => {
    test("processes all files and accumulates results", () => {
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        return !String(p).includes("missing");
      });
      vi.mocked(fs.readFileSync).mockReturnValue("<m-cube></m-cube>");
      vi.mocked(validateMMLDocument)
        .mockReturnValueOnce([{ line: 1, col: 1, message: "err1" }] as any)
        .mockReturnValueOnce(null as any);

      validate(["bad.html", "good.html", "missing.html"], { json: true });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      // bad.html has validation error, good.html passes, missing.html not found
      expect(output).toHaveLength(2);
      expect(output[0].file).toBe("bad.html");
      expect(output[1].file).toBe("missing.html");
    });

    test("calls validateMMLDocument for each readable file", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("<html/>");
      vi.mocked(validateMMLDocument).mockReturnValue(null as any);

      validate(["a.html", "b.html", "c.html"], { json: true });

      expect(validateMMLDocument).toHaveBeenCalledTimes(3);
    });
  });

  describe("JSON output mode", () => {
    test("outputs valid JSON via console.log", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("<html/>");
      vi.mocked(validateMMLDocument).mockReturnValue([
        { line: 2, col: 3, message: "test error" },
      ] as any);

      validate(["file.html"], { json: true });

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const raw = consoleLogSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(raw);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0]).toEqual({
        file: "file.html",
        errors: [{ line: 2, col: 3, message: "test error" }],
      });
    });

    test("outputs pretty-printed JSON (2-space indent)", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      validate(["x.html"], { json: true });

      const raw = consoleLogSpy.mock.calls[0][0] as string;
      // Pretty-printed JSON has newlines and indentation
      expect(raw).toContain("\n");
      expect(raw).toContain("  ");
    });

    test("outputs empty array when no files have errors", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("<m-cube/>");
      vi.mocked(validateMMLDocument).mockReturnValue(null as any);

      validate(["ok.html"], { json: true });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output).toEqual([]);
    });
  });

  describe("text output mode", () => {
    test("prints success message when no errors", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("<m-cube/>");
      vi.mocked(validateMMLDocument).mockReturnValue(null as any);

      validate(["ok.html"], { json: false });

      const output = consoleLogSpy.mock.calls[0][0] as string;
      expect(output).toContain("No errors found");
    });

    test("prints file name for each file with errors", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("<html/>");
      vi.mocked(validateMMLDocument).mockReturnValue([
        { line: 1, col: 1, message: "error msg" },
      ] as any);

      validate(["myfile.html"], { json: false });

      const allOutput = consoleLogSpy.mock.calls.map((c: any[]) => c[0]).join("\n");
      expect(allOutput).toContain("myfile.html");
    });

    test("prints error message for each error", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("<html/>");
      vi.mocked(validateMMLDocument).mockReturnValue([
        { line: 5, col: 10, message: "bad attribute" },
      ] as any);

      validate(["test.html"], { json: false });

      const allOutput = consoleLogSpy.mock.calls.map((c: any[]) => c[0]).join("\n");
      expect(allOutput).toContain("bad attribute");
      expect(allOutput).toContain("5:10");
    });

    test("prints dash for meta-errors at line 0", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      validate(["nope.html"], { json: false });

      const allOutput = consoleLogSpy.mock.calls.map((c: any[]) => c[0]).join("\n");
      // line 0 should show "-" instead of "0:0" (surrounded by ANSI dim codes)
      expect(allOutput).not.toContain("0:0");
      // Strip ANSI codes and check for the dash
      // eslint-disable-next-line no-control-regex
      const stripped = allOutput.replace(/\x1b\[[0-9;]*m/g, "");
      expect(stripped).toMatch(/\s+-\s+/);
    });

    test("uses correct singular pluralization for 1 error in 1 file", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      validate(["missing.html"], { json: false });

      const allOutput = consoleLogSpy.mock.calls.map((c: any[]) => c[0]).join("\n");
      expect(allOutput).toContain("1 error in 1 file");
    });

    test("uses correct plural pluralization for multiple errors/files", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      validate(["a.html", "b.html"], { json: false });

      const allOutput = consoleLogSpy.mock.calls.map((c: any[]) => c[0]).join("\n");
      expect(allOutput).toContain("2 errors in 2 files");
    });

    test("prints summary with total error count across files", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("<html/>");
      vi.mocked(validateMMLDocument).mockReturnValue([
        { line: 1, col: 1, message: "err1" },
        { line: 2, col: 1, message: "err2" },
      ] as any);

      validate(["file.html"], { json: false });

      const allOutput = consoleLogSpy.mock.calls.map((c: any[]) => c[0]).join("\n");
      expect(allOutput).toContain("2 errors in 1 file");
    });
  });

  describe("exit code", () => {
    test("sets exitCode 0 when all files pass validation", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("<m-cube/>");
      vi.mocked(validateMMLDocument).mockReturnValue(null as any);

      validate(["good.html"], { json: false });

      expect(process.exitCode).toBe(0);
    });

    test("sets exitCode 1 when any file has errors", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("<html/>");
      vi.mocked(validateMMLDocument).mockReturnValue([{ line: 1, col: 1, message: "err" }] as any);

      validate(["bad.html"], { json: false });

      expect(process.exitCode).toBe(1);
    });
  });
});
