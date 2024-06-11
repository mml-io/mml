/**
This module is prefixed with an underscore so that ava recognizes it as a helper,
instead of failing the entire test suite with a "No tests found" error.
*/
import { InvalidOperationError, MissingError, TestError } from "../patch";

export function resultName<T extends MissingError | InvalidOperationError | TestError | null>(
  result: T,
): string | T {
  return result ? result.name : result;
}
